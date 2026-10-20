import { createPreferences } from "@buildkitgg/preferences-core"
import { themePreferences } from "./internal.js"

export type Theme = "light" | "dark" | "system"
export type ResolvedTheme = Exclude<Theme, "system">
export type ThemeSnapshot = Readonly<{ theme: Theme; resolvedTheme: ResolvedTheme }>
export type ThemeOptions = { defaultTheme?: Theme; systemTheme?: ResolvedTheme }
export type ThemeStore = {
  reset(): void
  getSnapshot(): ThemeSnapshot
  getServerSnapshot(): ThemeSnapshot
  subscribe(listener: () => void): () => void
  setTheme(theme: Theme): void
  setSystemTheme(theme: ResolvedTheme): void
}

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system"
}

/** Creates isolated state. No browser effects or process-wide singleton. */
export function createThemeStore({ defaultTheme = "system", systemTheme = "light" }: ThemeOptions = {}): ThemeStore {
  if (!isTheme(defaultTheme)) {
    throw new TypeError("Unknown default theme")
  }
  if (systemTheme !== "light" && systemTheme !== "dark") {
    throw new TypeError("Unknown system theme")
  }
  let system = systemTheme
  const preferences = createPreferences<{ theme: Theme }>({ defaults: { theme: defaultTheme } })
  let snapshot: ThemeSnapshot = Object.freeze({
    theme: defaultTheme,
    resolvedTheme: defaultTheme === "system" ? system : defaultTheme
  })
  const serverSnapshot = snapshot
  const listeners = new Set<() => void>()

  function update(theme: Theme) {
    const resolvedTheme = theme === "system" ? system : theme
    if (snapshot.theme === theme && snapshot.resolvedTheme === resolvedTheme) {
      return
    }
    snapshot = Object.freeze({ theme, resolvedTheme })
    const currentListeners = [...listeners]
    for (const listener of currentListeners) {
      listener()
    }
  }

  preferences.subscribe(() => {
    const preference = preferences.get("theme")
    update(isTheme(preference) ? preference : defaultTheme)
  })

  const store = {
    reset() {
      preferences.reset("theme")
    },
    getSnapshot: () => snapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    setTheme(theme: Theme) {
      if (!isTheme(theme)) {
        throw new TypeError("Unknown theme preference")
      }
      preferences.set("theme", theme)
    },
    setSystemTheme(theme: ResolvedTheme) {
      if (theme !== "light" && theme !== "dark") {
        throw new TypeError("Unknown system theme")
      }
      system = theme
      update(snapshot.theme)
    }
  }
  themePreferences.set(store.getSnapshot, preferences)
  return store
}
