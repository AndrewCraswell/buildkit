import type { MutableTree } from "../manifest/types.js"

export type FileState = { kind: "file"; content: string } | { kind: "absent" } | { kind: "unsafe"; reason: string }

/**
 * The project as the planner sees it. Reads are synchronous so the planner stays pure: the Node snapshot reads from
 * disk with path checks, and the dashboard passes an in-memory record.
 */
export interface VirtualTree {
  read(path: string): FileState
}

export function memoryTree(files: Readonly<Record<string, string>>): VirtualTree {
  return {
    read(path) {
      const content = files[path]
      return content === undefined ? { kind: "absent" } : { kind: "file", content }
    }
  }
}

/** Remembers every read, so the fingerprint covers exactly the files the plan depends on. */
export class RecordingTree implements VirtualTree {
  readonly reads = new Map<string, FileState>()
  readonly #tree: VirtualTree

  constructor(tree: VirtualTree) {
    this.#tree = tree
  }

  read(path: string): FileState {
    const cached = this.reads.get(path)
    if (cached) {
      return cached
    }
    const state = this.#tree.read(path)
    this.reads.set(path, state)
    return state
  }

  text(path: string): string | undefined {
    const state = this.read(path)
    return state.kind === "file" ? state.content : undefined
  }
}

/** An overlay that migrations and adoption codemods edit. The planner turns its changes into operations. */
export class ScratchTree implements MutableTree {
  readonly changes = new Map<string, string | undefined>()
  readonly #base: RecordingTree

  constructor(base: RecordingTree) {
    this.#base = base
  }

  read(path: string): string | undefined {
    return this.changes.has(path) ? this.changes.get(path) : this.#base.text(path)
  }

  write(path: string, content: string): void {
    this.changes.set(path, content)
  }

  delete(path: string): void {
    this.changes.set(path, undefined)
  }
}
