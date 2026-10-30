import { createThemeStore } from "@buildkitgg/theme-core"
import { act, cleanup, renderHook } from "@testing-library/react"
import { StrictMode } from "react"
import { renderToString } from "react-dom/server"
import { afterEach, expect, it } from "vite-plus/test"
import { useTheme } from "./index.js"

afterEach(cleanup)

it("updates without a provider when called outside React", () => {
  const store = createThemeStore()
  const { result, unmount } = renderHook(() => useTheme(store), { wrapper: StrictMode })
  act(() => store.setTheme("dark"))
  expect(result.current.resolvedTheme).toBe("dark")
  act(() => result.current.setTheme("light"))
  expect(store.getSnapshot().theme).toBe("light")
  act(() => result.current.reset())
  expect(store.getSnapshot().theme).toBe("system")
  unmount()
  expect(() => store.setTheme("system")).not.toThrow()
})

it("renders an immutable server snapshot", () => {
  const store = createThemeStore({ defaultTheme: "light" })
  store.setTheme("dark")
  function Consumer() {
    return <span>{useTheme(store).resolvedTheme}</span>
  }
  expect(renderToString(<Consumer />)).toBe("<span>light</span>")
})
