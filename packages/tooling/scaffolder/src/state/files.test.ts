import { describe, expect, it } from "vitest"
import { renderConfig, updateConfig } from "./files.js"
import type { ProjectConfig } from "./schemas.js"
import { defineSettings } from "./settings.js"

const settings = defineSettings({ product: "acme", printWidth: 60 })
const config: ProjectConfig = {
  catalog: "@acme/catalog",
  name: "demo",
  template: "app",
  target: { id: "web", mode: "spa" },
  addons: { "@acme/ci": {} },
  declined: ["slot:auth"]
}
const long = { locales: ["en", "fr", "de"], detection: ["url", "cookie"], source: "en" }

describe("the config file", () => {
  it("puts each add-on on one line when it fits, and across lines when it doesn't", () => {
    const text = renderConfig({ ...config, addons: { "@acme/ci": {}, "@acme/i18n": long } }, settings)
    expect(text).toContain('  "target": { "id": "web", "mode": "spa" },\n')
    expect(text).toContain('    "@acme/ci": {},\n    "@acme/i18n": {\n      "locales": ["en", "fr", "de"],\n')
    expect(text).toContain('  "declined": ["slot:auth"]\n')
  })

  it("keeps a CRLF file's line endings when an add-on's options go across lines", () => {
    const text = renderConfig(config, settings).replaceAll("\n", "\r\n")
    const updated = updateConfig(text, config, { ...config, addons: { "@acme/ci": {}, "@acme/i18n": long } }, settings)
    expect(updated).toContain('"@acme/i18n": {\r\n      "locales"')
    expect(updated.replaceAll("\r\n", "")).not.toContain("\n")
  })
})
