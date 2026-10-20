import { createThemeStore, type ThemeOptions, type ThemeStore } from "@buildkitgg/theme-core"
import { connectBrowserTheme, type BrowserThemeOptions } from "@buildkitgg/theme-core/browser"
import { webLightTheme, webDarkTheme, type Theme } from "@fluentui/react-components"

export type FluentThemeOptions = ThemeOptions &
  BrowserThemeOptions & {
    lightTheme?: Theme
    darkTheme?: Theme
  }
export type FluentThemeStore = ThemeStore & {
  readonly themes: Readonly<{ light: Theme; dark: Theme }>
  start(): () => void
}

/** State is usable outside React. Browser effects start explicitly or on provider mount. */
export function createFluentTheme(options: FluentThemeOptions = {}): FluentThemeStore {
  const store = createThemeStore(options)
  const themes = { light: options.lightTheme ?? webLightTheme, dark: options.darkTheme ?? webDarkTheme }
  let disconnect: (() => void) | undefined
  let owners = 0
  function start() {
    const browser = options.window ?? (typeof window === "undefined" ? undefined : window)
    if (!browser) {
      return () => {
        /* No browser effects during server rendering. */
      }
    }
    disconnect ??= connectBrowserTheme(store, { ...options, window: browser })
    owners++
    let isStopped = false
    return () => {
      if (isStopped) {
        return
      }
      isStopped = true
      if (--owners === 0) {
        disconnect?.()
        disconnect = undefined
      }
    }
  }
  return { ...store, themes, start }
}
