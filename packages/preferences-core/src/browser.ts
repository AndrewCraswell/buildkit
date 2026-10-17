import type { PreferencesStore } from "./index.js"

export type PreferencesStorageOptions = {
  storage: "localStorage" | "sessionStorage"
  key: string
  window?: Window
}

/** Explicit connection for SSR shells; do not combine with factory persistence on the same store. */
export function connectPreferencesStorage<T extends object>(
  store: PreferencesStore<T>,
  options: PreferencesStorageOptions
) {
  const browser = options.window ?? (typeof window === "undefined" ? undefined : window)
  let storage: Storage | undefined
  try {
    storage = browser?.[options.storage]
  } catch {
    /* Storage can be blocked by browser policy. */
  }
  if (!browser || !storage) {
    return () => {
      /* No browser storage to disconnect. */
    }
  }
  const target = storage
  function restore(json: string | null) {
    try {
      store.importJson(json ?? "{}", { mode: "replace" })
    } catch {
      /* Invalid persisted data does not replace valid in-memory state. */
    }
  }
  try {
    const saved = target.getItem(options.key)
    if (saved !== null) {
      restore(saved)
    }
  } catch {
    /* Continue in memory. */
  }
  let isRemote = false
  const unsubscribe = store.subscribe(() => {
    if (isRemote) {
      return
    }
    try {
      const json = store.exportJson()
      if (json === "{}") {
        target.removeItem(options.key)
      } else {
        target.setItem(options.key, json)
      }
    } catch {
      /* Quota or permission failures must not break application state. */
    }
  })
  function onStorage(event: StorageEvent) {
    if (event.storageArea !== target || (event.key !== options.key && event.key !== null)) {
      return
    }
    isRemote = true
    try {
      restore(event.newValue)
    } finally {
      isRemote = false
    }
  }
  // sessionStorage is isolated between top-level tabs; native events still sync same-tab frames.
  browser.addEventListener("storage", onStorage)
  return () => {
    unsubscribe()
    browser.removeEventListener("storage", onStorage)
  }
}
