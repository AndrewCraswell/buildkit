import { lstatSync, readdirSync, readFileSync, realpathSync } from "node:fs"
import { join } from "node:path"
import { pathProblem } from "../plan/paths.js"
import type { FileState, VirtualTree } from "../plan/tree.js"

/**
 * A snapshot of the project on disk. Reads refuse unsafe paths, symlinked segments, hard links, non-files and names that
 * match an existing file only by case, so the planner never follows a path outside the project.
 */
export function nodeTree(root: string): VirtualTree {
  let base: string | undefined
  try {
    base = realpathSync(root)
  } catch {
    base = undefined
  }
  return {
    read(path) {
      return base === undefined ? { kind: "absent" } : readSafely(base, path)
    }
  }
}

export function readSafely(base: string, path: string): FileState {
  const problem = pathProblem(path)
  if (problem) {
    return { kind: "unsafe", reason: problem }
  }
  const segments = path.split("/")
  let current = base
  for (const [index, segment] of segments.entries()) {
    const next = join(current, segment)
    const stats = lstatSync(next, { throwIfNoEntry: false })
    if (!stats) {
      return { kind: "absent" }
    }
    const shown = segments.slice(0, index + 1).join("/")
    if (stats.isSymbolicLink()) {
      return { kind: "unsafe", reason: `${shown} is a symbolic link.` }
    }
    const names = readdirSync(current)
    if (!names.includes(segment)) {
      const actual = names.find((name) => name.toLowerCase() === segment.toLowerCase())
      return { kind: "unsafe", reason: `${shown} differs only in case from ${actual ?? "an existing name"}.` }
    }
    const last = index === segments.length - 1
    if (!last && !stats.isDirectory()) {
      return { kind: "unsafe", reason: `${shown} isn't a folder.` }
    }
    if (last) {
      if (!stats.isFile()) {
        return { kind: "unsafe", reason: `${shown} isn't a file.` }
      }
      if (stats.nlink > 1) {
        return { kind: "unsafe", reason: `${shown} is a hard link.` }
      }
    }
    current = next
  }
  return { kind: "file", content: readFileSync(current, "utf8") }
}
