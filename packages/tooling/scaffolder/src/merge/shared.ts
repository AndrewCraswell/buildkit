import { readEnv, removeEnvKey, setEnvValue } from "../edit/env.js"
import type { JsonParseResult, JsonPath } from "../edit/json.js"
import { appendLines, hasLine, isSecretLikePattern, removeLines } from "../edit/lines.js"
import type { ItemOrder } from "../manifest/types.js"
import { PlanError } from "../plan/errors.js"
import { canonicalJson, isRecord, jsonEqual, parsePointer, readPointer } from "../plan/json.js"
import type { PlanConflict, Resolution } from "../plan/types.js"
import type { KeyState, SharedFormat, SharedLockEntry } from "../state/schemas.js"
import { decideKey, type CurrentValue, type Desired, type KeyDecision } from "./keys.js"

export type { Desired } from "./keys.js"

export interface DesiredItem extends Desired {
  /** The field that identifies the item in a keyed array. Without it, the array is a set. */
  keyField?: string
  order?: ItemOrder
}

export interface DesiredDocument {
  keys: Map<string, Desired>
  items: Map<string, Map<string, DesiredItem>>
}

export interface DesiredEnv extends Desired {
  value: string
  description: string
}

export interface DocumentFormat {
  format: Extract<SharedFormat, "json" | "yaml">
  emptyText: string
  parse(text: string): JsonParseResult
  set(text: string, path: JsonPath, value: unknown): string
  remove(text: string, path: JsonPath): string
  insertItem(text: string, path: JsonPath, index: number, value: unknown): string
  replaceItem(text: string, path: JsonPath, index: number, value: unknown): string
}

export interface SharedResult {
  /** The new text, or `undefined` when the file doesn't change. */
  text: string | undefined
  entry: SharedLockEntry | undefined
  conflicts: PlanConflict[]
}

/** Identity of an item in an appended array. */
export function itemIdentity(item: unknown, keyField: string | undefined): string {
  if (keyField !== undefined) {
    return `key:${keyField}=${canonicalJson(isRecord(item) ? item[keyField] : undefined)}`
  }
  return `item:${canonicalJson(item)}`
}

function matchesIdentity(element: unknown, identity: string): boolean {
  if (identity.startsWith("key:")) {
    const separator = identity.indexOf("=")
    const field = identity.slice(4, separator)
    return (
      isRecord(element) &&
      Object.hasOwn(element, field) &&
      canonicalJson(element[field]) === identity.slice(separator + 1)
    )
  }
  return canonicalJson(element) === identity.slice(5)
}

const dependencySections = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]

function conflictFor(
  path: string,
  id: string,
  pointer: string | undefined,
  decision: Extract<KeyDecision, { action: "conflict" }>,
  values: { base?: unknown; current?: unknown; incoming?: unknown }
): PlanConflict {
  return {
    id,
    path,
    kind: decision.kind,
    message: decision.message,
    ...(pointer === undefined ? {} : { pointer }),
    ...("base" in values && values.base !== undefined ? { base: artifact(values.base) } : {}),
    ...("current" in values && values.current !== undefined ? { current: artifact(values.current) } : {}),
    ...("incoming" in values && values.incoming !== undefined ? { incoming: artifact(values.incoming) } : {}),
    resolutions: ["keep-current", "take-incoming"]
  }
}

function artifact(value: unknown): string {
  return typeof value === "string" ? `${value}\n` : `${JSON.stringify(value, null, 2)}\n`
}

function parseOrThrow(path: string, format: DocumentFormat, text: string): JsonParseResult {
  const parsed = format.parse(text)
  if (!parsed.ok && parsed.reason === "unsafe-key") {
    throw new PlanError(
      "E_UNSAFE_KEY",
      `${path} has an unsafe key at ${parsed.pointer}. Remove it, then run this again.`,
      {
        paths: [path]
      }
    )
  }
  return parsed
}

