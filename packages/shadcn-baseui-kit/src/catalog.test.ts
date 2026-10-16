import { describe, expect, it } from "vitest"
import upstream from "../upstream.json"
import * as root from "./index.js"

describe("component catalog contract", () => {
  it("exports every public symbol from every catalog module", () => {
    const modules = import.meta.glob<Record<string, unknown>>("./components/ui/*.tsx", { eager: true })
    const files = Object.keys(modules)
    expect(files).toHaveLength(upstream.components.length - 1)
    for (const file of files) {
      const component = modules[file]!
      for (const [name, value] of Object.entries(component)) {
        const publicName = file.endsWith("/Sonner.tsx") && name === "Toaster" ? "SonnerToaster" : name
        expect(Reflect.get(root, publicName), `${file}: ${name}`).toBe(value)
      }
    }
  })
})
