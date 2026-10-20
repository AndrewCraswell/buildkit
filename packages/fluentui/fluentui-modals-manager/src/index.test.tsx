import { FluentProvider, webLightTheme } from "@fluentui/react-components"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { createModalManager, ModalRenderer } from "./index.js"

beforeEach(() => {
  const cancel = Animation.prototype.cancel
  // Happy DOM eagerly creates finished promises; Fluent consumes animation events instead.
  // Observe the expected cancellation rejection without disabling real motion callbacks.
  vi.spyOn(Animation.prototype, "cancel").mockImplementation(function (this: Animation) {
    void this.finished.catch(() => undefined)
    cancel.call(this)
  })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

it("uses the same cancellation guard for Escape and the form's Cancel action", async () => {
  const manager = createModalManager()
  let isAllowed = false
  const guard = vi.fn<() => boolean>(() => isAllowed)
  const definition = manager.createModal({
    title: "Guarded editor",
    initialState: { name: "Ada" },
    defaultResult: null,
    beforeDismiss: guard,
    render: function Editor({ controls, isPending }) {
      return (
        <button
          disabled={isPending}
          onClick={() => {
            void controls.dismiss()
          }}
        >
          Cancel editing
        </button>
      )
    }
  })
  const handle = definition.open()
  render(
    <FluentProvider theme={webLightTheme}>
      <ModalRenderer manager={manager} />
    </FluentProvider>
  )
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
  await waitFor(() => expect(manager.getSnapshot()[0].isPending).toBe(false))
  expect(guard).toHaveBeenCalledOnce()
  expect(handle.isActive()).toBe(true)
  isAllowed = true
  fireEvent.click(screen.getByRole("button", { name: "Cancel editing" }))
  expect(await handle).toBeNull()
  expect(guard).toHaveBeenCalledTimes(2)
  await waitFor(() => expect(manager.getSnapshot()).toHaveLength(0))
})

it("renders Fluent dialogs with shared confirmation and exit settlement", async () => {
  const manager = createModalManager()
  const handle = manager.confirm({
    title: "Delete draft?",
    description: "This removes the draft.",
    children: "Draft contents"
  })
  render(
    <FluentProvider theme={webLightTheme}>
      <ModalRenderer manager={manager} />
    </FluentProvider>
  )
  expect(screen.getByRole("dialog").getAttribute("aria-describedby")).toBeTruthy()
  expect(screen.getByText("Draft contents")).toBeDefined()
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }))
  expect(await handle).toBe(true)
  await waitFor(() => expect(manager.getSnapshot()).toHaveLength(0))
})

it("respects dismissal policy and removes entries closed before mounting", async () => {
  const manager = createModalManager()
  const handle = manager.open({ title: "Required", dismissible: false, surfaceProps: { className: "custom" } })
  const view = render(
    <FluentProvider theme={webLightTheme}>
      <ModalRenderer manager={manager} />
    </FluentProvider>
  )
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
  expect(handle.isActive()).toBe(true)
  fireEvent.click(screen.getByRole("button", { name: "Close" }))
  await handle
  await waitFor(() => expect(manager.getSnapshot()).toHaveLength(0))
  act(() => {
    const instant = manager.open({ title: "Instant" })
    instant.dismiss()
  })
  expect(manager.getSnapshot()).toHaveLength(0)
  view.unmount()
})

it("dismisses the top dialog with Escape", async () => {
  const manager = createModalManager()
  const handle = manager.alert({ title: "Notice" })
  render(
    <FluentProvider theme={webLightTheme}>
      <ModalRenderer manager={manager} />
    </FluentProvider>
  )
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
  await handle
  await waitFor(() => expect(manager.getSnapshot()).toHaveLength(0))
})
