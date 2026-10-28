import { readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs"
import { hostname } from "node:os"
import { join } from "node:path"
import { z } from "zod"
import { setEnvValue } from "../edit/env.js"
import { PlanError } from "../plan/errors.js"
import type { Operation, Plan } from "../plan/types.js"
import type { ProductSettings } from "../state/settings.js"
import {
  createExclusive,
  ensureFolder,
  ensureParent,
  errorCode,
  rawHash,
  removeEmptyFolders,
  removeFile,
  writeAtomic
} from "./fs.js"
import { readSafely } from "./tree.js"

/** Who holds `apply.lock`, so a later run can tell a crashed apply from a running one. */
export interface ApplyLockInfo {
  pid: number
  host: string
  time: string
  fingerprint?: string | undefined
}

const lockInfoSchema: z.ZodType<ApplyLockInfo> = z.object({
  pid: z.number(),
  host: z.string(),
  time: z.string(),
  fingerprint: z.string().optional()
})

const journalEntrySchema = z.object({
  path: z.string(),
  action: z.enum(["create", "update", "delete"]),
  beforeHash: z.string(),
  afterHash: z.string(),
  backup: z.string().optional(),
  createdFolders: z.array(z.string())
})
const journalSchema = z.object({ fingerprint: z.string(), started: z.string(), entries: z.array(journalEntrySchema) })
type Journal = z.infer<typeof journalSchema>
type JournalEntry = z.infer<typeof journalEntrySchema>

export interface ApplyHooks {
  /** Called after each write. Tests use it to simulate a crash part-way through. */
  afterWrite?(path: string): void
}

export interface ApplyOptions {
  root: string
  settings: ProductSettings
  /** Secret values to write to the secrets file after the plan applies. They're never journaled or backed up. */
  secrets?: Record<string, string>
  hooks?: ApplyHooks
}

export interface RollbackReport {
  restored: string[]
  unchanged: string[]
  /** Files someone else changed after this run wrote them. They're left as they are. */
  changed: string[]
  removedFolders: string[]
}

function statePaths(root: string, settings: ProductSettings) {
  const stateDir = join(root, settings.stateDir)
  return {
    stateDir,
    lock: join(stateDir, "apply.lock"),
    journal: join(stateDir, "journal.json"),
    backups: join(stateDir, "backup")
  }
}

function readJson<T>(path: string, schema: z.ZodType<T>): T | undefined {
  try {
    const result = schema.safeParse(JSON.parse(readFileSync(path, "utf8")))
    return result.success ? result.data : undefined
  } catch {
    return undefined
  }
}

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return errorCode(error) === "EPERM"
  }
}

/** A lock whose process is gone. Locks from another host count as stale after an hour. */
export function isStaleLock(info: ApplyLockInfo): boolean {
  if (info.host === hostname()) {
    return info.pid !== process.pid && !processAlive(info.pid)
  }
  return Date.now() - Date.parse(info.time) > 60 * 60 * 1000
}

function lockedError(path: string, info: ApplyLockInfo | undefined, product: string): PlanError {
  if (info && isStaleLock(info)) {
    return new PlanError(
      "E_LOCKED",
      `A previous apply (process ${info.pid} on ${info.host}, started ${info.time}) stopped without finishing.`,
      {
        paths: [path],
        next: [`${product} recover`]
      }
    )
  }
  const holder = info ? `process ${info.pid} on ${info.host}, since ${info.time}` : "another process"
  return new PlanError("E_LOCKED", `Another apply is running (${holder}). Try again when it finishes.`, {
    paths: [path]
  })
}

function acquireLock(root: string, settings: ProductSettings, fingerprint: string): string[] {
  const paths = statePaths(root, settings)
  if (statSync(paths.journal, { throwIfNoEntry: false })) {
    throw new PlanError(
      "E_INTERRUPTED",
      "A previous apply was interrupted. Roll it back before changing anything else.",
      {
        paths: [paths.journal],
        next: [`${settings.product} recover`]
      }
    )
  }
  const created = ensureParent(paths.lock)
  const info: ApplyLockInfo = { pid: process.pid, host: hostname(), time: new Date().toISOString(), fingerprint }
  try {
    writeFileSync(paths.lock, `${JSON.stringify(info)}\n`, { flag: "wx" })
  } catch (error) {
    if (errorCode(error) === "EEXIST") {
      throw lockedError(paths.lock, readJson(paths.lock, lockInfoSchema), settings.product)
    }
    throw error
  }
  return created
}

function releaseLock(root: string, settings: ProductSettings) {
  try {
    unlinkSync(statePaths(root, settings).lock)
  } catch {
    // Already released.
  }
}

function currentContent(root: string, path: string): string | undefined {
  const state = readSafely(root, path)
  if (state.kind === "unsafe") {
    throw new PlanError("E_UNSAFE_PATH", `${path} can't be written: ${state.reason}`, { paths: [path] })
  }
  return state.kind === "file" ? state.content : undefined
}

/** Lock last, config before it: if a run stops early, the lock never describes files that weren't written. */
function applyOrder(operations: Operation[]): Operation[] {
  const ranks: Partial<Record<string, number>> = { config: 1, lock: 2 }
  const rank = (operation: Operation) => ranks[operation.class] ?? 0
  return [...operations].sort((left, right) => rank(left) - rank(right))
}

/**
 * Applies a planned plan. It holds the apply lock, refuses if any file changed since planning, journals each step,
 * backs up what it overwrites or deletes, and writes the lock last. If a step fails, it rolls back what this run did.
 */
