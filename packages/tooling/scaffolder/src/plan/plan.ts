import { diffLines } from "diff"
import { jsonLayoutFor } from "../edit/layout.js"
import { catalogVersionText, findAddon, lookupAddon, sameCatalogVersion } from "../manifest/catalog.js"
import type { CatalogManifest, PackRecord, TargetContext } from "../manifest/types.js"
import { jsonFormat, yamlFormat } from "../merge/formats.js"
import { planSharedDocument, planSharedEnv, planSharedLines, type SharedResult } from "../merge/shared.js"
import { planFile } from "../ownership/files.js"
import { applyStyle, normalizeText, sha256, textStyle } from "../ownership/text.js"
import { resolveSelection, type ResolvedSelection, type Selection } from "../resolve/resolve.js"
import { lockEqual, readConfig, readLock, renderConfig, updateConfig, writeLock } from "../state/files.js"
import {
  lockSchemaVersion,
  type Lock,
  type LockFileEntry,
  type ProjectConfig,
  type SharedFormat
} from "../state/schemas.js"
import { lockPath, type ProductSettings } from "../state/settings.js"
import { pendingMigrations, runMigrations } from "../upgrade/migrations.js"
import { engineVersion } from "../version.js"
import { issueDecision } from "./decisions.js"
import { desiredSelection, selectionFromLock } from "./desired.js"
import { errorInfo, PlanError } from "./errors.js"
import { canonicalJson, compareText, isRecord, parsePointer } from "./json.js"
import { render, type Rendered } from "./render.js"
import { RecordingTree, ScratchTree, type FileState, type VirtualTree } from "./tree.js"
import type {
  Intent,
  Operation,
  OperationClass,
  PackageChange,
  Plan,
  PlanConflict,
  PlanRequest,
  Resolution
} from "./types.js"

export interface PlanInput {
  catalog: CatalogManifest
  request: PlanRequest
  tree: VirtualTree
  settings: ProductSettings
  /**
   * Earlier catalog versions, with the template package versions the lock records merged in, for old baselines and
   * `--catalog-version`. Returns `undefined` when unavailable.
   */
  catalogs?: (version: string, packs?: Record<string, PackRecord>) => CatalogManifest | undefined
  /** Integrity of the installed catalog, recorded in the lock. */
  catalogIntegrity?: string
}

const secretPath = /(?:^|\/)(?:\.env(?!\.example$)(?:\..+)?|\.dev\.vars)$/

function emptyPlan(input: PlanInput): Plan {
  return {
    status: "unchanged",
    request: input.request,
    fingerprint: "",
    catalog: { id: input.catalog.id, version: input.catalog.version },
    operations: [],
    decisions: [],
    conflicts: [],
    pulled: [],
    required: [],
    packages: [],
    env: [],
    commands: [],
    migrations: [],
    notices: [],
    nextSteps: [],
    merged: []
  }
}

/**
 * Plans a request as a pure function of the catalog and the project tree. It never throws for expected problems:
 * decisions, conflicts and errors come back in the plan.
 */
export async function plan(input: PlanInput): Promise<Plan> {
  const tree = new RecordingTree(input.tree)
  const result = emptyPlan(input)
  try {
    await planInto(input, tree, result)
  } catch (error) {
    result.status = "error"
    result.error = errorInfo(error)
    result.operations = []
    delete result.lock
  }
  if (result.status !== "error") {
    result.status = statusOf(result)
  }
  result.fingerprint = await fingerprint(result, tree)
  const lockOperation = result.operations.find((operation) => operation.class === "lock")
  if (lockOperation && result.lock) {
    result.lock = { ...result.lock, lastApply: { fingerprint: result.fingerprint } }
    lockOperation.content = writeLock(result.lock)
  }
  return result
}

function statusOf(result: Plan): Plan["status"] {
  if (result.decisions.length > 0) {
    return "needs-decision"
  }
  if (result.conflicts.length > 0) {
    return "conflict"
  }
  return result.operations.length > 0 ? "planned" : "unchanged"
}

function stateText(tree: RecordingTree, path: string): string | undefined {
  const state = tree.read(path)
  if (state.kind === "unsafe") {
    throw new PlanError("E_UNSAFE_PATH", `${path} can't be read: ${state.reason}`, { paths: [path] })
  }
  return state.kind === "file" ? state.content : undefined
}

/**
 * The add-ons an add can carry into the upgrade it has to wait for. Only a plain add can: slot names, replacements and
 * options need the add itself, so for those the user adds again after upgrading.
 */
