"use client"
import type { PreferencesStore } from "@buildkitgg/preferences-core"
import { useSyncExternalStore } from "react"

export function usePreferences<T extends object>(store: PreferencesStore<T>) {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)
}
