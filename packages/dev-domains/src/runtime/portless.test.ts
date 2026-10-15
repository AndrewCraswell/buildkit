import { mkdtemp, rm } from "node:fs/promises"
import { createServer } from "node:net"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { configSchema } from "../config/schema.js"
import { resolveEndpoints } from "../domains/resolve.js"
import { runEndpoint } from "./portless.js"
import { runProcess } from "./process.js"
import { ensureProxy } from "./proxy.js"
import { routeStore } from "./state.js"

vi.mock("./process.js", () => ({ runProcess: vi.fn<typeof runProcess>() }))
vi.mock("./proxy.js", async (original) => ({
  ...(await original<typeof import("./proxy.js")>()),
  ensureProxy: vi.fn<typeof ensureProxy>()
}))
let state: string
beforeEach(async () => {
  state = await mkdtemp(path.join(os.tmpdir(), "buildkit-routes-"))
  vi.stubEnv("PORTLESS_STATE_DIR", state)
})
afterEach(async () => {
  vi.resetAllMocks()
  vi.unstubAllEnvs()
  await rm(state, { recursive: true, force: true })
})
const config = configSchema.parse({ project: "demo", endpoints: { app: { command: ["node"] } } })
const project = { config, root: process.cwd(), worktree: null, file: undefined }
const endpoint = resolveEndpoints(project)[0]!

it("retries only explicit bind failures and stops at the bounded limit", async () => {
  vi.mocked(runProcess)
    .mockResolvedValueOnce({ code: 1, stderr: "EADDRINUSE" })
    .mockResolvedValueOnce({ code: 0, stderr: "" })
  expect(await runEndpoint(project, endpoint)).toBe(0)
  expect(runProcess).toHaveBeenCalledTimes(2)
  vi.mocked(runProcess).mockReset().mockResolvedValue({ code: 1, stderr: "address already in use" })
  expect(await runEndpoint(project, endpoint)).toBe(1)
  expect(runProcess).toHaveBeenCalledTimes(3)
  vi.mocked(runProcess).mockReset().mockResolvedValue({ code: 8, stderr: "application failed" })
  expect(await runEndpoint(project, endpoint)).toBe(8)
  expect(runProcess).toHaveBeenCalledTimes(1)
  expect(routeStore().loadRoutesRaw()).toEqual([])
})
it("registers before launch, releases the socket, and cleans only its exact route", async () => {
  routeStore().addRoute("other.localhost", 4011, process.pid)
  vi.mocked(runProcess).mockImplementation(async (_command, options) => {
    const route = routeStore()
      .loadRoutes()
      .find((item) => item.hostname === endpoint.hostname)!
    expect(options.env).toMatchObject({ PORT: String(route.port), PORTLESS_URL: endpoint.origin })
    const server = createServer()
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject)
      server.listen(route.port, "127.0.0.1", resolve)
    })
    await new Promise<void>((resolve) => server.close(() => resolve()))
    return { code: 0, stderr: "" }
  })
  await runEndpoint(project, endpoint)
  expect(
    routeStore()
      .loadRoutesRaw()
      .map((route) => route.hostname)
  ).toEqual(["other.localhost"])
  vi.stubEnv("BUILDKIT_ACTIVE", "1")
  await expect(runEndpoint(project, endpoint)).rejects.toThrow("Recursive")
})
it("rolls back partial aliases and never replaces an occupied name", async () => {
  const aliased = {
    ...project,
    config: configSchema.parse({ ...config, proxy: { domains: ["localhost", "example.test"] } })
  }
  routeStore().addRoute(`${endpoint.name}.example.test`, 4050, process.pid)
  await expect(runEndpoint(aliased, endpoint)).rejects.toThrow("already in use")
  expect(runProcess).not.toHaveBeenCalled()
  expect(routeStore().loadRoutesRaw()).toEqual([
    { hostname: `${endpoint.name}.example.test`, port: 4050, pid: process.pid }
  ])
})
it("cleans routes when spawning fails and does not start after cancellation or proxy failure", async () => {
  vi.mocked(runProcess).mockRejectedValue(new Error("spawn failed"))
  await expect(runEndpoint(project, endpoint)).rejects.toThrow("spawn failed")
  expect(routeStore().loadRoutesRaw()).toEqual([])
  vi.mocked(runProcess).mockClear()
  await expect(runEndpoint(project, endpoint, AbortSignal.abort())).rejects.toThrow("aborted")
  vi.mocked(ensureProxy).mockRejectedValue(new Error("proxy failed"))
  await expect(runEndpoint(project, endpoint)).rejects.toThrow("proxy failed")
  expect(runProcess).not.toHaveBeenCalled()
})
it("preserves explicit aliases without inheriting another project's domains", async () => {
  const aliased = {
    ...project,
    config: configSchema.parse({ ...config, proxy: { domains: ["localhost", "example.test"] } })
  }
  vi.mocked(runProcess).mockImplementation(async () => {
    expect(
      routeStore()
        .loadRoutes()
        .map((route) => route.hostname)
    ).toEqual([endpoint.hostname, `${endpoint.name}.example.test`])
    return { code: 0, stderr: "" }
  })
  await runEndpoint(aliased, endpoint)
  expect(routeStore().loadRoutesRaw()).toEqual([])
})
