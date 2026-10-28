import type { Ownership } from "../manifest/types.js"
import { mergeText } from "../merge/text.js"
import { PlanError } from "../plan/errors.js"
import type { RenderedFile } from "../plan/render.js"
import type { FileState } from "../plan/tree.js"
import type { Notice, PlanConflict, Resolution } from "../plan/types.js"
import type { LockFileEntry } from "../state/schemas.js"
import { hashText } from "./text.js"

type FileEntry = Exclude<LockFileEntry, { class: "shared" }>

export interface FileOutcome {
  /** New content to write, normalized. The caller applies the file's line endings. */
  write?: string
  remove?: boolean
  entry?: FileEntry
  /** Record that you deleted this file, so it stays deleted. */
  deleted?: boolean
  conflict?: PlanConflict
  notice?: Notice
  mergedHunks?: number
}

export interface FileInput {
  path: string
  current: FileState
  incoming: RenderedFile | undefined
  /** The same path in the old baseline: what the engine wrote last time, regenerated. */
  old: RenderedFile | undefined
  entry: LockFileEntry | undefined
  deleted: boolean
  resolution: Resolution | undefined
  conflictStyle: "stop" | "markers"
  /** Adopting a project: a contributed path that already exists stays yours. */
  adopt: boolean
}

function newEntry(ownership: Ownership, genHash: string, diskHash: string, contributors: string[]): FileEntry {
  switch (ownership) {
    case "owned":
      return { class: "owned", genHash, diskHash, contributors }
    case "seed":
      return { class: "seed", genHash, diskHash }
    case "sample":
      return { class: "sample", genHash }
  }
}

function diskHashOf(entry: FileEntry): string {
  return entry.class === "sample" ? entry.genHash : entry.diskHash
}

function conflict(
  input: FileInput,
  kind: PlanConflict["kind"],
  message: string,
  artifacts: { base?: string; current?: string; incoming?: string } = {}
): FileOutcome {
  return {
    conflict: {
      id: input.path,
      path: input.path,
      kind,
      message,
      ...artifacts,
      resolutions:
        kind === "orphan-edited" || kind === "deleted"
          ? ["keep-current", "take-incoming"]
          : ["keep-current", "take-incoming", "file"]
    }
  }
}

/**
 * Plans one file under the ownership rule: create a path only if it's absent; overwrite or delete only while the file
 * still hashes to what the engine last wrote; anything else is a conflict that `--yes` can't answer.
 */