function carriedAdditions(catalog: CatalogManifest, intent: Intent): string[] {
  if (intent.command !== "add" || intent.replace.length > 0 || Object.keys(intent.options).length > 0) {
    return []
  }
  const ids = intent.addons
    .map((name) => lookupAddon(catalog, name))
    .map((lookup) => ("id" in lookup ? lookup.id : undefined))
  return ids.every((id): id is string => id !== undefined) ? ids : []
}

async function planInto(input: PlanInput, tree: RecordingTree, result: Plan) {
  const { request, settings } = input
  const configPath = settings.configFile
  const lockFile = lockPath(settings)
  const configText = stateText(tree, configPath)
  const lockText = stateText(tree, lockFile)
  const config = configText === undefined ? undefined : readConfig(configPath, configText)
  const lock = lockText === undefined ? undefined : readLock(lockFile, lockText)
  let catalog = input.catalog
  if (request.catalogVersion !== undefined && request.catalogVersion !== catalog.version) {
    const pinned = input.catalogs?.(request.catalogVersion, lock?.catalog.packs)
    if (!pinned) {
      throw new PlanError(
        "E_BASELINE_UNAVAILABLE",
        `Catalog ${catalog.id}@${request.catalogVersion} isn't available. Fetch it first.`,
        {
          next: [`${settings.product} catalog fetch ${request.catalogVersion}`]
        }
      )
    }
    catalog = pinned
  }
  result.catalog = { id: catalog.id, version: catalog.version }
  if (config && config.catalog !== catalog.id) {
    throw new PlanError(
      "E_INVALID_STATE",
      `${configPath} uses catalog ${config.catalog}, and this CLI provides ${catalog.id}.`,
      { paths: [configPath] }
    )
  }
  const command = request.intent.command
  if (lock && command !== "upgrade" && !sameCatalogVersion(lock.catalog, catalog)) {
    const recorded = lock.catalog.version
    const carried = carriedAdditions(catalog, request.intent)
    result.decisions.push({
      id: "catalog-mismatch",
      message: `This project was planned with catalog ${catalogVersionText(lock.catalog)}, and ${catalogVersionText(catalog)} is installed. Upgrade first, or plan with ${recorded}.`,
      choices: [
        {
          id: "upgrade",
          label:
            carried.length > 0
              ? `Upgrade to ${catalog.version} and add ${carried.map((id) => findAddon(catalog, id)?.title ?? id).join(", ")}`
              : `Upgrade to ${catalog.version}`,
          request: { intent: { command: "upgrade", ...(carried.length > 0 ? { addons: carried } : {}) } }
        },
        ...(input.catalogs?.(recorded, lock.catalog.packs)
          ? [{ id: "recorded", label: `Plan with ${recorded}`, request: { ...request, catalogVersion: recorded } }]
          : [])
      ]
    })
    return
  }
  const desired = desiredSelection(catalog, request.intent, config, lock)
  if (!desired.ok) {
    result.decisions.push(issueDecision(catalog, request, desired.issue))
    return
  }
  const selection = desired.selection
  // The plan lists what it brings in, so add-ons the lock already records aren't listed again.
  const installed = new Set(Object.keys(lock?.addons ?? {}))
  result.required = desired.required.filter((id) => !installed.has(id))
  const scratch = new ScratchTree(tree)
  if (command === "upgrade" && lock) {
    const pending = Object.entries(lock.addons).flatMap(([id, state]) => {
      const addon = findAddon(catalog, id)
      return addon ? pendingMigrations(addon, state.version, addon.version) : []
    })
    const migrated = runMigrations(pending, selection.addons, scratch)
    selection.addons = migrated.options
    result.migrations = migrated.notes
  }
  const resolution = resolveSelection(catalog, selection)
  if (!resolution.ok) {
    result.decisions.push(issueDecision(catalog, request, resolution.issue))
    return
  }
  const resolved = resolution.value
  result.pulled = resolved.addons
    .filter((addon) => !addon.explicit && !installed.has(addon.manifest.id))
    .map((addon) => ({ id: addon.manifest.id, by: addon.by }))
  if (desired.adopt) {
    const context: TargetContext = {
      target: resolved.info,
      project: { name: resolved.name },
      versions: catalog.versions ?? {},
      version: (name) => catalog.versions?.[name] ?? ""
    }
    resolved.target.adopt?.(scratch, context)
  }
  const next = render(catalog, resolved, settings)
  result.env = next.envVars
  result.commands = next.commands
  result.notices.push(...next.notices)
  result.nextSteps = next.nextSteps
  const old = lock ? oldBaseline(input, catalog, lock, result) : undefined
  if (lock && command === "upgrade") {
    result.upgrade = upgradeSummary(lock, catalog, resolved)
  }
  const entries: Record<string, LockFileEntry> = {}
  const deleted = new Set<string>()
  const paths = new Set<string>([
    ...next.files.keys(),
    ...next.documents.keys(),
    ...next.lines.keys(),
    ...next.env.keys(),
    ...(old?.files.keys() ?? []),
    ...Object.keys(lock?.files ?? {}),
    ...scratch.changes.keys()
  ])
  paths.delete(configPath)
  paths.delete(lockFile)
  const resolve = request.resolve ?? {}
  for (const path of [...paths].sort()) {
    const original = tree.read(path)
    const current = currentState(scratch, original, path)
    const entry = lock?.files[path]
    const shared = entry?.class === "shared" ? entry : undefined
    const outcome = await planPath({
      path,
      current,
      entry,
      shared,
      next,
      old,
      lock,
      input,
      resolve,
      adopt: desired.adopt
    })
    result.conflicts.push(...outcome.conflicts)
    if (outcome.notice) {
      result.notices.push(outcome.notice)
    }
    if (outcome.mergedHunks) {
      result.merged.push({ path, hunks: outcome.mergedHunks })
    }
    if (outcome.entry) {
      entries[path] = outcome.entry
    }
    if (outcome.deleted) {
      deleted.add(path)
    }
    let finalContent = current.text
    if (outcome.content === null) {
      finalContent = undefined
    } else if (outcome.content !== undefined) {
      finalContent = outcome.content
    }
    pushOperation(result, path, original, finalContent, outcome.class ?? classOf(entry, next, path))
  }
  result.packages = packageChanges(next, lock)
  const nextConfig = configFor(selection, catalog, config)
  const nextConfigText =
    config && configText !== undefined
      ? updateConfig(configText, config, nextConfig, settings)
      : renderConfig(nextConfig, settings)
  pushOperation(result, configPath, tree.read(configPath), nextConfigText, "config")
  let integrity: string | undefined
  if (catalog === input.catalog && input.catalogIntegrity) {
    integrity = input.catalogIntegrity
  } else if (lock?.catalog.version === catalog.version) {
    integrity = lock.catalog.integrity
  }
  const nextLock: Lock = {
    schemaVersion: lockSchemaVersion,
    engine: engineVersion,
    catalog: {
      id: catalog.id,
      version: catalog.version,
      ...(integrity ? { integrity } : {}),
      ...(catalog.packs && Object.keys(catalog.packs).length > 0 ? { packs: catalog.packs } : {})
    },
    project: {
      name: resolved.name,
      template: resolved.template.id,
      target: { id: resolved.target.id, mode: resolved.mode.id },
      declined: resolved.declined
    },
    addons: Object.fromEntries(
      resolved.addons.map((addon) => [
        addon.manifest.id,
        { version: addon.manifest.version, options: addon.options, explicit: addon.explicit, by: addon.by }
      ])
    ),
    files: entries,
    deleted: [...deleted].sort(),
    ...(lock?.lastApply ? { lastApply: lock.lastApply } : {})
  }
  result.lock = nextLock
  if (!lockEqual(nextLock, lock)) {
    pushOperation(result, lockFile, tree.read(lockFile), writeLock(nextLock), "lock")
  }
}

