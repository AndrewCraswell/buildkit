import { createRouter } from "@tanstack/react-router"
import { ErrorMessage, NotFound } from "./components"
import { routeTree } from "./routeTree.gen"

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultErrorComponent: ErrorMessage,
    defaultNotFoundComponent: NotFound
  })
}
