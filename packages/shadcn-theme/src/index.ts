import { createThemeStore, type ThemeOptions } from "@buildkitgg/theme-core"
import { connectBrowserTheme, type BrowserThemeOptions } from "@buildkitgg/theme-core/browser"

export type ShadcnThemeOptions = ThemeOptions & BrowserThemeOptions

/** Construct safely on the server; start only at the browser application boundary. */
export function createShadcnTheme(options: ShadcnThemeOptions = {}) {
  const store = createThemeStore(options)
  let stop: (() => void) | undefined
  let owners = 0
  function start() {
    const browser = options.window ?? (typeof window === "undefined" ? undefined : window)
    if (!browser) {
      return () => {
        /* Nothing to disconnect on the server. */
      }
    }
    if (!stop) {
      const root = browser.document.documentElement
      const wasDark = root.classList.contains("dark")
      const originalColorScheme = root.style.colorScheme
      const disconnect = connectBrowserTheme(store, { ...options, window: browser })
      const apply = () => {
        const { resolvedTheme } = store.getSnapshot()
        root.classList.toggle("dark", resolvedTheme === "dark")
        root.style.colorScheme = resolvedTheme
      }
      apply()
      const unsubscribe = store.subscribe(apply)
      stop = () => {
        disconnect()
        unsubscribe()
        root.classList.toggle("dark", wasDark)
        root.style.colorScheme = originalColorScheme
      }
    }
    owners++
    let isStopped = false
    return () => {
      if (isStopped) {
        return
      }
      isStopped = true
      if (--owners === 0) {
        stop?.()
        stop = undefined
      }
    }
  }
  return { ...store, start }
}

/** Put this trusted script before first paint; pass your CSP nonce on the script tag. */
export function getThemeInitScript({
  defaultTheme = "system",
  storageKey,
  storage = "localStorage"
}: Pick<ShadcnThemeOptions, "defaultTheme" | "storageKey" | "storage"> = {}) {
  const config = JSON.stringify({ defaultTheme, storageKey, storage }).replaceAll("<", "\\u003c")
  return `(()=>{const c=${config};let t=c.defaultTheme;try{if(c.storageKey!==undefined){const s=JSON.parse(window[c.storage].getItem(c.storageKey)||'{}').theme;if(s==='light'||s==='dark'||s==='system')t=s}}catch{}const r=t==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;document.documentElement.classList.toggle('dark',r==='dark');document.documentElement.style.colorScheme=r})()`
}
