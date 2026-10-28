import { createHash, randomBytes } from "node:crypto"
import { linkSync, mkdirSync, readdirSync, renameSync, rmdirSync, statSync, unlinkSync, writeFileSync } from "node:fs"
import { basename, dirname, join } from "node:path"
import { setTimeout as delay } from "node:timers/promises"

const retryCodes = new Set(["EPERM", "EACCES", "EBUSY"])

export function errorCode(error: unknown): string | undefined {
  return error instanceof Error && "code" in error && typeof error.code === "string" ? error.code : undefined
}

/** Exact hash of a file's bytes, for the journal. `absent` when the file doesn't exist. */
export function rawHash(content: string | undefined): string {
  return content === undefined ? "absent" : createHash("sha256").update(content).digest("hex")
}

/** Retries operations that Windows fails while another process, such as an indexer or antivirus, holds the file. */
export async function withRetries<T>(operation: () => T, attempts = 8): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return operation()
    } catch (error) {
      const code = errorCode(error)
      if (attempt >= attempts - 1 || code === undefined || !retryCodes.has(code)) {
        throw error
      }
      await delay(10 * 2 ** attempt)
    }
  }
}

function tempPath(path: string): string {
  return join(dirname(path), `.${basename(path)}.${randomBytes(6).toString("hex")}.tmp`)
}

/** Creates the folders above a file, returning the ones it created, outermost first. */
export function ensureParent(path: string): string[] {
  return ensureFolder(dirname(path))
}

/** Creates a folder and its missing parents, returning the ones it created, outermost first. */
export function ensureFolder(path: string): string[] {
  const created: string[] = []
  let folder = path
  while (statSync(folder, { throwIfNoEntry: false }) === undefined) {
    created.unshift(folder)
    folder = dirname(folder)
  }
  for (const entry of created) {
    mkdirSync(entry)
  }
  return created
}

/** Writes through a temp file in the same folder, then renames it into place. */
export async function writeAtomic(path: string, content: string, mode?: number): Promise<void> {
  const temp = tempPath(path)
  writeFileSync(temp, content, { flag: "wx", ...(mode === undefined ? {} : { mode }) })
  try {
    await withRetries(() => renameSync(temp, path))
  } catch (error) {
    unlinkSync(temp)
    throw error
  }
}

/**
 * Creates a file only if it doesn't exist: writes a temp file, then hard-links it into place, which fails if the path
 * appeared meanwhile. File systems without hard links fall back to an exclusive open.
 */
export async function createExclusive(path: string, content: string): Promise<void> {
  const temp = tempPath(path)
  writeFileSync(temp, content, { flag: "wx" })
  try {
    linkSync(temp, path)
  } catch (error) {
    const code = errorCode(error)
    if (code === "EEXIST") {
      unlinkSync(temp)
      throw error
    }
    unlinkSync(temp)
    writeFileSync(path, content, { flag: "wx" })
    return
  }
  await withRetries(() => unlinkSync(temp))
}

export async function removeFile(path: string): Promise<void> {
  await withRetries(() => unlinkSync(path))
}

/** Removes folders this run created, innermost first, while they're empty. */
export function removeEmptyFolders(folders: readonly string[]): string[] {
  const removed: string[] = []
  for (const folder of [...folders].reverse()) {
    try {
      if (readdirSync(folder).length === 0) {
        rmdirSync(folder)
        removed.push(folder)
      }
    } catch {
      // Already gone, or not empty: leave it.
    }
  }
  return removed
}
