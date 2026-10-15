import { mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { expect, it } from "vitest"
import { playwrightServer } from "./playwright.js"

it("uses a dedicated endpoint without reusing other sessions", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "buildkit-playwright-"))
  try {
    await writeFile(
      path.join(root, "dev-domains.json"),
      JSON.stringify({ project: "demo", endpoints: { tests: { kind: "e2e", command: ["node"] } } })
    )
    expect(await playwrightServer("tests", root)).toMatchObject({
      use: { baseURL: "https://demo-tests.localhost" },
      webServer: { command: "dev-domains run tests", cwd: root, reuseExistingServer: false }
    })
    await expect(playwrightServer("missing", root)).rejects.toThrow("kind: e2e")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
