import { Dialog as Primitive } from "@base-ui/react/dialog"
import * as Radix from "@radix-ui/react-dialog"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { StrictMode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { baseUiComponents, createModalManager, ModalRenderer, radixComponents } from "./index.js"
import type { BaseUiModalComponents, RadixModalComponents } from "./index.js"

const components: BaseUiModalComponents = {
  Dialog: Primitive.Root,
  DialogContent: function Content({ showCloseButton: _showCloseButton, ...props }) {
    return (
      <Primitive.Portal>
        <Primitive.Backdrop />
        <Primitive.Popup {...props} />
      </Primitive.Portal>
    )
  },
  DialogTitle: Primitive.Title,
  DialogDescription: Primitive.Description,
  DialogFooter: function Footer({ children }) {
    return <footer>{children}</footer>
  },
  Button: function Button({ variant: _variant, ...props }) {
    return <button {...props} />
  }
}
const radix: RadixModalComponents = {
  ...components,
  Dialog: Radix.Root,
  DialogContent: function Content({ showCloseButton: _showCloseButton, ...props }) {
    return (
      <Radix.Portal>
        <Radix.Overlay />
        <Radix.Content {...props} />
      </Radix.Portal>
    )
  },
  DialogTitle: Radix.Title,
  DialogDescription: Radix.Description
}
const radixAdapter = radixComponents(radix)
const adapters = [
  { name: "default", adapter: undefined },
  { name: "registry Base UI", adapter: baseUiComponents(components) },
  { name: "registry Radix", adapter: radixAdapter }
]
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe.each(adapters)("$name", ({ adapter }) => {
  it("renders custom slots and supports explicit accessible names with no visible title", async () => {
    const manager = createModalManager({ adapter })
    const modal = manager.confirm({
      title: <em>Preview</em>,
      body: <p>Draft content</p>,
      footer: <button className="consumer-style">Preview action</button>
    })
    render(<ModalRenderer manager={manager} />)
    expect(screen.getByRole("dialog", { name: "Preview" })).toBeDefined()
    expect(screen.getByRole("button", { name: "Preview action" }).className).toBe("consumer-style")
    expect(screen.queryByRole("button", { name: "Confirm" })).toBeNull()
    act(() => modal.update({ title: null, ariaLabel: "Named preview", body: <p>Revised content</p>, footer: null }))
    const dialog = screen.getByRole("dialog", { name: "Named preview" })
    expect(dialog.textContent).toContain("Revised content")
    expect(screen.queryByRole("button", { name: "Preview action" })).toBeNull()
    act(() => modal.update({ title: <strong>Visible again</strong>, ariaLabel: undefined, footer: undefined }))
    expect(screen.getByRole("dialog", { name: "Visible again" })).toBeDefined()
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }))
    expect(await modal).toBe(true)
  })

  it("updates a custom dialog's accessible name, description, styling and Escape behavior", async () => {
    const manager = createModalManager({ adapter })
    const handle = manager
      .createModal({
        title: "Profile",
        description: "Original description",
        initialState: { name: "Ada" },
        defaultResult: null,
        body: {
          component: ({ data, controls }) => (
            <button onClick={() => controls.update({ dismissible: true })}>{data.name}</button>
          )
        }
      })
      .open()
    render(<ModalRenderer manager={manager} />)
    act(() => {
      handle.update({
        title: "Updated profile",
        description: "Review changes",
        dismissible: false,
        surfaceProps: { className: "updated-profile" }
      })
      handle.update({ data: { name: "Grace" } })
    })
    const dialog = screen.getByRole("dialog", { name: "Updated profile" })
    expect(dialog.classList.contains("updated-profile")).toBe(true)
    expect(document.getElementById(dialog.getAttribute("aria-describedby") ?? "")?.textContent).toBe("Review changes")
    fireEvent.keyDown(dialog, { key: "Escape" })
    expect(handle.isActive()).toBe(true)
    fireEvent.click(screen.getByRole("button", { name: "Grace" }))
    fireEvent.keyDown(dialog, { key: "Escape" })
    await waitFor(() => expect(handle.isActive()).toBe(false))
    expect(await handle).toBeNull()
  })

  it("uses the same cancellation guard for Escape and the form's Cancel action", async () => {
    const manager = createModalManager({ adapter })
    let isAllowed = false
    const guard = vi.fn<() => boolean>(() => isAllowed)
    const definition = manager.createModal({
      title: "Guarded editor",
      initialState: { name: "Ada" },
      defaultResult: null,
      beforeDismiss: guard,
      body: {
        component: function Editor({ controls, isPending }) {
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
      }
    })
    const handle = definition.open()
    render(
      <StrictMode>
        <ModalRenderer manager={manager} />
      </StrictMode>
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

  it("settles confirmations and applies external body updates", async () => {
    const manager = createModalManager({ adapter })
    const handle = manager.confirm({ title: "Delete draft?", description: "Removes the draft", body: "Old body" })
    render(<ModalRenderer manager={manager} />)
    expect(screen.getByRole("dialog", { name: "Delete draft?", description: "Removes the draft" })).toBeDefined()
    act(() => handle.update({ body: "New body" }))
    expect(screen.getByText("New body")).toBeDefined()
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }))
    expect(await handle).toBe(true)
    await waitFor(() => expect(manager.getSnapshot()).toHaveLength(0))
  })

  it("honors dismissal policy, shared surface styling, and immediate close", async () => {
    const manager = createModalManager({ adapter })
    const handle = manager.open({
      title: "Required",
      dismissible: false,
      surfaceProps: { className: "custom", style: { maxWidth: 360 } }
    })
    render(<ModalRenderer manager={manager} />)
    const dialog = screen.getByRole("dialog")
    expect(dialog.classList.contains("custom")).toBe(true)
    expect(dialog.style.maxWidth).toBe("360px")
    fireEvent.keyDown(dialog, { key: "Escape" })
    expect(handle.isActive()).toBe(true)
    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    await handle
    await waitFor(() => expect(manager.getSnapshot()).toHaveLength(0))
    act(() => {
      const instant = manager.alert({ title: "Instant" })
      void instant.dismiss()
    })
    expect(manager.getSnapshot()).toHaveLength(0)
  })

  it("restores focus after closing only the nested dialog", async () => {
    const manager = createModalManager({ adapter })
    render(
      <>
        <button
          onClick={() =>
            manager.open({
              title: "Parent",
              body: <button onClick={() => manager.confirm({ title: "Child" })}>Open child</button>
            })
          }
        >
          Launch
        </button>
        <ModalRenderer manager={manager} />
      </>
    )
    const launcher = screen.getByRole("button", { name: "Launch" })
    launcher.focus()
    fireEvent.click(launcher)
    const childLauncher = screen.getByRole("button", { name: "Open child" })
    childLauncher.focus()
    fireEvent.click(childLauncher)
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Child" }), { key: "Escape" })
    await waitFor(() => expect(manager.getSnapshot()).toHaveLength(1))
    await waitFor(() => expect(document.activeElement).toBe(childLauncher))
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Parent" }), { key: "Escape" })
    await waitFor(() => expect(manager.getSnapshot()).toHaveLength(0))
    await waitFor(() => expect(document.activeElement).toBe(launcher))
  })

  it("keeps a typed form open after failure, blocks duplicate submissions and retries", async () => {
    const manager = createModalManager({ adapter })
    let rejectSave: (error: Error) => void = () => undefined
    let attempts = 0
    const definition = manager.createModal({
      title: "Profile",
      initialState: { name: "Ada" },
      defaultResult: null,
      body: {
        component: function Profile({ data, controls, error, isPending }) {
          return (
            <>
              <p>{data.name}</p>
              {error instanceof Error && <p role="alert">{error.message}</p>}
              <button
                disabled={isPending}
                onClick={() => {
                  void controls.submit(() => {
                    attempts++
                    return attempts === 1
                      ? new Promise<{ name: string }>((_, reject) => {
                          rejectSave = reject
                        })
                      : data
                  })
                }}
              >
                Save profile
              </button>
            </>
          )
        }
      }
    })
    const handle = definition.open()
    render(<ModalRenderer manager={manager} />)
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }))
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }))
    expect(attempts).toBe(1)
    expect(screen.getByRole("dialog").getAttribute("aria-busy")).toBe("true")
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
    expect(handle.isActive()).toBe(true)
    await act(async () => {
      rejectSave(new Error("Save failed"))
    })
    expect(screen.getByRole("alert").textContent).toBe("Save failed")
    act(() => handle.update({ data: { name: "Grace" } }))
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }))
    expect(await handle).toEqual({ name: "Grace" })
    await waitFor(() => expect(manager.getSnapshot()).toHaveLength(0))
  })
})

it("waits for Radix's actual CSS exit event before removing a closing entry", async () => {
  const getStyle = window.getComputedStyle.bind(window)
  vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) => {
    const style = getStyle(element, pseudo)
    if (element.getAttribute("role") === "dialog") {
      // Model the live computed style that a browser exposes during CSS animation.
      return new Proxy(style, {
        get(target, property) {
          if (property === "animationName") {
            return element.getAttribute("data-state") === "closed" ? "modal-exit" : "modal-enter"
          }
          return Reflect.get(target, property)
        }
      })
    }
    return style
  })
  const manager = createModalManager({ adapter: radixAdapter })
  const handle = manager.confirm({ title: "Animated" })
  render(
    <StrictMode>
      <ModalRenderer manager={manager} />
    </StrictMode>
  )
  const dialog = screen.getByRole("dialog")
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }))
  expect(await handle).toBe(true)
  // Flush native focus-scope cleanup from StrictMode while the exit animation is still active.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  expect(manager.getSnapshot()[0].status).toBe("closing")
  expect(dialog.isConnected).toBe(true)
  fireEvent.animationEnd(dialog, { animationName: "modal-exit" })
  await waitFor(() => expect(manager.getSnapshot()).toHaveLength(0))
})
