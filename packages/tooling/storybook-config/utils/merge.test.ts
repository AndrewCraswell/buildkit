import { describe, expect, it } from "vite-plus/test"
import { deepMerge } from "./merge.js"

describe("shared Storybook configuration", () => {
  it("combines addons and nested settings without mutating the base", () => {
    const base = { addons: ["a11y"], options: { enabled: true, nested: { a: 1 } } }
    expect(deepMerge(base, { addons: ["tests"], options: { nested: { b: 2 } } })).toEqual({
      addons: ["a11y", "tests"],
      options: { enabled: true, nested: { a: 1, b: 2 } }
    })
    expect(base).toEqual({ addons: ["a11y"], options: { enabled: true, nested: { a: 1 } } })
  })
  it("preserves defaults for undefined and replaces non-plain values", () => {
    const base = { enabled: true }
    expect(deepMerge(base, undefined)).toBe(base)
    expect(deepMerge(base, null)).toBeNull()
    const pattern = /stories/
    expect(deepMerge(base, pattern)).toBe(pattern)
    expect(deepMerge([1], [2])).toEqual([1, 2])
    expect(deepMerge(true, false)).toBe(false)
  })
})