export async function applyPlan(
  plan: Plan,
  options: ApplyOptions
): Promise<{ status: "applied" | "unchanged"; written: string[] }> {
  if (plan.status === "unchanged") {
    return { status: "unchanged", written: [] }
  }
  if (plan.status !== "planned") {
    throw new PlanError("E_USAGE", `Only a planned plan can be applied, and this one is ${plan.status}.`)
  }
  const { root, settings } = options
  const rootFolders = ensureFolder(root)
  const lockFolders = acquireLock(root, settings, plan.fingerprint)
  const paths = statePaths(root, settings)
  const operations = applyOrder(plan.operations)
  const journal: Journal = { fingerprint: plan.fingerprint, started: new Date().toISOString(), entries: [] }
  const written: string[] = []
  try {
    const drifted = operations.filter((operation) => currentContent(root, operation.path) !== operation.before)
    if (drifted.length > 0) {
      throw new PlanError(
        "E_DRIFT",
        `${drifted.map((operation) => operation.path).join(", ")} changed after the plan was made. Plan again.`,
        {
          paths: drifted.map((operation) => operation.path)
        }
      )
    }
    const backupRoot = join(paths.backups, plan.fingerprint.slice(0, 16))
    for (const operation of operations) {
      const target = join(root, operation.path)
      const entry: JournalEntry = {
        path: operation.path,
        action: operation.action,
        beforeHash: rawHash(operation.before),
        afterHash: rawHash(operation.content),
        createdFolders: []
      }
      if (operation.before !== undefined && !operation.secret) {
        const backup = join(backupRoot, operation.path)
        ensureParent(backup)
        await writeAtomic(backup, operation.before)
        entry.backup = backup
      }
      if (operation.action === "create") {
        entry.createdFolders = ensureParent(target)
      }
      journal.entries.push(entry)
      await writeAtomic(paths.journal, `${JSON.stringify(journal)}\n`)
      if (operation.action === "delete") {
        await removeFile(target)
      } else if (operation.content !== undefined) {
        if (operation.action === "create") {
          await createExclusive(target, operation.content)
        } else {
          await writeAtomic(target, operation.content)
        }
      }
      written.push(operation.path)
      options.hooks?.afterWrite?.(operation.path)
    }
  } catch (error) {
    if (journal.entries.length > 0) {
      await rollback(root, journal)
    }
    await removeFile(paths.journal).catch(() => undefined)
    releaseLock(root, settings)
    removeEmptyFolders([...rootFolders, ...lockFolders])
    if (error instanceof PlanError) {
      throw error
    }
    throw new PlanError(
      "E_INTERNAL",
      `Apply failed and was rolled back: ${error instanceof Error ? error.message : String(error)}`
    )
  }
  await removeFile(paths.journal)
  if (options.secrets && Object.keys(options.secrets).length > 0) {
    await writeSecretsFile(root, settings, options.secrets)
  }
  releaseLock(root, settings)
  return { status: "applied", written }
}

async function writeSecretsFile(root: string, settings: ProductSettings, secrets: Record<string, string>) {
  const path = join(root, settings.secretsFile)
  let text = currentContent(root, settings.secretsFile)
  for (const [name, value] of Object.entries(secrets)) {
    text = setEnvValue(text, name, value)
  }
  if (text !== undefined) {
    ensureParent(path)
    await writeAtomic(path, text, 0o600)
  }
}

async function rollback(root: string, journal: Journal): Promise<RollbackReport> {
  const report: RollbackReport = { restored: [], unchanged: [], changed: [], removedFolders: [] }
  for (const entry of [...journal.entries].reverse()) {
    const target = join(root, entry.path)
    const state = readSafely(root, entry.path)
    const current = state.kind === "file" ? state.content : undefined
    const hash = state.kind === "unsafe" ? "unsafe" : rawHash(current)
    if (hash === entry.afterHash && hash !== entry.beforeHash) {
      if (entry.action === "create") {
        await removeFile(target)
        report.restored.push(entry.path)
      } else if (entry.backup) {
        ensureParent(target)
        await writeAtomic(target, readFileSync(entry.backup, "utf8"))
        report.restored.push(entry.path)
      } else {
        report.changed.push(entry.path)
      }
    } else if (hash === entry.beforeHash) {
      report.unchanged.push(entry.path)
    } else {
      report.changed.push(entry.path)
    }
    report.removedFolders.push(...removeEmptyFolders(entry.createdFolders))
  }
  return report
}

/** Rolls back an interrupted apply from its journal, and clears a stale apply lock. */
export async function recover(
  root: string,
  settings: ProductSettings
): Promise<{ status: "recovered" | "unchanged"; report: RollbackReport }> {
  const paths = statePaths(root, settings)
  const empty: RollbackReport = { restored: [], unchanged: [], changed: [], removedFolders: [] }
  const info = statSync(paths.lock, { throwIfNoEntry: false }) ? readJson(paths.lock, lockInfoSchema) : undefined
  if (info && !isStaleLock(info)) {
    throw lockedError(paths.lock, info, settings.product)
  }
  const journal = statSync(paths.journal, { throwIfNoEntry: false })
    ? readJson(paths.journal, journalSchema)
    : undefined
  if (!journal) {
    const hadState =
      statSync(paths.journal, { throwIfNoEntry: false }) !== undefined ||
      statSync(paths.lock, { throwIfNoEntry: false }) !== undefined
    await removeFile(paths.journal).catch(() => undefined)
    releaseLock(root, settings)
    return { status: hadState ? "recovered" : "unchanged", report: empty }
  }
  const report = await rollback(root, journal)
  await removeFile(paths.journal)
  releaseLock(root, settings)
  return { status: "recovered", report }
}
