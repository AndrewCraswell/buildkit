"use client"
import type { ConfigurationClient, ConfigurationSnapshot } from "@buildkitgg/configuration-core"
import { useSyncExternalStore } from "react"

/** Subscribes to an existing client without creating a React context provider or starting network work. */
export function useConfiguration<T extends object, Context extends object>(
  client: ConfigurationClient<T, Context>
): ConfigurationSnapshot<T, Context> {
  return useSyncExternalStore(client.subscribe, client.getSnapshot, client.getServerSnapshot)
}
