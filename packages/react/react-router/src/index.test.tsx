import { act, renderHook } from "@testing-library/react"
import { createMemoryRouter } from "react-router"
import { expect, it } from "vite-plus/test"
import { createRouterAdapter, useRoutePanel, useRouteTabs } from "./index.js"
it("follows native navigation, preserves search on request, and handles direct-link dismissal and history", async () => {
  const router = createMemoryRouter([{ path: "*", element: null }], { initialEntries: ["/people/42?filter=active"] })
  const adapter = createRouterAdapter(router)
  const list = adapter.route({ to: "/people", preserveSearch: true })
  const detail = adapter.route({ to: "/people/42", match: "/people/:id", preserveSearch: true })
  const { result, unmount } = renderHook(() => ({
    panel: useRoutePanel(adapter, { route: detail, closeTo: list }),
    tabs: useRouteTabs(adapter, {
      tabs: [{ id: "people", route: adapter.route({ to: "/people", match: { path: "/people", end: false } }) }]
    })
  }))
  expect(result.current.panel.isOpen).toBe(true)
  expect(result.current.tabs.activeTab).toBe("people")
  expect(detail.href).toBe("/people/42?filter=active")
  expect(adapter.getServerSnapshot()).toBe("/people/42?filter=active")
  await act(() => result.current.panel.close())
  expect(router.state.location.search).toBe("?filter=active")
  expect(result.current.panel.isOpen).toBe(false)
  await act(() => router.navigate(-1))
  expect(result.current.panel.isOpen).toBe(true)
  await act(() => router.navigate("/unrelated"))
  expect(result.current.tabs.activeTab).toBeUndefined()
  await act(() => result.current.panel.open())
  expect(result.current.panel.isOpen).toBe(true)
  unmount()
  router.dispose()
})
it("supports basename, explicit query values, hashes and replace navigation", async () => {
  const router = createMemoryRouter([{ path: "*", element: null }], { basename: "/app", initialEntries: ["/app/"] })
  const adapter = createRouterAdapter(router)
  const root = adapter.route({ to: "/" })
  expect(root.isActive()).toBe(true)
  const route = adapter.route({
    to: { pathname: "/settings", search: "?tab=profile", hash: "#name" },
    preserveSearch: true,
    navigate: { replace: true }
  })
  expect(route.href).toBe("/app/settings?tab=profile#name")
  await route.navigate()
  expect(route.isActive()).toBe(true)
  expect(router.state.historyAction).toBe("REPLACE")
  router.dispose()
})
