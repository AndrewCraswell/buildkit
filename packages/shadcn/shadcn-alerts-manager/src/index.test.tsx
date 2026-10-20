import { act, cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, expect, it, vi } from "vitest"
import { AlertRegion, createAlertManager } from "./index.js"
afterEach(cleanup)
it("renders native alerts, actions, intents, and localized dismissal", async () => {
  const manager = createAlertManager()
  const onAction = vi.fn<() => void>()
  render(<AlertRegion manager={manager} dismissLabel="Close notice" />)
  act(() => {
    manager.error({ title: "Failed", body: "Try again", action: { label: "Retry", onClick: onAction } })
    manager.info({ title: "Persistent", dismissible: false })
  })
  expect(screen.getByRole("alert").textContent).toContain("Failed")
  expect(screen.getByRole("status").textContent).toContain("Persistent")
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: "Retry" }))
  expect(onAction).toHaveBeenCalledOnce()
  await user.click(screen.getByRole("button", { name: "Close notice" }))
  expect(manager.getSnapshot()).toHaveLength(1)
  expect(screen.queryByRole("button")).toBeNull()
})
it("accepts a custom adapter at the manager boundary", () => {
  function Alert() {
    return <p>Custom surface</p>
  }
  const manager = createAlertManager({ adapter: { Alert } })
  manager.add({})
  render(<AlertRegion manager={manager} />)
  expect(screen.getByText("Custom surface")).toBeTruthy()
})
