import { createRouteTabs, type RouterAdapter, type RouteTabsOptions } from "@buildkitgg/router-core"
import { useSyncExternalStore } from "react"
export function useRouteTabs<const TId extends string>(adapter: RouterAdapter, options: RouteTabsOptions<TId>) {
  const location = useSyncExternalStore(adapter.subscribe, adapter.getSnapshot, adapter.getServerSnapshot)
  return createRouteTabs(options, location)
}
