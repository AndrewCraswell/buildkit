import { canonicalJson, jsonEqual } from "../plan/json.js"
import type { ConflictKind, Resolution } from "../plan/types.js"
import type { KeyState } from "../state/schemas.js"

export interface Desired {
  value: unknown
  contributors: string[]
}

export interface CurrentValue {
  found: boolean
  value: unknown
}

export type KeyDecision =
  | { action: "keep"; state: KeyState | undefined }
  | { action: "write"; value: unknown; state: KeyState }
  | { action: "remove" }
  | { action: "conflict"; kind: ConflictKind; message: string }

/**
 * The three-way rule for one key of a shared file. `desired` is what the engine wants now, `state` is the lock's base
 * value and provenance, and `current` is what's on disk.
 *
 * - The engine edits only keys it introduced, and only while they still hold the base value.
 * - Keys you already had are adopted: kept, and never removed.
 * - Your change wins when the engine's value didn't change.
 * - Anything else is a conflict, unless a resolution answers it.
 */
export function decideKey(input: {
  label: string
  desired: Desired | undefined
  state: KeyState | undefined
  current: CurrentValue
  resolution: Resolution | undefined
}): KeyDecision {
  const { label, desired, state, current, resolution } = input
  const keep = resolution === "keep-current"
  const take = resolution === "take-incoming"
  if (desired && !state) {
    if (!current.found) {
      return { action: "write", value: desired.value, state: { base: desired.value, provenance: "introduced" } }
    }
    if (jsonEqual(current.value, desired.value) || keep) {
      return { action: "keep", state: { base: desired.value, provenance: "adopted" } }
    }
    if (take) {
      return { action: "write", value: desired.value, state: { base: desired.value, provenance: "adopted" } }
    }
    return {
      action: "conflict",
      kind: "exists",
      message: `${label} already has ${preview(current.value)}, and ${desired.contributors.join(", ")} sets ${preview(desired.value)}.`
    }
  }
  if (desired && state) {
    const next: KeyState = { base: desired.value, provenance: state.provenance }
    if (jsonEqual(desired.value, state.base)) {
      return { action: "keep", state }
    }
    if (!current.found) {
      if (keep) {
        return { action: "keep", state: next }
      }
      if (take) {
        return { action: "write", value: desired.value, state: next }
      }
      return {
        action: "conflict",
        kind: "deleted",
        message: `You removed ${label}, and ${desired.contributors.join(", ")} now sets ${preview(desired.value)}.`
      }
    }
    if (jsonEqual(current.value, desired.value)) {
      return { action: "keep", state: next }
    }
    if (jsonEqual(current.value, state.base) || take) {
      return { action: "write", value: desired.value, state: next }
    }
    if (keep) {
      return { action: "keep", state: next }
    }
    return {
      action: "conflict",
      kind: "both-changed",
      message: `You changed ${label} to ${preview(current.value)}, and ${desired.contributors.join(", ")} changes it to ${preview(desired.value)}.`
    }
  }
  if (!desired && state) {
    if (state.provenance === "adopted" || !current.found) {
      return { action: "keep", state: undefined }
    }
    if (jsonEqual(current.value, state.base) || take) {
      return { action: "remove" }
    }
    if (keep) {
      return { action: "keep", state: undefined }
    }
    return {
      action: "conflict",
      kind: "orphan-edited",
      message: `${label} is no longer needed, but you changed it to ${preview(current.value)}.`
    }
  }
  return { action: "keep", state: undefined }
}

function preview(value: unknown): string {
  const text = canonicalJson(value)
  return text.length > 60 ? `${text.slice(0, 57)}...` : text
}
