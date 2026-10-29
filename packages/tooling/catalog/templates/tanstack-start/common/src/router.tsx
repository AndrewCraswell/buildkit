import { createRouter, type AnyRouter } from "@tanstack/react-router"
import { NotFound, RouteError } from "./components/route-states"
import { routerRewrite, routerWrappers } from "./generated/buildkit/client"
import { routeTree } from "./routeTree.gen"

/** Extends the router in place, such as wrapping it in a provider or carrying state from the server to the browser. */
type RouterWrapper = (router: AnyRouter) => void

const wrappers: RouterWrapper[] = [...routerWrappers.pre, ...routerWrappers.framework, ...routerWrappers.post]

export function getRouter() {
  // The server makes a router for each request, so nothing one visitor loads reaches another.
  const router = createRouter({
    routeTree,
    rewrite: routerRewrite,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultErrorComponent: RouteError,
    defaultNotFoundComponent: NotFound
  })
  for (const wrap of wrappers) {
    wrap(router)
  }
  return router
}
