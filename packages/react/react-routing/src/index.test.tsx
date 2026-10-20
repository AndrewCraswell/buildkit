import { act, renderHook } from "@testing-library/react"
import { expect, it, vi } from "vitest"
import { useRouteTabs, useRoutePanel } from "./index.js"
it("subscribes to the router, follows external changes, and unsubscribes", () => {
  let path = "/one"
  const listeners = new Set<() => void>()
  const stop = vi.fn<() => void>()
  const adapter = {
    getSnapshot: () => path,
    getServerSnapshot: () => "/one",
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
        stop()
      }
    }
  }
  const route = (href: string) => ({
    href,
    isActive: () => path === href,
    navigate: () => {
      path = href
      listeners.forEach((listener) => listener())
    }
  })
  const one = route("/one"),
    two = route("/two")
  const { result, unmount } = renderHook(() => ({
    tabs: useRouteTabs(adapter, {
      tabs: [
        { id: "one", route: one },
        { id: "two", route: two }
      ]
    }),
    panel: useRoutePanel(adapter, { route: two, closeTo: one })
  }))
  expect(result.current.tabs.activeTab).toBe("one")
  act(() => result.current.panel.open())
  expect(result.current.tabs.activeTab).toBe("two")
  expect(result.current.panel.isOpen).toBe(true)
  act(() => {
    path = "/unknown"
    listeners.forEach((listener) => listener())
  })
  expect(result.current.tabs.activeTab).toBeUndefined()
  expect(result.current.panel.isOpen).toBe(false)
  unmount()
  expect(listeners.size).toBe(0)
  expect(stop).toHaveBeenCalledTimes(2)
})
