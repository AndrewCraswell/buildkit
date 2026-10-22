import assert from "node:assert/strict"
import { test } from "node:test"
import { resolveTokens } from "./tokens.mjs"

test("resolves chained references and dimensions while retaining the upstream expression", () => {
  const tokens = resolveTokens({
    "--radius": "0.625rem",
    "--radius-sm": "calc(var(--radius) * 0.6)",
    "--control-radius": "var(--radius-sm)"
  })
  assert.deepEqual(tokens["radius-sm"], { resolvedValue: "6px", sourceValue: "calc(var(--radius) * 0.6)" })
  assert.equal(tokens["control-radius"].resolvedValue, "6px")
  assert.equal(resolveTokens({ "--radius": "1rem" }, { rootFontSize: 20 }).radius.resolvedValue, "20px")
})
test("exports concrete sRGB colors and preserves alpha", () => {
  const tokens = resolveTokens({
    "--primary": "oklch(0.205 0 0)",
    "--color-primary": "var(--primary)",
    "--border": "oklch(1 0 0 / 10%)"
  })
  assert.equal(tokens.primary.resolvedValue, "#171717")
  assert.equal(tokens["color-primary"].resolvedValue, "#171717")
  assert.equal(tokens.border.resolvedValue, "rgba(255, 255, 255, 0.1)")
})
test("rejects missing references, cycles, and context-dependent values", () => {
  assert.throws(() => resolveTokens({ "--a": "var(--missing)" }), /Missing/)
  assert.throws(() => resolveTokens({ "--a": "var(--b)", "--b": "var(--a)" }), /Cyclic/)
  assert.throws(() => resolveTokens({ "--a": "currentColor" }), /context-dependent/)
  assert.throws(() => resolveTokens({ "--a": "1rem" }, { rootFontSize: 0 }), /positive/)
  assert.equal(resolveTokens({ "--a": "var(--missing, #fff)" }).a.resolvedValue, "#ffffff")
})
