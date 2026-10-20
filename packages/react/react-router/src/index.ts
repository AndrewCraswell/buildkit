import type { RouterAdapter, RouteTarget } from "@buildkitgg/router-core"
import {
  createPath,
  parsePath,
  matchPath,
  resolvePath,
  type createMemoryRouter,
  type To,
  type NavigateOptions,
  type PathPattern
} from "react-router"
export { useRouteTabs, useRoutePanel } from "@buildkitgg/react-routing"
export type { RouteTarget, RouteTab, RouteTabsOptions, RoutePanelOptions } from "@buildkitgg/router-core"
type DataRouter = Pick<
  ReturnType<typeof createMemoryRouter>,
  "state" | "subscribe" | "navigate" | "createHref" | "basename"
>
export type RouteOptions = {
  to: To
  navigate?: NavigateOptions
  /** Defaults to an exact match of the resolved destination pathname. */
  match?: string | PathPattern
  preserveSearch?: boolean
}
/** Create once per router. Requires a data router (createBrowserRouter/createMemoryRouter). */
export function createRouterAdapter(router: DataRouter) {
  const serverSnapshot = createPath(router.state.location)
  const basename = (router.basename ?? "/").replace(/\/$/, "")
  const adapter: RouterAdapter = {
    subscribe: (listener) => router.subscribe(() => listener()),
    getSnapshot: () => createPath(router.state.location),
    getServerSnapshot: () => serverSnapshot
  }
  function route(options: RouteOptions): RouteTarget {
    function destination() {
      const path = resolvePath(options.to, "/")
      return options.preserveSearch && !path.search ? { ...path, search: router.state.location.search } : path
    }
    return {
      get href() {
        return router.createHref({
          ...router.state.location,
          ...destination(),
          pathname: basename + destination().pathname
        })
      },
      isActive(location = createPath(router.state.location)) {
        const pathname = (parsePath(location).pathname ?? "/").slice(basename.length) || "/"
        return matchPath(options.match ?? { path: destination().pathname, end: true }, pathname) !== null
      },
      navigate: () => router.navigate(destination(), options.navigate)
    }
  }
  return { ...adapter, route }
}
