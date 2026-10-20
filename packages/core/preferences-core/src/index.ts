import { connectPreferencesStorage } from "./browser.js"
import { assertKey, copyJson, copyObject, matchesDefault, type JsonValue } from "./json.js"

export type { JsonValue } from "./json.js"
export type StorageOptions =
  | { storage?: undefined; key?: never }
  | { storage: "localStorage" | "sessionStorage"; key: string }
export type PreferencesOptions<T extends object> = { defaults?: Partial<T> } & StorageOptions
export type ImportOptions = { mode?: "merge" | "replace" }
export type PreferenceKey<T> = Extract<keyof T, string>
export type PreferencesStore<T extends object> = {
  get<K extends PreferenceKey<T>>(key: K): T[K] | undefined
  set<K extends PreferenceKey<T>>(key: K, value: T[K]): void
  reset<K extends PreferenceKey<T>>(key: K): void
  resetAll(): void
  getSnapshot(): Readonly<Partial<T>>
  getServerSnapshot(): Readonly<Partial<T>>
  subscribe(listener: () => void): () => void
  exportJson(): string
  importJson(json: string, options?: ImportOptions): void
  dispose(): void
}

/** Generics describe application code, not a runtime schema for external JSON. */
export function createPreferences<T extends object>(options: PreferencesOptions<T> = {}): PreferencesStore<T> {
  if (options.storage === undefined && options.key !== undefined) {
    throw new TypeError("A storage key requires storage")
  }
  if (options.storage !== undefined && (typeof options.key !== "string" || !options.key.length)) {
    throw new TypeError("Storage requires a nonempty key")
  }
  if (options.storage !== undefined && options.storage !== "localStorage" && options.storage !== "sessionStorage") {
    throw new TypeError("Unknown storage mechanism")
  }
  const defaults = copyObject(options.defaults ?? {})
  let overrides: Record<string, JsonValue> = {}
  const initialDefaults = Object.assign({}, options.defaults, defaults)
  // Object.assign retains the declared preference shape; external JSON is validated only against available defaults.
  function makeSnapshot(): Readonly<Partial<T>> {
    return Object.freeze(Object.assign({}, initialDefaults, overrides))
  }
  let snapshot = makeSnapshot()
  const serverSnapshot = snapshot
  const listeners = new Set<() => void>()
  let isDisposed = false
  let disconnect = () => {
    /* Memory-only store. */
  }

  function assertActive() {
    if (isDisposed) {
      throw new Error("Preferences store is disposed")
    }
  }
  function validate(key: string, value: unknown) {
    assertKey(key)
    const copy = copyJson(value)
    if (Object.hasOwn(defaults, key) && !matchesDefault(copy, defaults[key]!)) {
      throw new TypeError(`Invalid type for preference: ${key}`)
    }
    return copy
  }
  function commit(next: Record<string, JsonValue>) {
    assertActive()
    if (JSON.stringify(next) === JSON.stringify(overrides)) {
      return
    }
    overrides = next
    snapshot = makeSnapshot()
    const currentListeners = [...listeners]
    for (const listener of currentListeners) {
      listener()
    }
  }
  const store: PreferencesStore<T> = {
    get: (key) => snapshot[key],
    getSnapshot: () => snapshot,
    getServerSnapshot: () => serverSnapshot,
    set(key, value) {
      commit({ ...overrides, [key]: validate(key, value) })
    },
    reset(key) {
      assertKey(key)
      const next = { ...overrides }
      delete next[key]
      commit(next)
    },
    resetAll() {
      commit({})
    },
    subscribe(listener) {
      assertActive()
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    exportJson: () => JSON.stringify(overrides),
    importJson(json, { mode = "merge" } = {}) {
      if (mode !== "merge" && mode !== "replace") {
        throw new TypeError("Unknown import mode")
      }
      const parsed: unknown = JSON.parse(json)
      const incoming = copyObject(parsed)
      for (const [key, value] of Object.entries(incoming)) {
        validate(key, value)
      }
      commit(mode === "replace" ? incoming : { ...overrides, ...incoming })
    },
    dispose() {
      if (isDisposed) {
        return
      }
      disconnect()
      listeners.clear()
      isDisposed = true
    }
  }
  if (options.storage !== undefined) {
    disconnect = connectPreferencesStorage(store, options)
  }
  return store
}
