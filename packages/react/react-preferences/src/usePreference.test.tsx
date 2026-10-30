import { createPreferences } from "@buildkitgg/preferences-core"
import { act, cleanup, renderHook } from "@testing-library/react"
import { StrictMode } from "react"
import { renderToString } from "react-dom/server"
import { afterEach, expect, it } from "vite-plus/test"
import { usePreference, usePreferences } from "./index.js"

afterEach(cleanup)
it("supports external updates, typed setters, reset, and key changes without a provider", () => {
  const store = createPreferences<{ count: number; other: number }>({ defaults: { count: 1 } })
  const { result, rerender, unmount } = renderHook(
    ({ name }: { name: "count" | "other" }) => usePreference(store, name),
    { initialProps: { name: "count" }, wrapper: StrictMode }
  )
  act(() => store.set("count", 2))
  expect(result.current[0]).toBe(2)
  act(() => result.current[1](3))
  expect(store.get("count")).toBe(3)
  rerender({ name: "other" })
  expect(result.current[0]).toBeUndefined()
  act(() => result.current[1](4))
  expect(store.get("other")).toBe(4)
  act(() => store.resetAll())
  expect(result.current[0]).toBeUndefined()
  unmount()
  store.dispose()
})
it("uses default server state and subscribes to whole snapshots", () => {
  const store = createPreferences({ defaults: { count: 1 } })
  store.set("count", 2)
  function Consumer() {
    return <span>{usePreferences(store).count}</span>
  }
  expect(renderToString(<Consumer />)).toBe("<span>1</span>")
  const { result } = renderHook(() => usePreferences(store))
  expect(result.current.count).toBe(2)
})
