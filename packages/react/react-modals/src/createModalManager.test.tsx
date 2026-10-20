import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { StrictMode, useState } from "react"
import { renderToString } from "react-dom/server"
import { afterEach, expect, expectTypeOf, it, vi } from "vitest"
import { createModalManager, ModalRenderer, useModalExit, useModals } from "./index.js"
import type { ModalBodyProps, ModalSurfaceProps } from "./index.js"

afterEach(cleanup)

function TestSurface({ entry, body, children }: ModalSurfaceProps<object>) {
  useModalExit(entry)
  return (
    <section aria-label={String(entry.content.title)}>
      {body}
      {entry.content.actions.map((action, index) => (
        <button key={index} onClick={action.onClick}>
          {action.label}
        </button>
      ))}
      <button onClick={entry.dismiss}>Dismiss surface</button>
      <button onClick={entry.finishExit}>Finish exit</button>
      {children}
    </section>
  )
}
function NameBody({ data, controls }: ModalBodyProps<{ name: string }, string>) {
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
  const manager = createModalManager({ labels: { cancel: "Keep", close: "Done" } })
  const confirmation = manager.confirm({ title: "Delete", children: "Original" })
  confirmation.update({ children: "Updated" })
  expect(manager.getSnapshot()[0].content.renderBody(manager.getSnapshot()[0])).toBe("Updated")
  expect(manager.getSnapshot()[0].content.actions[0].label).toBe("Keep")
  manager.getSnapshot()[0].content.actions[1].onClick()
  expect(await confirmation).toBe(true)
  const cancelled = manager.confirm({ title: "Cancel", confirmLabel: "Delete", cancelLabel: "Keep item" })
  manager.getSnapshot()[1].content.actions[0].onClick()
  expect(await cancelled).toBe(false)
  const alert = manager.alert({ title: "Saved" })
  expect(manager.getSnapshot()[2].content.actions[0].label).toBe("Done")
  const opened = manager.open({ title: "Info", closeLabel: "Got it" })
  manager.getSnapshot()[3].content.actions[0].onClick()
  expect(await opened).toBeUndefined()
  manager.closeAll()
  expect(await alert).toBeUndefined()
  manager.dispose()
})

it("renders typed components, preserves their state on updates, and settles on real unmount", async () => {
  const manager = createModalManager({ adapter: { Surface: TestSurface } })
  const name = manager.createModal({ render: NameBody, initialState: { name: "" }, title: "Name", defaultResult: "" })
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
  act(() => handle.update({ name: "Grace" }))
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
    render: NameBody,
    initialState: { name: "" },
    title: "Edit",
    defaultResult: ""
  })
  const handle = definition.open({ name: "Ada" })
  // @ts-expect-error A result must match the definition.
  handle.close(false)
  // @ts-expect-error Updates only accept the definition's data keys.
  handle.update({ surname: "Lovelace" })
  // @ts-expect-error Input values are typed.
  definition.open({ name: 1 })
  // @ts-expect-error Custom result types require a dismissal result.
  manager.createModal({ render: NameBody, initialState: { name: "" }, title: "Edit" })
  // @ts-expect-error UI options retain the adapter's surface type.
  manager.open({ title: "Edit", surfaceProps: { unknownProp: true } })
}
void checkTypes