interface PathOutcome {
  /** New text; `null` deletes the file; `undefined` leaves it as it is. */
  content: string | null | undefined
  entry?: LockFileEntry
  deleted?: boolean
  conflicts: PlanConflict[]
  notice?: Plan["notices"][number]
  mergedHunks?: number
  class?: OperationClass
}

async function planPath(context: {
  path: string
  current: { state: FileState; text: string | undefined }
  entry: LockFileEntry | undefined
  shared: Extract<LockFileEntry, { class: "shared" }> | undefined
  next: Rendered
  old: Rendered | undefined
  lock: Lock | undefined
  input: PlanInput
  resolve: Record<string, Resolution>
  adopt: boolean
}): Promise<PathOutcome> {
  const { path, current, entry, shared, next, old, lock, resolve } = context
  if (current.state.kind === "unsafe") {
    throw new PlanError("E_UNSAFE_PATH", `${path} can't be managed: ${current.state.reason}`, { paths: [path] })
  }
  const document = next.documents.get(path)
  const lines = next.lines.get(path)
  const env = next.env.get(path)
  const file = next.files.get(path)
  const styled = (text: string | undefined): string | null | undefined =>
    text === undefined ? undefined : applyStyle(normalizeText(text), textStyle(current.text))
  const fromShared = (outcome: SharedResult): PathOutcome => ({
    content: styled(outcome.text),
    ...(outcome.entry ? { entry: outcome.entry } : {}),
    conflicts: outcome.conflicts,
    class: "shared"
  })
  const sharedFormat = sharedFormatOf(document?.format, lines !== undefined, env !== undefined, shared?.format)
  if (!file && sharedFormat !== undefined) {
    const sharedEntry = shared && shared.format === sharedFormat ? shared : undefined
    const currentText = current.text === undefined ? undefined : normalizeText(current.text)
    if (sharedFormat === "json" || sharedFormat === "yaml") {
      return fromShared(
        planSharedDocument({
          path,
          format:
            sharedFormat === "json" ? jsonFormat(jsonLayoutFor(path, context.input.settings.printWidth)) : yamlFormat,
          current: currentText,
          desired: document?.desired,
          entry: sharedEntry,
          resolve,
          packageJson: path === "package.json" || path.endsWith("/package.json")
        })
      )
    }
    if (sharedFormat === "lines") {
      return fromShared(planSharedLines({ path, current: currentText, desired: lines, entry: sharedEntry, resolve }))
    }
    return fromShared(planSharedEnv({ path, current: currentText, desired: env, entry: sharedEntry, resolve }))
  }
  if (!file && !entry) {
    return { content: undefined, conflicts: [], class: "user" }
  }
  const outcome = await planFile({
    path,
    current: current.state,
    incoming: file,
    old: old?.files.get(path),
    entry: shared ? undefined : entry,
    deleted: lock?.deleted.includes(path) ?? false,
    resolution: resolve[path],
    conflictStyle: context.input.request.conflictStyle ?? "stop",
    adopt: context.adopt,
    storeBases: context.input.settings.seedBases === "stored"
  })
  return {
    content: outcome.remove ? null : styled(outcome.write),
    ...(outcome.entry ? { entry: outcome.entry } : {}),
    ...(outcome.deleted ? { deleted: true } : {}),
    conflicts: outcome.conflict ? [outcome.conflict] : [],
    ...(outcome.notice ? { notice: outcome.notice } : {}),
    ...(outcome.mergedHunks ? { mergedHunks: outcome.mergedHunks } : {}),
    class: file?.ownership ?? (entry && entry.class !== "shared" ? entry.class : "user")
  }
}

