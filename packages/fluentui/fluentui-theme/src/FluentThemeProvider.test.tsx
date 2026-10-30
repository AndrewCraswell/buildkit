import { Button, webLightTheme, webDarkTheme } from "@fluentui/react-components"
import { act, cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { StrictMode } from "react"
import { renderToString } from "react-dom/server"
import { afterEach, expect, it, vi } from "vite-plus/test"
import { createFluentTheme, FluentThemeProvider, useTheme } from "./index.js"

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.unstubAllGlobals()
})

it("reacts to external selection and maps custom tokens under StrictMode", async () => {
  const store = createFluentTheme({
    lightTheme: { ...webLightTheme, colorBrandBackground: "red" },
    darkTheme: { ...webDarkTheme, colorBrandBackground: "purple" }
  })
  function Consumer() {
    const state = useTheme(store)
    return <Button onClick={() => store.setTheme("dark")}>{state.resolvedTheme}</Button>
  }
  const view = render(
    <StrictMode>
      <FluentThemeProvider store={store} dir="rtl" data-testid="provider">
        <Consumer />
      </FluentThemeProvider>
    </StrictMode>
  )
  expect(screen.getByTestId("provider").getAttribute("dir")).toBe("rtl")
  await userEvent.click(screen.getByRole("button", { name: "light" }))
  expect(screen.getByRole("button", { name: "dark" })).toBeDefined()
  expect(
    Array.from(document.styleSheets)
      .flatMap((sheet) => Array.from(sheet.cssRules, (rule) => rule.cssText))
      .join("\n")
  ).toMatch(/--colorBrandBackground:\s*purple/)
  act(() => store.reset())
  expect(screen.getByRole("button", { name: "light" })).toBeDefined()
  view.unmount()
})

it("shares browser connections, restores selection and cleans up idempotently", () => {
  localStorage.setItem("fluent-test", '{"theme":"dark"}')
  const store = createFluentTheme({ storageKey: "fluent-test" })
  const stop = store.start()
  const stopOther = store.start()
  expect(store.getSnapshot().theme).toBe("dark")
  expect(store.themes.dark).toBe(webDarkTheme)
  stop()
  stop()
  store.setTheme("light")
  expect(localStorage.getItem("fluent-test")).toBe('{"theme":"light"}')
  stopOther()
  store.setTheme("dark")
  expect(localStorage.getItem("fluent-test")).toBe('{"theme":"light"}')
  store.start()()
  expect(store.getSnapshot().theme).toBe("light")
})

it("renders the server default without connecting browser storage", () => {
  const store = createFluentTheme({ defaultTheme: "dark" })
  vi.stubGlobal("window", undefined)
  store.start()()
  function Consumer() {
    return <span>{useTheme(store).resolvedTheme}</span>
  }
  expect(
    renderToString(
      <FluentThemeProvider store={store}>
        <Consumer />
      </FluentThemeProvider>
    )
  ).toContain("dark")
})
