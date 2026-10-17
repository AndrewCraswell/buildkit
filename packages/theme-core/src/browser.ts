import { connectPreferencesStorage } from "@buildkitgg/preferences-core/browser"
import type { ThemeStore } from "./index.js"
import { themePreferences } from "./internal.js"

export type BrowserThemeOptions = { window?: Window; storageKey?: string; storage?: "localStorage" | "sessionStorage" }

/** Connect once per store. Omit storageKey for memory-only preferences. */
export function connectBrowserTheme(store: ThemeStore, options: BrowserThemeOptions = {}) {
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