/** Plans a JSON, JSONC or YAML file edited by key. */
export function planSharedDocument(input: {
  path: string
  format: DocumentFormat
  current: string | undefined
  desired: DesiredDocument | undefined
  entry: SharedLockEntry | undefined
  resolve: Record<string, Resolution>
  packageJson: boolean
}): SharedResult {
  const { path, format, desired, entry, resolve } = input
  const conflicts: PlanConflict[] = []
  const original = input.current === undefined ? undefined : parseOrThrow(path, format, input.current)
  if (original && !original.ok) {
    if (resolve[path] === "keep-current") {
      return { text: undefined, entry, conflicts }
    }
    conflicts.push({
      id: path,
      path,
      kind: "invalid",
      message: `${path} isn't valid ${format.format.toUpperCase()} (${original.reason === "invalid" ? original.message : "unsafe key"}). Fix it, then run this again.`,
      resolutions: ["keep-current"]
    })
    return { text: undefined, entry, conflicts }
  }
  const document = original?.ok ? original.value : undefined
  let text = input.current ?? ""
  let changed = false
  const write = (edit: (base: string) => string) => {
    text = edit(text.trim() === "" ? format.emptyText : text)
    changed = true
  }
  const keys: Record<string, KeyState> = {}
  const pointers = orderedKeys(desired?.keys, entry?.keys)
  for (const pointer of pointers) {
    const segments = parsePointer(pointer)
    const wanted = desired?.keys.get(pointer)
    const state = entry?.keys[pointer]
    const current = readPointer(document, segments)
    const id = `${path}#${pointer}`
    const engineWrites = wanted !== undefined && (!state || !jsonEqual(state.base, wanted.value))
    const moved = input.packageJson && engineWrites && !current.found ? movedSection(document, segments) : undefined
    if (moved !== undefined) {
      const resolution = resolve[id]
      if (resolution === "keep-current") {
        keys[pointer] = { base: wanted?.value, provenance: state?.provenance ?? "adopted" }
        continue
      }
      if (resolution === "take-incoming") {
        write((base) => format.remove(format.set(base, segments, wanted?.value), [moved, ...segments.slice(1)]))
        keys[pointer] = { base: wanted?.value, provenance: state?.provenance ?? "introduced" }
        continue
      }
      conflicts.push({
        id,
        path,
        kind: "moved",
        pointer,
        message: `You moved ${segments[1]} to ${moved}, and ${wanted?.contributors.join(", ")} expects it in ${segments[0]}.`,
        resolutions: ["keep-current", "take-incoming"]
      })
      continue
    }
    const decision = decideKey({
      label: `${segments.join(".")} in ${path}`,
      desired: wanted,
      state,
      current,
      resolution: resolve[id]
    })
    if (decision.action === "conflict") {
      conflicts.push(
        conflictFor(path, id, pointer, decision, { base: state?.base, current: current.value, incoming: wanted?.value })
      )
      if (state) {
        keys[pointer] = state
      }
      continue
    }
    if (decision.action === "write") {
      write((base) => format.set(base, segments, decision.value))
    }
    if (decision.action === "remove") {
      write((base) => format.remove(base, segments))
    }
    const next = decision.action === "remove" ? undefined : decision.state
    if (next) {
      keys[pointer] = next
    }
  }
  const items: Record<string, Record<string, KeyState>> = {}
  for (const pointer of orderedKeys(desired?.items, entry?.items)) {
    const segments = parsePointer(pointer)
    const existing = readPointer(document, segments)
    const id = `${path}#${pointer}`
    if (existing.found && !Array.isArray(existing.value)) {
      conflicts.push({
        id,
        path,
        kind: "type",
        pointer,
        message: `${segments.join(".")} in ${path} isn't a list, so items can't be added to it.`,
        resolutions: ["keep-current"]
      })
      continue
    }
    const wantedItems = desired?.items.get(pointer)
    const states = entry?.items?.[pointer] ?? {}
    const kept: Record<string, KeyState> = {}
    for (const identity of orderedKeys(wantedItems, states)) {
      const wanted = wantedItems?.get(identity)
      const state = states[identity]
      const array = currentArray(path, format, text, segments)
      const index = array.findIndex((element) => matchesIdentity(element, identity))
      const current: CurrentValue =
        index === -1 ? { found: false, value: undefined } : { found: true, value: array[index] }
      const itemId = `${id}[${identity}]`
      const decision = decideKey({
        label: `an item of ${segments.join(".")} in ${path}`,
        desired: wanted,
        state,
        current,
        resolution: resolve[itemId]
      })
      if (decision.action === "conflict") {
        conflicts.push(
          conflictFor(path, itemId, pointer, decision, {
            base: state?.base,
            current: current.value,
            incoming: wanted?.value
          })
        )
        if (state) {
          kept[identity] = state
        }
        continue
      }
      if (decision.action === "write") {
        const value = decision.value
        if (index === -1) {
          write((base) =>
            readPointer(parsedValue(format, base), segments).found
              ? format.insertItem(base, segments, insertionIndex(array, wanted), value)
              : format.set(base, segments, [value])
          )
        } else {
          write((base) => format.replaceItem(base, segments, index, value))
        }
      }
      if (decision.action === "remove" && index !== -1) {
        write((base) => format.remove(base, [...segments, index]))
      }
      if (decision.action !== "remove" && decision.state) {
        kept[identity] = decision.state
      }
    }
    if (Object.keys(kept).length > 0) {
      items[pointer] = kept
    }
  }
  const hasKeys = Object.keys(keys).length > 0
  const hasItems = Object.keys(items).length > 0
  return {
    text: changed ? text : undefined,
    entry:
      hasKeys || hasItems
        ? { class: "shared", format: format.format, keys, ...(hasItems ? { items } : {}) }
        : undefined,
    conflicts
  }
}

