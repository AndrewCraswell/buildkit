import { describe, expect, it } from "vitest"
import { appendToArray, ensureImport } from "./code.js"

describe("ensureImport", () => {
  it("adds a new import after the last one, or at the top", () => {
    expect(ensureImport("a.ts", 'import x from "x"\n\nconst a = 1\n', { module: "y", named: ["b"] })).toBe(
      'import x from "x"\nimport { b } from "y"\n\nconst a = 1\n'
    )
    expect(ensureImport("a.ts", "const a = 1\n", { module: "y", defaultName: "y" })).toBe(
      'import y from "y"\nconst a = 1\n'
    )
    expect(ensureImport("a.ts", "", { module: "side-effect" })).toBe('import "side-effect"\n')
  })

  it("adds missing names to an existing import, and leaves a complete one alone", () => {
    expect(ensureImport("a.ts", 'import { a } from "m"\n', { module: "m", named: ["a", "b"] })).toBe(
      'import { a, b } from "m"\n'
    )
    expect(ensureImport("a.ts", 'import d from "m"\n', { module: "m", named: ["b"] })).toBe(
      'import d, { b } from "m"\n'
    )
    expect(ensureImport("a.ts", 'import { a } from "m"\n', { module: "m", named: ["a"] })).toBe(
      'import { a } from "m"\n'
    )
    expect(ensureImport("a.ts", 'import "m"\n', { module: "m", named: ["a"] })).toBe('import { a } from "m"\n')
    expect(ensureImport("a.ts", 'import { a } from "m"\n', { module: "m", defaultName: "d" })).toBe(
      'import d, { a } from "m"\n'
    )
    expect(ensureImport("a.ts", 'import { a as b } from "m"\n', { module: "m", defaultName: "d", named: ["c"] })).toBe(
      'import d, { a as b, c } from "m"\n'
    )
    expect(ensureImport("a.ts", 'import "m"\n', { module: "m", defaultName: "d" })).toBe('import d from "m"\n')
    expect(ensureImport("a.ts", 'import "m"\n', { module: "m" })).toBe('import "m"\n')
    expect(ensureImport("a.ts", 'import * as ns from "m"\n', { module: "m", defaultName: "d" })).toBe(
      'import d, * as ns from "m"\n'
    )
  })

  it("never adds names to a namespace or type-only import", () => {
    expect(ensureImport("a.ts", 'import * as ns from "m"\n', { module: "m", named: ["b"] })).toBe(
      'import * as ns from "m"\nimport { b } from "m"\n'
    )
    expect(
      ensureImport("a.ts", 'import type { Plugin } from "vite"\n', { module: "vite", named: ["defineConfig"] })
    ).toBe('import type { Plugin } from "vite"\nimport { defineConfig } from "vite"\n')
    expect(ensureImport("a.ts", 'import { type Plugin } from "vite"\n', { module: "vite", named: ["Plugin"] })).toBe(
      'import { Plugin } from "vite"\n'
    )
    expect(
      ensureImport("a.ts", 'import * as ns from "m"\nimport { b } from "m"\n', { module: "m", named: ["b", "c"] })
    ).toBe('import * as ns from "m"\nimport { b, c } from "m"\n')
    expect(ensureImport("a.ts", 'import { a } from "m"\nimport { b } from "m"\n', { module: "m", named: ["b"] })).toBe(
      'import { a } from "m"\nimport { b } from "m"\n'
    )
  })

  it("refuses source that doesn't parse", () => {
    expect(() => ensureImport("a.ts", "import {", { module: "m" })).toThrow("can't be parsed")
  })
})

describe("appendToArray", () => {
  const config = 'import { defineConfig } from "vite"\n\nexport default defineConfig({\n  plugins: [react()],\n})\n'

  it("appends to an array property inside a call, keeping everything else", () => {
    expect(
      appendToArray("vite.config.ts", config, { call: "defineConfig", property: "plugins", element: "lingui()" })
    ).toBe(config.replace("[react()]", "[react(), lingui()]"))
    expect(
      appendToArray("vite.config.ts", config, { call: "defineConfig", property: "plugins", element: "react()" })
    ).toBe(config)
    expect(appendToArray("a.ts", "export default { plugins: [] }\n", { property: "plugins", element: "x()" })).toBe(
      "export default { plugins: [x()] }\n"
    )
  })

  it("returns undefined when there's no such array", () => {
    expect(
      appendToArray("vite.config.ts", config, { call: "other", property: "plugins", element: "x()" })
    ).toBeUndefined()
    expect(
      appendToArray("a.ts", "export default { plugins: 1 }\n", { property: "plugins", element: "x()" })
    ).toBeUndefined()
  })
})
