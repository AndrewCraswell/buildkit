import { describe, expect, it, vi } from "vitest"
import { createRoutePanel, createRouteTabs, type RouteTarget } from "./index.js"
function target(isActive = false): RouteTarget {
  return { href: "/", isActive: () => isActive, navigate: vi.fn<() => void>() }
}
describe("route state", () => {
  it("selects the first match, uses a display fallback, and never navigates while reading", () => {
    const route = target(true)
    expect(
      createRouteTabs({
        tabs: [
          { id: "one", route },
          { id: "two", route }
        ]
      }).activeTab
    ).toBe("one")
    expect(createRouteTabs({ tabs: [{ id: "one", route: target() }], defaultTab: "one" }).activeTab).toBe("one")
    expect(createRouteTabs({ tabs: [] }).activeTab).toBeUndefined()
    expect(route.navigate).not.toHaveBeenCalled()
  })
  it("navigates only inactive tabs and returns navigation errors", async () => {
    const route = target()
    const tabs = createRouteTabs({
      tabs: [
        { id: "one", route },
        { id: "two", route: target(true) }
      ]
    })
    tabs.select("one")
    tabs.select("two")
    expect(route.navigate).toHaveBeenCalledOnce()
    const error = new Error("blocked")
    const broken = createRouteTabs({
      tabs: [{ id: "one", route: { ...route, navigate: () => Promise.reject(error) } }]
    })
    await expect(broken.select("one")).rejects.toThrow("blocked")
    // @ts-expect-error Only configured IDs are valid.
    expect(() => tabs.select("missing")).toThrow("Unknown")
  })
  it("rejects duplicate IDs and invalid defaults", () => {
    const route = target()
    expect(() =>
      createRouteTabs({
        tabs: [
          { id: "one", route },
          { id: "one", route }
        ]
      })
    ).toThrow("unique")
    // @ts-expect-error The default must be a configured ID.
    expect(() => createRouteTabs({ tabs: [{ id: "one", route }], defaultTab: "missing" })).toThrow("Default")
  })
  it("reads current panel state for retained callbacks and exclusions", () => {
    let isActive = false
    const route = { ...target(), isActive: () => isActive }
    const closeTo = target()
    const panel = createRoutePanel({ route, closeTo })
    expect(panel.isOpen).toBe(false)
    panel.close()
    panel.setOpen(true)
    expect(route.navigate).toHaveBeenCalledOnce()
    isActive = true
    panel.open()
    panel.setOpen(false)
    expect(closeTo.navigate).toHaveBeenCalledOnce()
    expect(createRoutePanel({ route, closeTo }).isOpen).toBe(true)
    expect(createRoutePanel({ route, closeTo, exclude: [target(false)] }).isOpen).toBe(true)
    expect(createRoutePanel({ route, closeTo, exclude: [target(true)] }).isOpen).toBe(false)
  })
})