function sharedFormatOf(
  document: SharedFormat | undefined,
  lines: boolean,
  env: boolean,
  recorded: SharedFormat | undefined
): SharedFormat | undefined {
  if (document) {
    return document
  }
  if (lines) {
    return "lines"
  }
  return env ? "env" : recorded
}

function currentState(
  scratch: ScratchTree,
  original: FileState,
  path: string
): { state: FileState; text: string | undefined } {
  if (scratch.changes.has(path)) {
    const text = scratch.changes.get(path)
    return { state: text === undefined ? { kind: "absent" } : { kind: "file", content: text }, text }
  }
  return { state: original, text: original.kind === "file" ? original.content : undefined }
}

function classOf(entry: LockFileEntry | undefined, next: Rendered, path: string): OperationClass {
  return next.files.get(path)?.ownership ?? entry?.class ?? "user"
}

function pushOperation(
  result: Plan,
  path: string,
  original: FileState,
  finalContent: string | undefined,
  operationClass: OperationClass
) {
  const before = original.kind === "file" ? original.content : undefined
  if (before === finalContent) {
    return
  }
  let action: Operation["action"] = "update"
  if (before === undefined) {
    action = "create"
  } else if (finalContent === undefined) {
    action = "delete"
  }
  let linesAdded = 0
  let linesRemoved = 0
  for (const change of diffLines(normalizeText(before ?? ""), normalizeText(finalContent ?? ""))) {
    if (change.added) {
      linesAdded += change.count
    } else if (change.removed) {
      linesRemoved += change.count
    }
  }
  result.operations.push({
    path,
    action,
    class: operationClass,
    linesAdded,
    linesRemoved,
    ...(finalContent === undefined ? {} : { content: finalContent }),
    ...(before === undefined ? {} : { before }),
    ...(secretPath.test(path) ? { secret: true } : {})
  })
}

