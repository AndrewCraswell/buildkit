import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { expect, it } from "vite-plus/test"
import { configSchema } from "../config/schema.js"
import { endpointDirectory, interpolate, resolveEndpoints } from "./resolve.js"

it("resolves distinct primary and worktree names, callbacks, and environment templates", () => {
  const config = configSchema.parse({
    project: "demo",
    domain: "example.com",
    endpoints: {
      app: { command: ["node"], primaryName: "local", name: "{worktree}.local", auth: ["/callback"] },
      stories: { command: ["node"], primaryName: "stories.local", name: "{worktree}.stories.local" },
      tests: {
        kind: "e2e",
        command: ["node"],
        primaryName: "e2e.local",
        name: "{worktree}.e2e.local",
        auth: ["/callback"]
      }
    }
  })
  const endpoints = resolveEndpoints({ config, root: process.cwd(), worktree: null, file: undefined })
  expect(endpoints[0]).toMatchObject({
    origin: "https://local.example.com",
    callbacks: ["https://local.example.com/callback"]
  })
  expect(endpoints[1]?.origin).toBe("https://stories.local.example.com")
  expect(endpoints[2]?.origin).toBe("https://e2e.local.example.com")
  const worktree = resolveEndpoints({ config, root: process.cwd(), worktree: "fix-ui", file: undefined })
  expect(worktree.map((endpoint) => endpoint.origin)).toEqual([
    "https://fix-ui.local.example.com",
    "https://fix-ui.stories.local.example.com",
    "https://fix-ui.e2e.local.example.com"
  ])
  expect(worktree[2]?.callbacks).toEqual(["https://fix-ui.e2e.local.example.com/callback"])
  expect(interpolate("{origin}/callback", { origin: "https://example.test" })).toBe("https://example.test/callback")
  expect(() => interpolate("{missing}", {})).toThrow("Unknown template")
})
it("rejects conflicting or invalid resolved names", () => {
  for (const name of ["shared", "x".repeat(64), "nested..name", "UPPER", "-name"]) {
    const config = configSchema.parse({
      project: "demo",
      endpoints: {
        a: { command: ["node"], primaryName: name, name },
        b: { command: ["node"], primaryName: name, name }
      }
    })
    expect(() => resolveEndpoints({ config, root: ".", worktree: null, file: undefined })).toThrow(Error)
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
    const project = { config, root, worktree: null, file: undefined }
    const endpoint = resolveEndpoints(project)[0]!
    expect(endpoint.origin).toBe("http://demo-app.localhost:8080")
    await expect(endpointDirectory(project, endpoint)).rejects.toThrow("outside")
    endpoint.cwd = root
    expect(await endpointDirectory(project, endpoint)).toBe(root)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
