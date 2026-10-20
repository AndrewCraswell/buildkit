import { createRoutePanel, type RouterAdapter, type RoutePanelOptions } from "@buildkitgg/router-core"
import { useSyncExternalStore } from "react"
export function useRoutePanel(adapter: RouterAdapter, options: RoutePanelOptions) {
  const location = useSyncExternalStore(adapter.subscribe, adapter.getSnapshot, adapter.getServerSnapshot)
  return createRoutePanel(options, location)
}
