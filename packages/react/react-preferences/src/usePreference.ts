"use client"
import type { PreferenceKey, PreferencesStore } from "@buildkitgg/preferences-core"
import { usePreferences } from "./usePreferences.js"

export function usePreference<T extends object, K extends PreferenceKey<T>>(store: PreferencesStore<T>, key: K) {
  const snapshot = usePreferences(store)
  return [snapshot[key], (value: T[K]) => store.set(key, value)] as const
}