export async function planFile(input: FileInput): Promise<FileOutcome> {
  const { path, incoming, resolution } = input
  if (input.current.kind === "unsafe") {
    throw new PlanError("E_UNSAFE_PATH", `${path} can't be managed: ${input.current.reason}`, { paths: [path] })
  }
  const current = input.current.kind === "file" ? input.current.content : undefined
  const currentHash = current === undefined ? undefined : await hashText(current)
  const recorded = input.entry?.class === "shared" ? undefined : input.entry
  if (!incoming) {
    return planOrphan(input, recorded, current, currentHash)
  }
  const incomingHash = await hashText(incoming.content)
  const fresh = (diskHash = incomingHash) => newEntry(incoming.ownership, incomingHash, diskHash, incoming.contributors)
  if (typeof resolution === "object") {
    return { write: resolution.content, entry: fresh(await hashText(resolution.content)) }
  }
  let entry = recorded
  if (entry && entry.class !== incoming.ownership) {
    const unchanged = currentHash === undefined || currentHash === diskHashOf(entry)
    if (!unchanged && resolution === undefined) {
      return conflict(
        input,
        "class-change",
        `${path} changes from ${entry.class} to ${incoming.ownership}, but you edited it.`,
        {
          ...(current === undefined ? {} : { current }),
          incoming: incoming.content
        }
      )
    }
    entry =
      unchanged && currentHash !== undefined
        ? newEntry(incoming.ownership, entry.genHash, currentHash, incoming.contributors)
        : undefined
  }
  if (!entry) {
    if (input.deleted) {
      return { deleted: true, notice: { code: "stays-deleted", path, text: `${path} stays deleted, as you chose.` } }
    }
    if (current === undefined) {
      return { write: incoming.content, entry: fresh() }
    }
    if (currentHash === incomingHash) {
      return { entry: fresh() }
    }
    if (input.adopt) {
      return { notice: { code: "kept-yours", path, text: `${path} already exists, so it stays yours.` } }
    }
    if (resolution === "keep-current" && currentHash !== undefined) {
      return { entry: fresh(currentHash) }
    }
    if (resolution === "take-incoming") {
      return { write: incoming.content, entry: fresh() }
    }
    return conflict(
      input,
      "exists",
      `${path} already exists, and ${incoming.contributors.join(", ")} would create it.`,
      {
        current,
        incoming: incoming.content
      }
    )
  }
  if (entry.class === "sample") {
    if (current === undefined) {
      return { deleted: true }
    }
    return { entry }
  }
  if (current === undefined || currentHash === undefined) {
    if (entry.class === "seed") {
      return { deleted: true }
    }
    if (resolution === "keep-current") {
      return { deleted: true }
    }
    if (resolution === "take-incoming") {
      return { write: incoming.content, entry: fresh() }
    }
    return conflict(
      input,
      "deleted",
      `You deleted ${path}, which ${incoming.contributors.join(", ")} generates. Recreate it, or keep it deleted.`,
      {
        incoming: incoming.content
      }
    )
  }
  const engineChanged = incomingHash !== entry.genHash
  const diskUnchanged = currentHash === entry.diskHash
  if (!engineChanged) {
    if (!diskUnchanged && entry.class === "owned" && currentHash !== entry.genHash) {
      return {
        entry,
        notice: {
          code: "owned-edited",
          path,
          text: `You edited ${path}, which is generated. Move the change into an override.`
        }
      }
    }
    return { entry: entry.class === "owned" ? { ...entry, contributors: incoming.contributors } : entry }
  }
  if (currentHash === incomingHash) {
    return { entry: fresh() }
  }
  if (diskUnchanged && entry.diskHash === entry.genHash) {
    return { write: incoming.content, entry: fresh() }
  }
  if (resolution === "keep-current") {
    return { entry: fresh(currentHash) }
  }
  if (resolution === "take-incoming") {
    return { write: incoming.content, entry: fresh() }
  }
  if (entry.class === "owned") {
    return conflict(input, "edited", `You edited ${path}, and ${incoming.contributors.join(", ")} regenerates it.`, {
      current,
      incoming: incoming.content
    })
  }
  const base = input.old?.content
  if (base === undefined || (await hashText(base)) !== entry.genHash) {
    return conflict(
      input,
      "baseline-unverified",
      `${path} has your edits, and the version it started from can't be verified, so it can't be merged.`,
      {
        current,
        incoming: incoming.content
      }
    )
  }
  const merged = mergeText(current, base, incoming.content)
  if (merged.clean) {
    return { write: merged.content, entry: fresh(await hashText(merged.content)), mergedHunks: merged.hunks }
  }
  if (input.conflictStyle === "markers") {
    return {
      write: merged.content,
      entry: fresh(await hashText(merged.content)),
      notice: { code: "conflict-markers", path, text: `${path} has conflict markers. Resolve them, then run check.` }
    }
  }
  return conflict(input, "merge", `${path} has your edits and new changes in the same lines.`, {
    base,
    current,
    incoming: incoming.content
  })
}

async function planOrphan(
  input: FileInput,
  entry: FileEntry | undefined,
  current: string | undefined,
  currentHash: string | undefined
): Promise<FileOutcome> {
  const { path, resolution } = input
  if (!entry || entry.class === "sample" || current === undefined) {
    return {}
  }
  const verified = input.old !== undefined && (await hashText(input.old.content)) === entry.genHash
  if (!verified) {
    return {
      notice: {
        code: "orphan-kept",
        path,
        text: `${path} is no longer generated, and it can't be verified as ours, so it stays as yours.`
      }
    }
  }
  if (currentHash === entry.diskHash || resolution === "take-incoming") {
    return { remove: true }
  }
  if (resolution === "keep-current") {
    return {}
  }
  return conflict(
    input,
    "orphan-edited",
    `${path} is no longer needed, but you edited it. Delete it, or keep it as yours.`,
    { current }
  )
}
