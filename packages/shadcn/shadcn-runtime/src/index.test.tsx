import { useDirection } from "@base-ui/react/direction-provider"
import { cleanup, render, screen } from "@testing-library/react"
import { createCn } from "cn/config"
import { createPortal } from "react-dom"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, expect, expectTypeOf, it } from "vitest"
import type { ShadcnStrings, ShadcnLocalization, ShadcnLocalizationProviderProps } from "./index.js"
import { ShadcnLocalizationProvider, useShadcnLocalization, cn, setCn, defaultShadcnStrings } from "./index.js"

afterEach(() => {
  cleanup()
  setCn()
})

it("exposes complete strongly typed strings and formatter arguments", () => {
  expectTypeOf<ReturnType<typeof useShadcnLocalization>>().toEqualTypeOf<ShadcnLocalization>()
  expectTypeOf<ShadcnLocalization["strings"]>().toEqualTypeOf<Readonly<ShadcnStrings>>()
  expectTypeOf<ShadcnStrings["close"]>().toEqualTypeOf<string>()
  expectTypeOf<ShadcnStrings["removeItem"]>().parameters.toEqualTypeOf<[string]>()
  expectTypeOf<ShadcnStrings["removeItem"]>().returns.toEqualTypeOf<string>()
  expectTypeOf<ShadcnStrings>().not.toHaveProperty("unknownKey")
  expectTypeOf<ShadcnLocalizationProviderProps["strings"]>().toEqualTypeOf<Partial<ShadcnStrings> | undefined>()
})

it("inherits direction, updates Base UI behavior, and permits nested overrides", () => {
  function Direction() {
    const { direction } = useShadcnLocalization()
    const primitiveDirection = useDirection()
    return <span>{`${direction}/${primitiveDirection}`}</span>
  }
  const view = render(
    <ShadcnLocalizationProvider direction="rtl">
      <ShadcnLocalizationProvider>
        <Direction />
      </ShadcnLocalizationProvider>
    </ShadcnLocalizationProvider>
  )
  expect(screen.getByText("rtl/rtl")).toBeTruthy()
  view.rerender(
    <ShadcnLocalizationProvider direction="rtl">
      <ShadcnLocalizationProvider direction="ltr">
        <Direction />
      </ShadcnLocalizationProvider>
    </ShadcnLocalizationProvider>
  )
  expect(screen.getByText("ltr/ltr")).toBeTruthy()
})

function Labels() {
  const { strings: labels } = useShadcnLocalization()
  return (
    <span>
      {labels.close}|{labels.clear}|{labels.removeItem("Tea")}
    </span>
  )
}

it("provides English without setup and isolates server renders", () => {
  expect(renderToStaticMarkup(<Labels />)).toContain("Close|Clear|Remove Tea")
  expect(
    renderToStaticMarkup(
      <ShadcnLocalizationProvider strings={{ close: "Fermer" }}>
        <Labels />
      </ShadcnLocalizationProvider>
    )
  ).toContain("Fermer|Clear")
  expect(renderToStaticMarkup(<Labels />)).toContain("Close|Clear")
  expect(defaultShadcnStrings.removeItem("Tea")).toBe("Remove Tea")
})

it("inherits nested labels, updates portals, and keeps sibling providers isolated", () => {
  function Example({ close }: { close: string }) {
    return (
      <>
        <ShadcnLocalizationProvider strings={{ close, removeItem: (label) => `Retirer ${label}` }}>
          <ShadcnLocalizationProvider strings={{ clear: "Effacer", close: undefined }}>
            {createPortal(<Labels />, document.body)}
          </ShadcnLocalizationProvider>
        </ShadcnLocalizationProvider>
        <ShadcnLocalizationProvider>
          <Labels />
        </ShadcnLocalizationProvider>
      </>
    )
  }
  const view = render(<Example close="Fermer" />)
  expect(screen.getByText("Fermer|Effacer|Retirer Tea")).toBeTruthy()
  expect(screen.getByText("Close|Clear|Remove Tea")).toBeTruthy()
  view.rerender(<Example close="Schließen" />)
  expect(screen.getByText("Schließen|Effacer|Retirer Tea")).toBeTruthy()
})

it("extends the merger used by previously imported functions and can restore defaults", () => {
  expect(() => setCn(cn)).toThrow(TypeError)
  const captured = cn
  setCn(createCn({ extend: { classGroups: { "font-size": [{ text: ["meta"] }] } } }))
  expect(captured("text-sm text-red-500", "text-meta")).toBe("text-red-500 text-meta")
  expect(cn("text-meta", "text-lg")).toBe("text-lg")
  setCn()
  expect(cn("p-2", false, ["p-4"], { hidden: true })).toBe("p-4 hidden")
})
