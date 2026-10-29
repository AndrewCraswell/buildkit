import { diff3Merge, diffIndices } from "node-diff3"
import { normalizeText } from "../ownership/text.js"

export interface TextMerge {
  /** False when both sides changed the same lines. */
  clean: boolean
  /** The merged text, with conflict markers in place of unresolved regions. */
  content: string
  /** Hunks taken from the incoming side. */
  hunks: number
  conflicts: number
}

function lines(text: string): string[] {
  const normalized = normalizeText(text)
  return normalized === "" ? [] : normalized.slice(0, -1).split("\n")
}

/** Line-based three-way merge of normalized text: yours, the base the engine last wrote, and the engine's new text. */
export function mergeText(current: string, base: string, incoming: string): TextMerge {
  const ours = lines(current)
  const original = lines(base)
  const theirs = lines(incoming)
  const regions = diff3Merge(ours, original, theirs, { excludeFalseConflicts: true })
  const output: string[] = []
  let conflicts = 0
  for (const region of regions) {
    if (region.ok) {
      output.push(...region.ok)
    } else if (region.conflict) {
      conflicts++
      output.push("<<<<<<< yours", ...region.conflict.a, "=======", ...region.conflict.b, ">>>>>>> incoming")
    }
  }
  return {
    clean: conflicts === 0,
    content: output.length === 0 ? "" : `${output.join("\n")}\n`,
    hunks: diffIndices(original, theirs).length,
    conflicts
  }
}