function oldBaseline(input: PlanInput, catalog: CatalogManifest, lock: Lock, result: Plan): Rendered | undefined {
  const recorded = lock.catalog.version
  // Without the old render, seeds merge against the bases stored in the lock, when the product stores them.
  const fallback = input.settings.seedBases === "stored" ? "stored" : "two-way"
  const oldCatalog =
    [catalog, input.catalog].find((candidate) => sameCatalogVersion(candidate, lock.catalog)) ??
    input.catalogs?.(recorded, lock.catalog.packs)
  if (!oldCatalog) {
    result.baseline = { source: fallback, catalogVersion: recorded }
    return undefined
  }
  try {
    const resolution = resolveSelection(oldCatalog, selectionFromLock(lock))
    if (!resolution.ok) {
      result.baseline = { source: fallback, catalogVersion: recorded }
      return undefined
    }
    result.baseline = {
      source: oldCatalog === catalog || oldCatalog === input.catalog ? "installed" : "cache",
      catalogVersion: recorded
    }
    return render(oldCatalog, resolution.value, input.settings)
  } catch {
    result.baseline = { source: fallback, catalogVersion: recorded }
    return undefined
  }
}

function upgradeSummary(lock: Lock, catalog: CatalogManifest, resolved: ResolvedSelection): Plan["upgrade"] {
  const ids = new Set([...Object.keys(lock.addons), ...resolved.addons.map((addon) => addon.manifest.id)])
  const addons = [...ids]
    .sort()
    .map((id) => {
      const from = lock.addons[id]?.version
      const to = resolved.addons.find((addon) => addon.manifest.id === id)?.manifest.version
      return { id, ...(from === undefined ? {} : { from }), ...(to === undefined ? {} : { to }) }
    })
    .filter((addon) => addon.from !== addon.to)
  const names = new Set([...Object.keys(lock.catalog.packs ?? {}), ...Object.keys(catalog.packs ?? {})])
  const packs = [...names]
    .sort()
    .map((name) => {
      const from = lock.catalog.packs?.[name]?.version
      const to = catalog.packs?.[name]?.version
      return { name, ...(from === undefined ? {} : { from }), ...(to === undefined ? {} : { to }) }
    })
    .filter((pack) => pack.from !== pack.to)
  return { catalog: { from: lock.catalog.version, to: catalog.version }, packs, addons }
}

const dependencySections = new Set(["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"])

function packageChanges(next: Rendered, lock: Lock | undefined): PackageChange[] {
  const desired = next.documents.get("package.json")?.desired.keys ?? new Map()
  const recorded = lock?.files["package.json"]
  const base = recorded?.class === "shared" ? recorded.keys : {}
  const pointers = new Set([...desired.keys(), ...Object.keys(base)])
  const changes: PackageChange[] = []
  for (const pointer of [...pointers].sort()) {
    const [section, name, ...rest] = parsePointer(pointer)
    if (!section || !name || rest.length > 0 || !dependencySections.has(section)) {
      continue
    }
    const to = desired.get(pointer)?.value
    const state = base[pointer]
    const from = state?.base
    if (canonicalJson(from) === canonicalJson(to)) {
      continue
    }
    changes.push({
      name,
      section,
      ...(typeof from === "string" ? { from } : {}),
      ...(typeof to === "string" ? { to } : {})
    })
  }
  return changes
}

function configFor(selection: Selection, catalog: CatalogManifest, existing: ProjectConfig | undefined): ProjectConfig {
  return {
    ...existing,
    catalog: catalog.id,
    name: selection.name,
    template: selection.template,
    target: selection.target,
    addons: selection.addons,
    declined: selection.declined.length > 0 ? [...selection.declined].sort() : undefined
  }
}

async function fingerprint(result: Plan, tree: RecordingTree): Promise<string> {
  const reads: [string, string][] = []
  for (const [path, state] of [...tree.reads].sort(([left], [right]) => compareText(left, right))) {
    let hash = state.kind === "absent" ? "absent" : `unsafe:${state.kind === "unsafe" ? state.reason : ""}`
    if (state.kind === "file") {
      hash = await sha256(state.content)
    }
    reads.push([path, hash])
  }
  const operations: [string, string, string][] = []
  for (const operation of result.operations) {
    const content =
      operation.class === "lock" && result.lock
        ? writeLock({ ...result.lock, lastApply: undefined })
        : operation.content
    operations.push([operation.path, operation.action, content === undefined ? "" : await sha256(content)])
  }
  return sha256(
    canonicalJson({
      engine: engineVersion,
      catalog: result.catalog,
      request: result.request,
      status: result.status,
      reads,
      operations,
      decisions: result.decisions.map((decision) => decision.id),
      conflicts: result.conflicts.map((conflict) => conflict.id),
      error: isRecord(result.error) ? result.error.code : undefined
    })
  )
}
