import { connectPreferencesStorage } from "@buildkitgg/preferences-core/browser"
import type { ThemeStore } from "./index.js"
import { themePreferences } from "./internal.js"

export type ThemeStorageOptions =
  | { storageKey?: undefined; storage?: never }
  | { storageKey: string; storage?: "localStorage" | "sessionStorage" }
export type BrowserThemeOptions = { window?: Window } & ThemeStorageOptions

/** Connect once per store. Omit storageKey for memory-only preferences. */
export function connectBrowserTheme(store: ThemeStore, options: BrowserThemeOptions = {}) {
  if (options.storageKey !== undefined && (typeof options.storageKey !== "string" || !options.storageKey.length)) {
    throw new TypeError("Storage requires a nonempty key")
  }
  if (options.storage !== undefined && options.storageKey === undefined) {
    throw new TypeError("Storage requires a key")
  }
  if (options.storage !== undefined && options.storage !== "localStorage" && options.storage !== "sessionStorage") {
    throw new TypeError("Unknown storage mechanism")
  }
  const browser = options.window ?? (typeof window === "undefined" ? undefined : window)
  if (!browser) {
    return () => {
      /* Nothing to disconnect on the server. */
    }
  }
  const preferences = themePreferences.get(store.getSnapshot)
  if (!preferences) {
    throw new TypeError("Expected a store created by createThemeStore or a Buildkit theme adapter")
  }
  const disconnect =
    options.storageKey === undefined
      ? () => {
          /* Memory-only preferences. */
        }
      : connectPreferencesStorage(preferences, {
          storage: options.storage ?? "localStorage",
          key: options.storageKey,
          window: browser
        })
  const media = browser.matchMedia("(prefers-color-scheme: dark)")
  function syncSystem() {
    store.setSystemTheme(media.matches ? "dark" : "light")
  }
  syncSystem()
  media.addEventListener("change", syncSystem)
  return () => {
    disconnect()
    media.removeEventListener("change", syncSystem)
  }
}
