import { createRootRoute, createRoute, createRouter, createMemoryHistory } from "@tanstack/react-router"
import { act, renderHook } from "@testing-library/react"
import { expect, it } from "vitest"
import { createRouterAdapter, useRoutePanel, useRouteTabs } from "./index.js"
function setup() {
  const root = createRootRoute()
  const people = createRoute({ getParentRoute: () => root, path: "/people" })
  const detail = createRoute({ getParentRoute: () => root, path: "/people/$id" })
  const other = createRoute({ getParentRoute: () => root, path: "/other" })
  return createRouter({
    routeTree: root.addChildren([people, detail, other]),
    history: createMemoryHistory({ initialEntries: ["/people/42"] })
  })
}
it("uses native typed routes, params, direct-link dismissal and external navigation", async () => {
  const router = setup()
  await router.load()
  const adapter = createRouterAdapter(router)
  const people = adapter.route({ to: "/people" })
  const detail = adapter.route({ to: "/people/$id", params: { id: "42" } })
  const { result, unmount } = renderHook(() => ({
    panel: useRoutePanel(adapter, { route: detail, closeTo: people }),
    tabs: useRouteTabs(adapter, { tabs: [{ id: "people", route: adapter.route({ to: "/people" }, { fuzzy: true }) }] })
  }))
  expect(detail.href).toBe("/people/42")
  expect(adapter.getServerSnapshot()).toBe("/people/42")
  expect(result.current.panel.isOpen).toBe(true)
  expect(result.current.tabs.activeTab).toBe("people")
  await act(() => result.current.panel.close())
  expect(result.current.panel.isOpen).toBe(false)
  await act(() => result.current.panel.open())
  expect(result.current.panel.isOpen).toBe(true)
  await act(() => router.navigate({ to: "/other" }))
  expect(result.current.tabs.activeTab).toBeUndefined()
  unmount()
})
it("validates destinations and required params against the supplied router type", () => {
  const adapter = createRouterAdapter(setup())

  // @ts-expect-error Unknown route must be rejected.
  adapter.route({ to: "/missing" })
  // @ts-expect-error Required route params must be supplied.
  adapter.route({ to: "/people/$id" })
  // @ts-expect-error Param names must match the route.
  adapter.route({ to: "/people/$id", params: { wrong: "42" } })
  expect(adapter.route({ to: "/people" }).href).toBe("/people")
})
