import { act, cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderToString } from "react-dom/server"
import { afterEach, expect, it, vi } from "vite-plus/test"
import { AlertRegion, createAlertManager, useAlerts } from "./index.js"
import type { AlertRendererProps } from "./index.js"
afterEach(cleanup)
function Alert({ entry, dismiss, dismissLabel }: AlertRendererProps) {
  return (
    <div>
      {entry.title}
      <button onClick={dismiss}>{dismissLabel}</button>
    </div>
  )
}
it("renders external commands and region changes without a provider", async () => {
  const manager = createAlertManager({ adapter: { Alert } })
  const view = render(<AlertRegion manager={manager} />)
  act(() => {
    manager.add({ title: <strong>Global</strong> })
    manager.add({ title: "Panel" }, "panel")
  })
  expect(screen.getByText("Global")).toBeTruthy()
  expect(screen.queryByText("Panel")).toBeNull()
  view.rerender(<AlertRegion manager={manager} region="panel" dismissLabel="Close notice" />)
  expect(screen.getByText("Panel")).toBeTruthy()
  await userEvent.setup().click(screen.getByRole("button", { name: "Close notice" }))
  expect(screen.queryByText("Panel")).toBeNull()
  expect(manager.getSnapshot()).toHaveLength(1)
})
it("subscribes headlessly, uses empty SSR snapshots, and requires an adapter for rendering", () => {
  const manager = createAlertManager()
  manager.add({ title: "Client only" })
  function Count() {
    return <p>{useAlerts(manager).length}</p>
  }
  expect(renderToString(<Count />)).toContain("0")
  render(<Count />)
  expect(screen.getByText("1")).toBeTruthy()
  const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
  expect(() => render(<AlertRegion manager={manager} />)).toThrow("adapter")
  error.mockRestore()
})
