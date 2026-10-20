import { mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { expect, it } from "vitest"
import { getEndpoint } from "./node.js"

it("resolves configured addresses for tooling without starting a server", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "buildkit-node-"))
  try {
    await writeFile(
      path.join(root, "dev-domains.json"),
      JSON.stringify({
        project: "shop",
        domain: "example.com",
        endpoints: { app: { primaryName: "local", command: ["must-not-start"], auth: ["/callback"] } }
      })
    )
    expect(await getEndpoint("app", root)).toEqual({
      service: "app",
      hostname: "local.example.com",
      origin: "https://local.example.com",
      callbacks: ["https://local.example.com/callback"],
      cwd: root
    })
    await expect(getEndpoint("missing", root)).rejects.toThrow("Unknown endpoint: missing")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
