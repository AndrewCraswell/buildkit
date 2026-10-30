import { act, cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { afterEach, expect, it, vi } from "vite-plus/test"
import { createModalManager, ModalRenderer } from "./index.js"
import type { ModalCloseEvent, ModalSlotProps, ModalSurfaceProps } from "./index.js"

afterEach(cleanup)

function Surface({ entry, title, body, footer }: ModalSurfaceProps<object>) {
  return (
    <section aria-label={entry.content.ariaLabel ?? "Modal"}>
      <h2>{title}</h2>
      <main>{body}</main>
      <footer>{footer}</footer>
    </section>
  )
}

function Counter({ data }: ModalSlotProps<{ count: number }>) {
  const [local, setLocal] = useState(0)
  return (
    <button onClick={() => setLocal(local + 1)}>
      Count {data.count}, local {local}
    </button>
  )
}

it.each(["standard", "custom"])("passes only public slot props to %s modal components", (kind) => {
  const manager = createModalManager({ adapter: { Surface } })
  function Slot(props: object) {
    return <span>{Object.getOwnPropertyNames(props).sort().join(", ")}</span>
  }
  const slots = { title: { component: Slot }, body: { component: Slot }, footer: { component: Slot } }
  if (kind === "standard") {
    manager.open(slots)
  } else {
    manager.createModal({ ...slots, initialState: {}, defaultResult: null }).open()
  }
  render(<ModalRenderer manager={manager} />)
  expect(screen.getAllByText("controls, data, error, isPending")).toHaveLength(3)
  act(() => manager.dispose())
})

it("preserves component state across updates and sibling replacement, and remounts a replaced component", async () => {
  const user = userEvent.setup()
  const manager = createModalManager({ adapter: { Surface } })
  const modal = manager
    .createModal({
      title: <em>Counter</em>,
      initialState: { count: 0 },
      defaultResult: null,
      body: { component: Counter },
      footer: {
        component: function Footer({ data, controls }) {
          return (
            <button onClick={() => controls.update({ data: { count: data.count + 1 } })}>Increase {data.count}</button>
          )
        }
      }
    })
    .open()
  render(<ModalRenderer manager={manager} />)
  await user.click(screen.getByRole("button", { name: "Count 0, local 0" }))
  await user.click(screen.getByRole("button", { name: "Increase 0" }))
  expect(screen.getByRole("button", { name: "Count 1, local 1" })).toBeTruthy()
  act(() => modal.update({ title: <strong>Updated</strong>, footer: <span>New footer</span> }))
  expect(screen.getByRole("button", { name: "Count 1, local 1" })).toBeTruthy()
  act(() => modal.update({ body: <p>Replacement body</p> }))
  expect(screen.queryByRole("button")).toBeNull()
  act(() => modal.update({ body: { component: Counter } }))
  expect(screen.getByRole("button", { name: "Count 1, local 0" })).toBeTruthy()
  act(() => manager.dispose())
})

it("replaces helper buttons with a custom footer, clears with null, and restores defaults with undefined", async () => {
  const user = userEvent.setup()
  const manager = createModalManager({ adapter: { Surface } })
  const modal = manager.confirm({ title: "Publish", footer: <button className="custom">Preview</button> })
  render(<ModalRenderer manager={manager} />)
  expect(screen.getByRole("button", { name: "Preview" }).className).toBe("custom")
  expect(screen.queryByRole("button", { name: "Confirm" })).toBeNull()
  act(() => modal.update({ footer: null, body: "Preview ready" }))
  expect(screen.queryByRole("button")).toBeNull()
  act(() => modal.update({ footer: undefined, confirmLabel: "Publish now" }))
  await user.click(screen.getByRole("button", { name: "Publish now" }))
  expect(await modal).toBe(true)
  act(() => manager.dispose())
})

it("rejects missing names atomically and lets an explicit accessible label replace the title", () => {
  const manager = createModalManager({ adapter: { Surface } })
  expect(() => manager.open({ title: null })).toThrow("title")
  expect(() => manager.open({ title: "Title", ariaLabel: " " })).toThrow("ariaLabel")
  const modal = manager.open({ title: "Original" })
  const snapshot = manager.getSnapshot()
  expect(() => modal.update({ title: null })).toThrow("title")
  expect(manager.getSnapshot()).toBe(snapshot)
  render(<ModalRenderer manager={manager} />)
  act(() => modal.update({ title: null, ariaLabel: "Icon dialog" }))
  expect(screen.getByRole("region", { name: "Icon dialog" })).toBeTruthy()
  act(() => manager.dispose())
})

it("uses the latest close callback and supports clearing it", async () => {
  const manager = createModalManager()
  const original = vi.fn<(event: ModalCloseEvent<boolean>) => void>()
  const latest = vi.fn<(event: ModalCloseEvent<boolean>) => void>()
  const modal = manager.confirm({ title: "Confirm", onClose: original })
  modal.update({ onClose: latest })
  await modal.dismiss()
  modal.close(true)
  expect(original).not.toHaveBeenCalled()
  expect(latest).toHaveBeenCalledExactlyOnceWith({ id: modal.id, result: false, reason: "dismissed" })
  const silent = manager.confirm({ title: "Silent", onClose: original })
  silent.update({ onClose: null })
  silent.close(true)
  expect(original).not.toHaveBeenCalled()
  manager.dispose()
})

it("provides live pending and error state to all component slots", async () => {
  const manager = createModalManager({ adapter: { Surface } })
  let rejectSave: (error: Error) => void = () => undefined
  function Status({ isPending, error }: ModalSlotProps<object>) {
    const message = error instanceof Error ? error.message : "Ready"
    return <span>{isPending ? "Working" : message}</span>
  }
  const modal = manager
    .createModal({
      title: { component: Status },
      body: { component: Status },
      footer: { component: Status },
      initialState: {},
      defaultResult: null
    })
    .open()
  render(<ModalRenderer manager={manager} />)
  let pending: Promise<boolean> | undefined
  act(() => {
    pending = modal.submit(
      () =>
        new Promise<null>((_resolve, reject) => {
          rejectSave = reject
        })
    )
  })
  expect(screen.getAllByText("Working")).toHaveLength(3)
  await act(async () => {
    rejectSave(new Error("Try again"))
    await pending
  })
  expect(screen.getAllByText("Try again")).toHaveLength(3)
  act(() => manager.dispose())
})

it("does not publish or invalidate a pending guard for an unchanged patch", async () => {
  const manager = createModalManager()
  let approve: (allowed: boolean) => void = () => undefined
  const modal = manager
    .createModal({
      title: "Guard",
      initialState: { count: 0 },
      defaultResult: null,
      beforeDismiss: () =>
        new Promise<boolean>((resolve) => {
          approve = resolve
        })
    })
    .open()
  const pending = modal.dismiss()
  const snapshot = manager.getSnapshot()
  modal.update({ title: "Guard", data: { count: 0 } })
  expect(manager.getSnapshot()).toBe(snapshot)
  approve(true)
  expect(await pending).toBe(true)
  manager.dispose()
})
