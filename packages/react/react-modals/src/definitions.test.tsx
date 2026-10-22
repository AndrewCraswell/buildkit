import { act, cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { afterEach, expect, expectTypeOf, it, vi } from "vitest"
import { createModalManager, ModalRenderer } from "./index.js"
import type { ModalSlotProps, ModalSurfaceProps } from "./index.js"

afterEach(cleanup)

function Surface({ body }: ModalSurfaceProps<object>) {
  return <section>{body}</section>
}

it("infers state, merges opening overrides, and preserves component hooks across updates", async () => {
  const user = userEvent.setup()
  const manager = createModalManager({ adapter: { Surface } })
  const definition = manager.createModal({
    title: "Profile",
    initialState: { name: "Ada", count: 0 },
    defaultResult: null,
    body: {
      component: function Profile({ data, controls }) {
        const [local, setLocal] = useState(0)
        expectTypeOf(data.name).toEqualTypeOf<string>()
        expectTypeOf(data.count).toEqualTypeOf<number>()
        return (
          <>
            <p>
              {data.name}: {data.count}
            </p>
            <button onClick={() => setLocal(local + 1)}>Local {local}</button>
            <button onClick={() => controls.close(data)}>Save</button>
          </>
        )
      }
    }
  })
  const handle = definition.open({ name: "Grace" })
  expectTypeOf(handle).resolves.toEqualTypeOf<{ name: string; count: number } | null>()
  render(<ModalRenderer manager={manager} />)
  await user.click(screen.getByRole("button", { name: "Local 0" }))
  act(() => {
    handle.update({ title: "Updated profile" })
    handle.update((current) => ({ data: { count: current.data.count + 1 } }))
    handle.update((current) => ({ data: { count: current.data.count + 1 } }))
  })
  expect(screen.getByText("Grace: 2")).toBeDefined()
  expect(manager.getSnapshot()[0].content.renderSlots(manager.getSnapshot()[0]).title).toBe("Updated profile")
  expect(screen.getByRole("button", { name: "Local 1" })).toBeDefined()
  await user.click(screen.getByRole("button", { name: "Save" }))
  expect(await handle).toEqual({ name: "Grace", count: 2 })
  act(() => manager.clear())
  let reopened: ReturnType<typeof definition.open> | undefined
  act(() => {
    reopened = definition.open()
  })
  expect(screen.getByText("Ada: 0")).toBeDefined()
  act(() => manager.clear())
  expect(await reopened).toBeNull()
})

it("creates independent nested defaults using an initial-state factory", async () => {
  const manager = createModalManager()
  const values: number[][] = []
  const definition = manager.createModal({
    title: "Selection",
    initialState: () => ({ ids: [1] }),
    defaultResult: null,
    body: { component: () => null },
    beforeDismiss(data) {
      values.push(data.ids)
      return true
    }
  })
  const first = definition.open()
  await first.dismiss()
  const second = definition.open()
  await second.dismiss()
  expect(values[0]).toEqual([1])
  expect(values[1]).toEqual([1])
  expect(values[0]).not.toBe(values[1])
  manager.dispose()
})

it("updates presentation independently per instance and ignores stale handles", async () => {
  const manager = createModalManager<{ tone: "quiet" | "loud" }>()
  const definition = manager.createModal({
    title: "Profile",
    description: "Original description",
    surfaceProps: { tone: "quiet" },
    initialState: { name: "Ada" },
    defaultResult: null,
    body: { component: () => null }
  })
  const first = definition.open(undefined, { id: "profile" })
  const second = definition.open()
  first.update({ title: "Edited profile", dismissible: false, surfaceProps: { tone: "loud" } })
  first.update((current) => {
    expect(Object.isFrozen(current)).toBe(true)
    expect(current.title).toBe("Edited profile")
    return { title: `${current.title}!`, description: undefined }
  })
  first.update({ data: { name: "Grace" } })
  expect({
    ...manager.getSnapshot()[0].content,
    ...manager.getSnapshot()[0].content.renderSlots(manager.getSnapshot()[0])
  }).toMatchObject({
    title: "Edited profile!",
    description: undefined,
    dismissible: false,
    surfaceProps: { tone: "loud" }
  })
  expect({
    ...manager.getSnapshot()[1].content,
    ...manager.getSnapshot()[1].content.renderSlots(manager.getSnapshot()[1])
  }).toMatchObject({ title: "Profile", surfaceProps: { tone: "quiet" } })
  first.close({ name: "Grace" })
  expect(await first).toEqual({ name: "Grace" })
  expect(await second).toBeNull()
  const ignored = vi.fn<() => { title: string }>(() => ({ title: "Too late" }))
  first.update(ignored)
  expect(ignored).not.toHaveBeenCalled()
  manager.clear()
  const reopened = definition.open(undefined, { id: "profile" })
  first.update({ title: "Stale" })
  expect({
    ...manager.getSnapshot()[0].content,
    ...manager.getSnapshot()[0].content.renderSlots(manager.getSnapshot()[0])
  }).toMatchObject({ title: "Profile", description: "Original description" })
  await reopened.submit((data) => ({ ...data }))
  expect(await reopened).toEqual({ name: "Ada" })
  manager.dispose()
})

it("invalidates a pending dismissal approval after presentation changes", async () => {
  let approve: (allowed: boolean) => void = () => undefined
  const manager = createModalManager()
  const handle = manager
    .createModal({
      title: "Review",
      initialState: {},
      defaultResult: null,
      body: { component: () => null },
      beforeDismiss: () =>
        new Promise<boolean>((resolve) => {
          approve = resolve
        })
    })
    .open()
  const dismissal = handle.dismiss()
  handle.update({ dismissible: false })
  approve(true)
  expect(await dismissal).toBe(false)
  expect(handle.isActive()).toBe(true)
  manager.dispose()
})

it("renders pending and failure state and returns a separately typed saved result", async () => {
  const user = userEvent.setup()
  const manager = createModalManager({ adapter: { Surface } })
  let failSave: (error: Error) => void = () => undefined
  let attempt = 0
  function Editor({ data, controls, isPending, error }: ModalSlotProps<{ name: string }, number | null>) {
    return (
      <>
        <span>{isPending ? "Saving" : "Ready"}</span>
        {error instanceof Error && <p role="alert">{error.message}</p>}
        <button
          disabled={isPending}
          onClick={() =>
            controls.submit((current) => {
              expect(current.name).toBe(data.name)
              attempt += 1
              return attempt === 1
                ? new Promise<number>((_, reject) => {
                    failSave = reject
                  })
                : 42
            })
          }
        >
          Save
        </button>
      </>
    )
  }
  const definition = manager.createModal({
    body: { component: Editor },
    initialState: { name: "Ada" },
    title: "Editor",
    defaultResult: null
  })
  const handle = definition.open()
  expectTypeOf(handle).resolves.toEqualTypeOf<number | null>()
  render(<ModalRenderer manager={manager} />)
  await user.click(screen.getByRole("button", { name: "Save" }))
  expect(screen.getByText("Saving")).toBeDefined()
  await act(async () => {
    failSave(new Error("Try again"))
  })
  expect(screen.getByRole("alert").textContent).toBe("Try again")
  expect(handle.isActive()).toBe(true)
  await user.click(screen.getByRole("button", { name: "Save" }))
  expect(await handle).toBe(42)
})

// Compiled alongside runtime tests. These calls are intentionally never executed.
function checkTypes() {
  const manager = createModalManager<{ className?: string }>()
  const definition = manager.createModal({
    title: "Inferred",
    initialState: { name: "Ada", count: 0 },
    defaultResult: null,
    body: {
      component: function Body({ data, controls }) {
        // @ts-expect-error Read-only state must be changed through update.
        data.name = "Grace"
        // @ts-expect-error Unknown state keys are rejected.
        controls.update({ data: { email: "ada@example.com" } })
        // @ts-expect-error Functional updates retain property types.
        controls.update(() => ({ data: { count: "one" } }))
        // @ts-expect-error Default form results have the inferred state shape.
        controls.close(42)
        // @ts-expect-error Submission results retain the result type.
        controls.submit(async () => false)
        controls.close(data)
        controls.close(null)
        controls.update({ title: "Updated", surfaceProps: { className: "wide" } })
        // @ts-expect-error Presentation updates cannot change identity.
        controls.update({ id: "other" })
        // @ts-expect-error Custom state must be nested under data.
        controls.update({ name: "Grace" })
        // @ts-expect-error Surface options keep the manager's type.
        controls.update({ surfaceProps: { unknown: true } })
        // @ts-expect-error Functional updates retain presentation property types.
        controls.update(() => ({ dismissible: "no" }))
        controls.update((current) => {
          expectTypeOf(current.data.count).toEqualTypeOf<number>()
          // @ts-expect-error Functional update data is read-only.
          current.data.count = 1
          // @ts-expect-error Presentation values are read-only.
          current.dismissible = false
          return { title: "Step", data: { count: current.data.count + 1 } }
        })
        // @ts-expect-error There is one update method.
        controls.updateOptions({ title: "Removed" })
        // @ts-expect-error The render field was replaced by body slots.
        controls.update({ render: () => null })
        return null
      }
    }
  })
  // @ts-expect-error Opening overrides retain property types.
  definition.open({ count: "one" })
  // @ts-expect-error Unknown opening keys are rejected.
  definition.open({ email: "ada@example.com" })
  definition.open().update({ title: "Updated" })
  // @ts-expect-error Standard modals do not have custom state.
  manager.open({ title: "Standard" }).update({ data: { name: "Ada" } })
  // @ts-expect-error Standard modal identity is fixed too.
  manager.confirm({ title: "Standard" }).update({ id: "other" })
  manager.createModal<{ mode: "edit" | "view"; selected: number | null }, string | null>({
    title: "Explicit",
    initialState: { mode: "view", selected: null },
    defaultResult: null,
    body: {
      component: function Body({ controls }) {
        controls.update({ data: { mode: "edit", selected: 1 } })
        controls.close("saved")
        return null
      }
    }
  })
  manager.createModal<{ name: string }, number>({
    title: "Invalid default",
    initialState: { name: "" },
    // @ts-expect-error Cancellation must match the declared result type.
    defaultResult: null,
    body: { component: () => null }
  })
}
void checkTypes
