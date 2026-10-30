import { act, cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, expect, it } from "vite-plus/test"
import { createModalManager, ModalRenderer } from "./index.js"
import type { ModalSurfaceProps } from "./index.js"

afterEach(cleanup)

it("preserves symbol-keyed custom data in partial updates", async () => {
  const revision = Symbol("revision")
  const manager = createModalManager()
  const modal = manager
    .createModal({ title: "Draft", initialState: { name: "Draft", [revision]: 0 }, defaultResult: null })
    .open()
  modal.update({ data: { [revision]: 1 } })
  await modal.submit((data) => data)
  expect(await modal).toEqual({ name: "Draft", [revision]: 1 })
  manager.dispose()
})

function Surface({ title, body }: ModalSurfaceProps<object>) {
  return <section aria-label={String(title)}>{body}</section>
}

it("publishes presentation and partial data together, including colliding names", async () => {
  const manager = createModalManager({ adapter: { Surface } })
  const handle = manager
    .createModal({
      title: "Dialog title",
      initialState: { title: "Draft title", name: "Ada", nested: { count: 0 }, step: 0 },
      defaultResult: null,
      body: {
        component: ({ data }) => (
          <p>
            {data.title}: {data.step}
          </p>
        )
      }
    })
    .open()
  const observed: string[] = []
  const unsubscribe = manager.subscribe(() => {
    const entry = manager.getSnapshot()[0]
    observed.push(String(entry.content.renderSlots(entry).title))
  })
  render(<ModalRenderer manager={manager} />)
  act(() =>
    handle.update((current) => {
      expect(current.title).toBe("Dialog title")
      expect(current.data.title).toBe("Draft title")
      expect(Object.isFrozen(current)).toBe(true)
      expect(Object.isFrozen(current.data)).toBe(true)
      return { title: "Review", data: { title: "Final title", step: current.data.step + 1 } }
    })
  )
  expect(observed).toEqual(["Review"])
  unsubscribe()
  expect(screen.getByRole("region", { name: "Review" }).textContent).toBe("Final title: 1")
  act(() => handle.update({ description: "Ready", data: undefined }))
  act(() => handle.update({ data: { nested: { count: 2 } } }))
  await act(async () => {
    await handle.submit((data) => data)
  })
  expect(await handle).toEqual({ title: "Final title", name: "Ada", nested: { count: 2 }, step: 1 })
})

it("changes multistep content, button labels and actions without losing form values", async () => {
  const user = userEvent.setup()
  const manager = createModalManager({ adapter: { Surface } })
  const handle = manager
    .createModal({
      title: "Name",
      initialState: { step: 0, name: "Ada" },
      defaultResult: null,
      body: {
        component: function Steps({ data, controls }) {
          return (
            <>
              {data.step === 0 ? (
                <input
                  aria-label="Name"
                  value={data.name}
                  onChange={(event) => controls.update({ data: { name: event.target.value } })}
                />
              ) : (
                <p>Review {data.name}</p>
              )}
              <button
                onClick={() =>
                  data.step === 0
                    ? controls.update(({ data: current }) => ({ title: "Review", data: { step: current.step + 1 } }))
                    : controls.close(data)
                }
              >
                {data.step === 0 ? "Next: Review" : "Save profile"}
              </button>
            </>
          )
        }
      }
    })
    .open()
  render(<ModalRenderer manager={manager} />)
  await user.clear(screen.getByRole("textbox", { name: "Name" }))
  await user.type(screen.getByRole("textbox", { name: "Name" }), "Grace")
  await user.click(screen.getByRole("button", { name: "Next: Review" }))
  expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull()
  expect(screen.getByRole("region", { name: "Review" }).textContent).toContain("Review Grace")
  expect(handle.isActive()).toBe(true)
  await user.click(screen.getByRole("button", { name: "Save profile" }))
  expect(await handle).toEqual({ step: 1, name: "Grace" })
})

it("does not commit an update that throws or closes the modal", () => {
  const manager = createModalManager()
  const handle = manager
    .createModal({
      title: "Original",
      initialState: { count: 0 },
      defaultResult: null,
      body: { component: () => null }
    })
    .open()
  const snapshot = manager.getSnapshot()
  expect(() =>
    handle.update(() => {
      throw new Error("Failed update")
    })
  ).toThrow("Failed update")
  expect(manager.getSnapshot()).toBe(snapshot)
  handle.update(() => {
    handle.close(null)
    return { title: "Ignored", data: { count: 1 } }
  })
  expect(manager.getSnapshot()[0].content.renderSlots(manager.getSnapshot()[0]).title).toBe("Original")
  manager.dispose()
})
