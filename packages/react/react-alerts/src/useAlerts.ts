import { useSyncExternalStore } from "react"
import type { AlertManager } from "./types.js"
export function useAlerts(manager: AlertManager, region = "default") {
  return useSyncExternalStore(
    (listener) => manager.subscribe(listener, region),
    () => manager.getSnapshot(region),
    manager.getServerSnapshot
  )
}
