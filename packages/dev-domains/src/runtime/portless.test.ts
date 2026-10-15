import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { afterEach, expect, it, vi } from "vitest"
import { configSchema } from "../config/schema.js"
import { resolveEndpoints } from "../domains/resolve.js"
import { proxyCommand, routeStore, runEndpoint } from "./portless.js"
import { runProcess } from "./process.js"

vi.mock("./process.js", () => ({ runProcess: vi.fn<typeof runProcess>() }))
afterEach(() => {
  vi.resetAllMocks()
  vi.unstubAllEnvs()
})
const config = configSchema.parse({ project: "demo", endpoints: { app: { command: ["node"] } } })
const project = { config, root: process.cwd(), worktree: "main", file: undefined }

it("retries only explicit bind failures and stops at the bounded limit", async () => {
  const state = await mkdtemp(path.join(os.tmpdir(), "buildkit-routes-"))
  vi.stubEnv("PORTLESS_STATE_DIR", state)
  try {
    vi.mocked(runProcess)
      .mockResolvedValueOnce({ code: 1, stderr: "EADDRINUSE" })
      .mockResolvedValueOnce({ code: 0, stderr: "" })
    expect(await runEndpoint(project, resolveEndpoints(project)[0]!)).toBe(0)
    expect(runProcess).toHaveBeenCalledTimes(2)
    vi.mocked(runProcess).mockReset().mockResolvedValue({ code: 1, stderr: "address already in use" })
    expect(await runEndpoint(project, resolveEndpoints(project)[0]!)).toBe(1)
    expect(runProcess).toHaveBeenCalledTimes(3)
    vi.mocked(runProcess).mockReset().mockResolvedValue({ code: 8, stderr: "application failed" })
    expect(await runEndpoint(project, resolveEndpoints(project)[0]!)).toBe(8)
    expect(runProcess).toHaveBeenCalledTimes(1)
  } finally {
    await rm(state, { recursive: true, force: true })
  }
})
it("removes only routes owned by the child and rejects recursion", async () => {
  const state = await mkdtemp(path.join(os.tmpdir(), "buildkit-owner-"))
  vi.stubEnv("PORTLESS_STATE_DIR", state)
  try {
    vi.mocked(runProcess).mockImplementation(async (_command, options) => {
      options.onSpawn?.(process.pid)
      routeStore().addRoute("owned.localhost", 4010, process.pid)
      routeStore().addRoute("unowned.localhost", 4011, 0)
      return { code: 0, stderr: "", pid: process.pid }
    })
    await runEndpoint(project, resolveEndpoints(project)[0]!)
    expect(
      routeStore()
        .loadRoutesRaw()
        .map((route) => route.hostname)
    ).toEqual(["unowned.localhost"])
    vi.stubEnv("BUILDKIT_ACTIVE", "1")
    await expect(runEndpoint(project, resolveEndpoints(project)[0]!)).rejects.toThrow("Recursive")
  } finally {
    await rm(state, { recursive: true, force: true })
  }
})
it("delegates setup, status, and doctor without force or stopping the proxy", async () => {
  vi.mocked(runProcess).mockResolvedValue({ code: 0, stderr: "" })
  for (const action of ["setup", "status", "doctor"] as const) {
    await proxyCommand(project, action)
  }
  const all = vi
    .mocked(runProcess)
    .mock.calls.map(([command]) => command.join(" "))
    .join("\n")
  expect(all).toContain("proxy start")
  expect(all).toContain("list")
  expect(all).toContain("doctor")
  expect(all).not.toContain("--force")
  expect(all).not.toContain("stop")
})
