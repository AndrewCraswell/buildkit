import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { expect, it } from "vitest"
import { configSchema } from "../config/schema.js"
import { endpointDirectory, interpolate, resolveEndpoints } from "./resolve.js"

it("resolves flat custom domains, callbacks, and environment templates", () => {
  const config = configSchema.parse({
    project: "demo",
    domain: "local.example.com",
    endpoints: { app: { command: ["node"], name: "{worktree}", auth: ["/callback"] }, stories: { command: ["node"] } }
  })
  const endpoints = resolveEndpoints({ config, root: process.cwd(), worktree: "main", file: undefined })
  expect(endpoints[0]).toMatchObject({
    origin: "https://main.local.example.com",
    callbacks: ["https://main.local.example.com/callback"]
  })
  expect(endpoints[1]?.origin).toBe("https://demo-main-stories.local.example.com")
  expect(interpolate("{origin}/callback", { origin: "https://example.test" })).toBe("https://example.test/callback")
  expect(() => interpolate("{missing}", {})).toThrow("Unknown template")
})
it("rejects conflicting or invalid resolved names", () => {
  for (const name of ["shared", "x".repeat(64), "nested.name"]) {
    const config = configSchema.parse({
      project: "demo",
      endpoints: { a: { command: ["node"], name }, b: { command: ["node"], name } }
    })
    expect(() => resolveEndpoints({ config, root: ".", worktree: "main", file: undefined })).toThrow(Error)
  }
})
it("uses custom ports and refuses directories outside the project", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "buildkit-path-"))
  try {
    const config = configSchema.parse({
      project: "demo",
      proxy: { https: false, port: 8080 },
      endpoints: { app: { command: ["node"], cwd: ".." } }
    })
    const project = { config, root, worktree: "main", file: undefined }
    const endpoint = resolveEndpoints(project)[0]!
    expect(endpoint.origin).toBe("http://demo-main-app.localhost:8080")
    await expect(endpointDirectory(project, endpoint)).rejects.toThrow("outside")
    endpoint.cwd = root
    expect(await endpointDirectory(project, endpoint)).toBe(root)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
