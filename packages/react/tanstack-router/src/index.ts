import type { RouterAdapter, RouteTarget } from "@buildkitgg/router-core"
import type {
  AnyRouter,
  RegisteredRouter,
  NavigateOptions,
  ValidateNavigateOptions,
  MatchRouteOptions
} from "@tanstack/react-router"
export { useRouteTabs, useRoutePanel } from "@buildkitgg/react-routing"
export type { RouteTarget, RouteTab, RouteTabsOptions, RoutePanelOptions } from "@buildkitgg/router-core"
/** Create once per router, or once per SSR request. */
export function createRouterAdapter<TRouter extends AnyRouter = RegisteredRouter>(router: TRouter) {
  const serverSnapshot = router.state.location.href
  const adapter: RouterAdapter = {
    subscribe: (listener) => router.subscribe("onResolved", listener),
    getSnapshot: () => router.state.location.href,
    getServerSnapshot: () => serverSnapshot
  }
  function route<const TOptions>(
    options: ValidateNavigateOptions<TRouter, TOptions>,
    match?: MatchRouteOptions
  ): RouteTarget
  function route(options: NavigateOptions, match: MatchRouteOptions = {}): RouteTarget {
    return {
      get href() {
        return router.buildLocation(options).href
      },
      isActive: () => router.matchRoute(options, { ...match, pending: false }) !== false,
      navigate: () => router.navigate(options)
    }
  }
  return { ...adapter, route }
}
