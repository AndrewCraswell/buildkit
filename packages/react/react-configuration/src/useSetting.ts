"use client"
import type { ConfigurationClient, SettingKey, SettingState } from "@buildkitgg/configuration-core"
import { useSyncExternalStore } from "react"

/** Subscribe to one setting. Loading and error state are available through useConfiguration. */
export function useSetting<T extends object, Context extends object, K extends SettingKey<T>>(
  client: ConfigurationClient<T, Context>,
  key: K
): SettingState<T[K]> {
  return useSyncExternalStore(
    client.subscribe,
    () => client.getSetting(key),
    () => client.getServerSetting(key)
  )
}
