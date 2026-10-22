import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { StrictMode, useState } from "react"
import { renderToString } from "react-dom/server"
import { afterEach, expect, expectTypeOf, it, vi } from "vitest"
import { createModalManager, ModalRenderer, useModalExit, useModals } from "./index.js"
import type { ModalSlotProps, ModalSurfaceProps } from "./index.js"

afterEach(cleanup)

function TestSurface({ entry, title, body, footer, children }: ModalSurfaceProps<object>) {
  useModalExit(entry)
  return (
    <section aria-label={String(title)}>
      {body}
      {footer}
      <button onClick={entry.dismiss}>Dismiss surface</button>
      <button onClick={entry.finishExit}>Finish exit</button>
      {children}
    </section>
  )
}
function NameBody({ data, controls }: ModalSlotProps<{ name: string }, string>) {
  const [count, setCount] = useState(0)
  return (
    <>
      <span>{data.name}</span>
      <button onClick={() => setCount(count + 1)}>Count {count}</button>
      <button onClick={() => controls.close(data.name)}>Save name</button>
    </>
  )
}

it("shares confirm, alert, labels and typed updates in one manager", async () => {
  const manager = createModalManager({ adapter: { Surface: TestSurface }, labels: { cancel: "Keep", close: "Done" } })
  const confirmation = manager.confirm({ title: "Delete", body: "Original" })
  render(<ModalRenderer manager={manager} />)
  act(() => confirmation.update({ title: "Updated title", body: "Updated", confirmLabel: "Proceed" }))
  expect(screen.getByRole("region", { name: "Updated title" })).toBeDefined()
  expect(screen.getByText("Updated")).toBeDefined()
  expect(screen.getByRole("button", { name: "Keep" })).toBeDefined()
  fireEvent.click(screen.getByRole("button", { name: "Proceed" }))
  expect(await confirmation).toBe(true)
  let cancelled: ReturnType<typeof manager.confirm> | undefined
  act(() => {
    manager.clear()
    cancelled = manager.confirm({ title: "Cancel", cancelLabel: "Keep item" })
  })
  fireEvent.click(screen.getByRole("button", { name: "Keep item" }))
  expect(await cancelled).toBe(false)
  let alert: ReturnType<typeof manager.alert> | undefined
  act(() => {
    manager.clear()
    alert = manager.alert({ title: "Saved" })
  })
  fireEvent.click(screen.getByRole("button", { name: "Done" }))
  expect(await alert).toBeUndefined()
  act(() => manager.dispose())
})

it("renders typed components, preserves their state on updates, and settles on real unmount", async () => {
  const manager = createModalManager({ adapter: { Surface: TestSurface } })
  const name = manager.createModal({
    body: { component: NameBody },
    initialState: { name: "" },
    title: "Name",
    defaultResult: ""
  })
  const handle = name.open({ name: "Ada" }, { id: "name" })
  expectTypeOf(handle).resolves.toEqualTypeOf<string>()
  const view = render(
    <StrictMode>
      <ModalRenderer manager={manager} />
    </StrictMode>
  )
  await act(async () => {
    await Promise.resolve()
  })
  expect(handle.isActive()).toBe(true)
  fireEvent.click(screen.getByText("Count 0"))
  act(() => handle.update({ data: { name: "Grace" } }))
  expect(screen.getByText("Count 1")).toBeDefined()
  expect(screen.getByText("Grace")).toBeDefined()
  fireEvent.click(screen.getByText("Save name"))
  expect(await handle).toBe("Grace")
  fireEvent.click(screen.getByText("Finish exit"))
  expect(manager.getSnapshot()).toHaveLength(0)
  let pending = manager.open({ title: "Pending" })
  // Rendering updates outside React's event system is supported via subscriptions.
  await act(async () => {
    pending.dismiss()
    manager.clear()
    pending = manager.open({ title: "Unmount" })
  })
  view.unmount()
  await act(async () => {
    await Promise.resolve()
  })
  expect(await pending).toBeUndefined()
  expect(manager.getSnapshot()).toHaveLength(0)
})

it("cleans up open-and-close in one batch and gives SSR a stable empty snapshot", async () => {
  const manager = createModalManager({ adapter: { Surface: TestSurface } })
  const handle = manager.open({ title: "Instant" })
  handle.dismiss()
  render(<ModalRenderer manager={manager} />)
  expect(manager.getSnapshot()).toHaveLength(0)
  function Count() {
    return <span>{useModals(manager).length}</span>
  }
  act(() => {
    manager.open({ title: "Client only" })
  })
  expect(renderToString(<Count />)).toContain("0")
  manager.clear()
  await handle
})

it("rejects multiple renderers for one manager", () => {
  const manager = createModalManager({ adapter: { Surface: TestSurface } })
  render(<ModalRenderer manager={manager} />)
  const spy = vi.spyOn(console, "error").mockImplementation(() => undefined)
  try {
    expect(() => render(<ModalRenderer manager={manager} />)).toThrow(/one modal renderer/)
  } finally {
    spy.mockRestore()
  }
})

it("explains the missing adapter when rendering a headless manager", () => {
  const manager = createModalManager()
  expect(() => renderToString(<ModalRenderer manager={manager} />)).toThrow(/Pass an adapter to createModalManager/)
})

// Checked by the package type build; invalid operations never run.
function checkTypes() {
  const manager = createModalManager<{ className?: string }>()
  const definition = manager.createModal<{ name: string }, string>({
    body: { component: NameBody },
    initialState: { name: "" },
    title: "Edit",
    defaultResult: ""
  })
  const handle = definition.open({ name: "Ada" })
  // @ts-expect-error A result must match the definition.
  handle.close(false)
  // @ts-expect-error Updates only accept the definition's data keys.
  handle.update({ data: { surname: "Lovelace" } })
  // @ts-expect-error Input values are typed.
  definition.open({ name: 1 })
  // @ts-expect-error Custom result types require a dismissal result.
  manager.createModal({ body: { component: NameBody }, initialState: { name: "" }, title: "Edit" })
  // @ts-expect-error UI options retain the adapter's surface type.
  manager.open({ title: "Edit", surfaceProps: { unknownProp: true } })
}
void checkTypes
