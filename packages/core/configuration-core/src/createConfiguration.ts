import { createPreferences } from "@buildkitgg/preferences-core"
import type {
  SettingValue,
  SettingKey,
  SettingState,
  ConfigurationClient,
  ConfigurationOptions,
  ConfigurationSnapshot,
  ConfigurationStatus
} from "./types.js"

/** Creates an isolated client. No network requests are made until refresh or setContext. */
export function createConfiguration<T extends object, Context extends object>(
  options: ConfigurationOptions<T, Context> & (T extends { [K in keyof T]: SettingValue } ? unknown : never)
): ConfigurationClient<T, Context> {
  const defaults: T = { ...options.defaults }
  Object.freeze(defaults)
  const validators: Partial<{ [K in keyof T]: (value: T[K]) => boolean }> = { ...options.validate }
  const provider = options.provider
  const hasOverrides = options.overrides !== undefined && options.overrides !== false
  const preferences = createPreferences<T>(typeof options.overrides === "object" ? options.overrides : {})
  const listeners = new Set<() => void>()
  let context = Object.freeze({ ...options.context })
  let remote: Partial<T> = {}
  let status: ConfigurationStatus = "idle"
  let error: Error | undefined
  let isDisposed = false
  let generation = 0
  let controller: AbortController | undefined
  let disconnectProvider: (() => void) | undefined
  let hasSubscribed = false
  const settingSnapshots: { [K in keyof T]?: SettingState<T[K]> } = {}
  const serverSettings: { [K in keyof T]?: SettingState<T[K]> } = {}

  function assertActive() {
    if (isDisposed) {
      throw new Error("Configuration client is disposed")
    }
  }
  function isKey(key: string): key is SettingKey<T> {
    return Object.hasOwn(defaults, key)
  }
  function assertKey(key: string) {
    if (!isKey(key)) {
      throw new TypeError(`Unknown settingsuration setting: ${key}`)
    }
  }
  // The scalar shape is checked here; applications can further constrain unions and ranges.
  function isCompatible<K extends SettingKey<T>>(key: K, value: unknown): value is T[K] {
    return (
      typeof value === typeof defaults[key] &&
      (typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value)))
    )
  }
  function isValid<K extends SettingKey<T>>(key: K, value: unknown): value is T[K] {
    return isCompatible(key, value) && (validators[key]?.(value) ?? true)
  }
  for (const key of Object.keys(defaults)) {
    if (
      key === "__proto__" ||
      key === "constructor" ||
      key === "prototype" ||
      !isKey(key) ||
      !isValid(key, defaults[key])
    ) {
      preferences.dispose()
      throw new TypeError(`Invalid configuration setting default: ${key}`)
    }
  }
  function getSetting<K extends SettingKey<T>>(key: K): SettingState<T[K]> {
    assertKey(key)
    const override = hasOverrides ? preferences.get(key) : undefined
    const hasOverride = override !== undefined && isValid(key, override)
    const providerValue = remote[key]
    const value = hasOverride ? override : (providerValue ?? defaults[key])
    let source: SettingState<T[K]>["source"] = providerValue !== undefined ? "provider" : "default"
    if (hasOverride) {
      source = "override"
    }
    const previous = settingSnapshots[key]
    if (previous && Object.is(previous.value, value) && previous.source === source) {
      return previous
    }
    const next = Object.freeze({ value, source, defaultValue: defaults[key] })
    settingSnapshots[key] = next
    return next
  }
  function values(): Readonly<T> {
    const result = { ...defaults }
    for (const key of Object.keys(defaults)) {
      if (isKey(key)) {
        result[key] = getSetting(key).value
      }
    }
    return Object.freeze(result)
  }
  const serverSnapshot: ConfigurationSnapshot<T, Context> = Object.freeze({ values: defaults, context, status, error })
  let snapshot: ConfigurationSnapshot<T, Context> = Object.freeze({ values: values(), context, status, error })
  function notify() {
    snapshot = Object.freeze({ values: values(), context, status, error })
    const currentListeners = [...listeners]
    for (const listener of currentListeners) {
      listener()
    }
  }
  const disconnectPreferences = preferences.subscribe(notify)

  function parseResult(input: unknown): Partial<T> {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      throw new TypeError("Configuration provider must return an object")
    }
    const result: Partial<T> = {}
    for (const [key, value] of Object.entries(input)) {
      if (!isKey(key)) {
        continue
      }
      if (!isValid(key, value)) {
        throw new TypeError(`Invalid provider value: ${key}`)
      }
      result[key] = value
    }
    return result
  }
  async function refresh(): Promise<void> {
    assertActive()
    const current = ++generation
    controller?.abort()
    const request = new AbortController()
    controller = request
    status = "loading"
    error = undefined
    notify()
    try {
      if (isDisposed || current !== generation) {
        return
      }
      if (provider?.subscribe && !hasSubscribed) {
        hasSubscribed = true
        try {
          const disconnect = provider.subscribe(() => {
            if (!isDisposed) {
              void refresh()
            }
          })
          if (isDisposed) {
            disconnect()
          } else {
            disconnectProvider = disconnect
          }
        } catch (cause) {
          hasSubscribed = false
          throw cause
        }
      }
      if (isDisposed || current !== generation) {
        return
      }
      // A provider returns a full snapshot, not a patch. Removed config return to defaults.
      const result = await (provider ? provider.load(context, { signal: request.signal }) : {})
      if (isDisposed || current !== generation) {
        return
      }
      remote = parseResult(result)
      status = "ready"
    } catch (cause) {
      if (isDisposed || current !== generation) {
        return
      }
      error = cause instanceof Error ? cause : new Error(String(cause))
      status = "error"
    }
    if (!isDisposed && current === generation) {
      notify()
    }
  }
  function assertOverrides() {
    assertActive()
    if (!hasOverrides) {
      throw new Error("Developer overrides are disabled")
    }
  }
  return {
    get: (key) => getSetting(key).value,
    getSetting,
    getServerSetting(key) {
      assertKey(key)
      return (serverSettings[key] ??= Object.freeze({
        value: defaults[key],
        defaultValue: defaults[key],
        source: "default"
      }))
    },
    getSnapshot: () => snapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe(listener) {
      assertActive()
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    refresh,
    setContext(next) {
      assertActive()
      context = Object.freeze({ ...next })
      remote = {}
      return refresh()
    },
    override(key, value) {
      assertOverrides()
      assertKey(key)
      if (!isValid(key, value)) {
        throw new TypeError(`Invalid override: ${key}`)
      }
      preferences.set(key, value)
    },
    reset(key) {
      assertOverrides()
      assertKey(key)
      preferences.reset(key)
    },
    resetAll() {
      assertOverrides()
      preferences.resetAll()
    },
    dispose() {
      if (isDisposed) {
        return
      }
      isDisposed = true
      generation++
      controller?.abort()
      disconnectPreferences()
      preferences.dispose()
      listeners.clear()
      disconnectProvider?.()
    }
  }
}
