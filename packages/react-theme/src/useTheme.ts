"use client"

import type { ThemeStore } from "@buildkitgg/theme-core"
import { useSyncExternalStore } from "react"

/** Subscribes to the same store used by non-React callers. No provider needed. */
export function useTheme(store: ThemeStore) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)
  return { ...snapshot, setTheme: store.setTheme, reset: store.reset }
}
