import type { FileClass } from "../manifest/types.js"
import { hashText } from "../ownership/text.js"
import { compareText } from "../plan/json.js"
import type { FileState } from "../plan/tree.js"
import { readLock } from "../state/files.js"
import { lockPath, type ProductSettings } from "../state/settings.js"
import { readSafely } from "./tree.js"

export interface FileStatus {
  path: string
  class: FileClass
  /** `edited` means the file differs from what the engine last wrote. */
  state: "unchanged" | "edited" | "missing" | "unsafe"
  contributors?: string[]
  keys?: number
}

export interface ProjectStatus {
  catalog?: { id: string; version: string }
  files: FileStatus[]
  deleted: string[]
}

async function diskState(disk: FileState, expected: string | undefined): Promise<FileStatus["state"]> {
  if (disk.kind === "absent") {
    return "missing"
  }
  if (disk.kind === "unsafe") {
    return "unsafe"
  }
  if (expected === undefined) {
    return "unchanged"
  }
  return (await hashText(disk.content)) === expected ? "unchanged" : "edited"
}

/** What the lock tracks, and how each file on disk compares with what the engine last wrote. */
export async function projectStatus(root: string, settings: ProductSettings, filter?: string): Promise<ProjectStatus> {
  const path = lockPath(settings)
  const state = readSafely(root, path)
  if (state.kind !== "file") {
    return { files: [], deleted: [] }
  }
  const lock = readLock(path, state.content)
  const files: FileStatus[] = []
  for (const [file, entry] of Object.entries(lock.files).sort(([left], [right]) => compareText(left, right))) {
    if (filter !== undefined && file !== filter && !file.startsWith(`${filter.replace(/\/$/, "")}/`)) {
      continue
    }
    const disk = readSafely(root, file)
    if (entry.class === "shared") {
      files.push({
        path: file,
        class: "shared",
        state: await diskState(disk, undefined),
        keys: Object.keys(entry.keys).length
      })
      continue
    }
    const expected = entry.class === "sample" ? entry.genHash : entry.diskHash
    const status = await diskState(disk, expected)
    files.push({
      path: file,
      class: entry.class,
      state: status,
      ...(entry.class === "owned" ? { contributors: entry.contributors } : {})
    })
  }
  return { catalog: { id: lock.catalog.id, version: lock.catalog.version }, files, deleted: lock.deleted }
}
