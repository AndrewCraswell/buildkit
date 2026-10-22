import {
  createModalManager as createFluentManager,
  ModalRenderer as FluentRenderer
} from "@buildkitgg/fluentui-modals-manager"
import type {
  ModalAdapter as FluentAdapter,
  ModalManager as FluentManager,
  ModalManagerOptions as FluentManagerOptions,
  ModalRendererProps as FluentRendererProps,
  ModalSurfaceOptions as FluentSurfaceOptions
} from "@buildkitgg/fluentui-modals-manager"
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useEffect } from "react"
import { afterEach, expect, expectTypeOf, it } from "vitest"
import { createModalManager, ModalRenderer } from "./index.js"
import type {
  ModalAdapter,
  ModalManager,
  ModalManagerOptions,
  ModalRendererProps,
  ModalSurfaceOptions
} from "./index.js"

afterEach(cleanup)

it("keeps the manager, adapter options and renderer contracts interchangeable with Fluent", () => {
  expectTypeOf(createModalManager).toEqualTypeOf(createFluentManager)
  expectTypeOf<ModalManager>().toEqualTypeOf<FluentManager>()
  expectTypeOf<ModalManagerOptions>().toEqualTypeOf<FluentManagerOptions>()
  expectTypeOf<ModalAdapter>().toEqualTypeOf<FluentAdapter>()
  expectTypeOf<ModalRendererProps>().toEqualTypeOf<FluentRendererProps>()
  expectTypeOf<ModalSurfaceOptions>().toEqualTypeOf<FluentSurfaceOptions>()
  expectTypeOf(ModalRenderer).toEqualTypeOf(FluentRenderer)
})

function testAdapter(name: string): ModalAdapter {
  return {
    Surface: function Surface({ entry, title, body, footer, children }) {
      useEffect(() => {
        if (entry.status === "closing") {
          entry.finishExit()
        }
      }, [entry])
      return (
        <section aria-label={name}>
          <h2>{title}</h2>
          {body}
          {footer}
          {children}
        </section>
      )
    }
  }
}

it.each([
  { name: "shadcn manager with Fluent renderer", createManager: createModalManager, Renderer: FluentRenderer },
  { name: "Fluent manager with shadcn renderer", createManager: createFluentManager, Renderer: ModalRenderer }
])("keeps adapter bindings and labels isolated: $name", async ({ createManager, Renderer }) => {
  const user = userEvent.setup()
  const first = createManager({ adapter: testAdapter("First adapter"), labels: { confirm: "Approve first" } })
  const second = createManager({ adapter: testAdapter("Second adapter"), labels: { confirm: "Approve second" } })
  const firstResult = first.confirm({ title: "First request" })
  const secondResult = second.confirm({ title: "Second request" })
  render(
    <>
      <Renderer manager={first} />
      <Renderer manager={second} />
    </>
  )
  const firstSurface = screen.getByRole("region", { name: "First adapter" })
  const secondSurface = screen.getByRole("region", { name: "Second adapter" })
  expect(within(firstSurface).getByRole("heading", { name: "First request" })).toBeDefined()
  expect(within(secondSurface).getByRole("heading", { name: "Second request" })).toBeDefined()
  await user.click(within(firstSurface).getByRole("button", { name: "Approve first" }))
  expect(await firstResult).toBe(true)
  expect(first.getSnapshot()).toHaveLength(0)
  expect(secondResult.isActive()).toBe(true)
  await user.click(within(secondSurface).getByRole("button", { name: "Approve second" }))
  expect(await secondResult).toBe(true)
  expect(second.getSnapshot()).toHaveLength(0)
})

function checkTypes() {
  const manager = createModalManager({ adapter: testAdapter("Typed") })
  const definition = manager.createModal({
    title: "Profile",
    initialState: { name: "Ada", count: 0 },
    defaultResult: null,
    body: {
      component: function Body({ data, controls }) {
        controls.update({ data: { name: "Grace" } })
        // @ts-expect-error Form updates keep their inferred types through the adapter.
        controls.update({ data: { count: "one" } })
        controls.close(data)
        return null
      }
    }
  })
  expectTypeOf(definition.open()).resolves.toEqualTypeOf<{ name: string; count: number } | null>()
  // @ts-expect-error Native primitive props are not part of the shared manager contract.
  manager.alert({ title: "Notice", surfaceProps: { finalFocus: false } })
  // @ts-expect-error No primitive selector belongs on the renderer.
  const invalid = <ModalRenderer manager={manager} primitive="radix" />
  // @ts-expect-error Adapters must supply a compatible surface.
  createModalManager({ adapter: {} })
  // @ts-expect-error Adapter selection belongs to manager creation, not the renderer.
  const invalidAdapter = <ModalRenderer manager={manager} adapter={testAdapter("Wrong place")} />
  const shadcn = <ModalRenderer manager={createFluentManager()} />
  const fluent = <FluentRenderer manager={manager} />
  return { invalid, invalidAdapter, shadcn, fluent }
}
void checkTypes
