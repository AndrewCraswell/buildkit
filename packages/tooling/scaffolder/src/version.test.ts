import { readFileSync } from "node:fs"
import { describe, expect, it } from "vite-plus/test"
import { engineVersion } from "./version.js"

describe("engineVersion", () => {
  it("equals the package version, which Beachball's postbump hook keeps in step", () => {
    const manifest: unknown = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"))
    expect(manifest).toMatchObject({ version: engineVersion })
  })
})