/** Where a new item goes: after the last item it follows, else before the first it precedes, else at the end. */
function insertionIndex(array: unknown[], item: DesiredItem | undefined): number {
  const { keyField, order } = item ?? {}
  if (keyField === undefined || !order) {
    return array.length
  }
  const keys = array.map((element) => (isRecord(element) ? element[keyField] : undefined))
  const after = keys.findLastIndex((key) => typeof key === "string" && (order.after ?? []).includes(key))
  if (after !== -1) {
    return after + 1
  }
  const before = keys.findIndex((key) => typeof key === "string" && (order.before ?? []).includes(key))
  return before === -1 ? array.length : before
}

function parsedValue(format: DocumentFormat, text: string): unknown {
  const parsed = format.parse(text)
  return parsed.ok ? parsed.value : undefined
}

function currentArray(path: string, format: DocumentFormat, text: string, segments: string[]): unknown[] {
  const parsed = parseOrThrow(path, format, text)
  const found = parsed.ok ? readPointer(parsed.value, segments) : { found: false, value: undefined }
  return Array.isArray(found.value) ? found.value : []
}

function movedSection(document: unknown, segments: string[]): string | undefined {
  const [section, name] = segments
  if (segments.length !== 2 || section === undefined || name === undefined || !dependencySections.includes(section)) {
    return undefined
  }
  return dependencySections.find((other) => other !== section && readPointer(document, [other, name]).found)
}

/** Desired keys in contribution order, then keys only the lock knows, sorted. */
function orderedKeys(
  desired: Map<string, unknown> | undefined,
  recorded: Record<string, unknown> | undefined
): string[] {
  const ordered = [...(desired?.keys() ?? [])]
  const seen = new Set(ordered)
  return [
    ...ordered,
    ...Object.keys(recorded ?? {})
      .filter((key) => !seen.has(key))
      .sort()
  ]
}

