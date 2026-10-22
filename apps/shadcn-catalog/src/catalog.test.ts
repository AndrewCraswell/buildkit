import * as root from "@buildkitgg/shadcn-baseui-kit"
import { describe, expect, it } from "vitest"
import upstream from "../../../packages/shadcn/shadcn-baseui-nova/upstream.json"

describe("component catalog contract", () => {
  it("exports every public symbol from every catalog module", () => {
    const modules = import.meta.glob<Record<string, unknown>>(
      "../../../packages/shadcn/shadcn-baseui-nova/dist/ui/*.js",
      { eager: true }
    )
    const files = Object.keys(modules)
    expect(files).toHaveLength(upstream.components.length)
    for (const file of files) {
      const component = modules[file]!
      for (const [name, value] of Object.entries(component)) {
        const publicName = file.endsWith("/sonner.js") && name === "Toaster" ? "SonnerToaster" : name
        expect(Reflect.get(root, publicName), `${file}: ${name}`).toBe(value)
      }
    }
  })
})
