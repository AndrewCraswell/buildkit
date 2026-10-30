import { FluentProvider, webLightTheme } from "@fluentui/react-components"
import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vite-plus/test"
import { AlertRegion, createAlertManager } from "./index.js"
afterEach(cleanup)
it("renders Fluent actions, persistent notices, and dismissal", () => {
  const manager = createAlertManager()
  const action = vi.fn<() => void>()
  render(
    <FluentProvider theme={webLightTheme}>
      <AlertRegion manager={manager} />
    </FluentProvider>
  )
  act(() => {
    manager.success({ title: "Saved", action: { label: "Undo", onClick: action } })
    manager.warning({ body: "Persistent", dismissible: false })
  })
  act(() => screen.getByRole("button", { name: "Undo" }).click())
  expect(action).toHaveBeenCalledOnce()
  act(() => screen.getByRole("button", { name: "Dismiss" }).click())
  expect(screen.queryByText("Saved")).toBeNull()
  expect(screen.getByText("Persistent")).toBeTruthy()
  expect(screen.queryByRole("button")).toBeNull()
})
it("accepts the shared custom adapter contract", () => {
  function Alert() {
    return <p>Custom surface</p>
  }
  const manager = createAlertManager({ adapter: { Alert } })
  manager.add({})
  render(<AlertRegion manager={manager} />)
  expect(screen.getByText("Custom surface")).toBeTruthy()
})