/** Plans a line-list file such as `.gitignore`. A line is removed only if the engine introduced it. */
export function planSharedLines(input: {
  path: string
  current: string | undefined
  desired: Map<string, Desired> | undefined
  entry: SharedLockEntry | undefined
  resolve: Record<string, Resolution>
}): SharedResult {
  const { path, desired, entry, resolve } = input
  const conflicts: PlanConflict[] = []
  const keys: Record<string, KeyState> = {}
  const add: string[] = []
  const remove: string[] = []
  for (const line of orderedKeys(desired, entry?.keys)) {
    const id = `${path}#${line}`
    const state = entry?.keys[line]
    const current: CurrentValue = { found: hasLine(input.current, line), value: line }
    const decision = decideKey({
      label: `"${line}" in ${path}`,
      desired: desired?.get(line),
      state,
      current,
      resolution: resolve[id]
    })
    if (decision.action === "remove" && isSecretLikePattern(line) && resolve[id] !== "take-incoming") {
      conflicts.push({
        id,
        path,
        kind: "secret-pattern",
        message: `"${line}" in ${path} keeps secrets out of git. It's no longer needed, but removing it needs your answer.`,
        resolutions: ["keep-current", "take-incoming"]
      })
      if (state) {
        keys[line] = state
      }
      continue
    }
    if (decision.action === "conflict") {
      conflicts.push(conflictFor(path, id, undefined, decision, {}))
      continue
    }
    if (decision.action === "write") {
      add.push(line)
    }
    if (decision.action === "remove") {
      remove.push(line)
    }
    if (decision.action !== "remove" && decision.state) {
      keys[line] = decision.state
    }
  }
  const changed = add.length > 0 || remove.length > 0
  return {
    text: changed ? appendLines(removeLines(input.current, remove), add) : undefined,
    entry: Object.keys(keys).length > 0 ? { class: "shared", format: "lines", keys } : undefined,
    conflicts
  }
}

/** Plans an `.env`-style example file by key. */
export function planSharedEnv(input: {
  path: string
  current: string | undefined
  desired: Map<string, DesiredEnv> | undefined
  entry: SharedLockEntry | undefined
  resolve: Record<string, Resolution>
}): SharedResult {
  const { path, desired, entry, resolve } = input
  const conflicts: PlanConflict[] = []
  const keys: Record<string, KeyState> = {}
  const values = readEnv(input.current)
  let text = input.current
  let changed = false
  for (const name of orderedKeys(desired, entry?.keys)) {
    const id = `${path}#${name}`
    const recorded = entry?.keys[name]
    const wanted = desired?.get(name)
    const base = recorded && isRecord(recorded.base) ? recorded.base : undefined
    const description = wanted?.description ?? (typeof base?.description === "string" ? base.description : undefined)
    // Values decide the merge; the description only labels the line.
    const state: KeyState | undefined = recorded ? { base: base?.value, provenance: recorded.provenance } : undefined
    const currentValue = values.get(name)
    const current: CurrentValue =
      currentValue === undefined ? { found: false, value: undefined } : { found: true, value: currentValue }
    const decision = decideKey({
      label: `${name} in ${path}`,
      desired: wanted ? { value: wanted.value, contributors: wanted.contributors } : undefined,
      state,
      current,
      resolution: resolve[id]
    })
    if (decision.action === "conflict") {
      conflicts.push(
        conflictFor(path, id, undefined, decision, {
          base: state?.base,
          current: currentValue,
          incoming: wanted?.value
        })
      )
      if (recorded) {
        keys[name] = recorded
      }
      continue
    }
    if (decision.action === "write" && wanted) {
      text = setEnvValue(text, name, wanted.value, wanted.description)
      changed = true
    }
    if (decision.action === "remove") {
      text = removeEnvKey(text, name, description)
      changed = true
    }
    if (decision.action !== "remove" && decision.state) {
      keys[name] = {
        base: { value: decision.state.base, description: description ?? "" },
        provenance: decision.state.provenance
      }
    }
  }
  return {
    text: changed ? (text ?? "") : undefined,
    entry: Object.keys(keys).length > 0 ? { class: "shared", format: "env", keys } : undefined,
    conflicts
  }
}
