import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { createServer } from "node:http"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test"
import { configSchema } from "../config/schema.js"
import { runProcess } from "./process.js"
import { ensureProxy, hasCompatibleProxy, proxyCommand, proxyEnvironment } from "./proxy.js"

vi.mock("./process.js", () => ({ runProcess: vi.fn<typeof runProcess>() }))
let state: string
beforeEach(async () => {
  state = await mkdtemp(path.join(os.tmpdir(), "buildkit-proxy-"))
  vi.stubEnv("PORTLESS_STATE_DIR", state)
})
afterEach(async () => {
  vi.resetAllMocks()
  vi.unstubAllEnvs()
  await rm(state, { recursive: true, force: true })
})
const config = configSchema.parse({ project: "demo", endpoints: { app: { command: ["node"] } } })
const project = { config, root: process.cwd(), worktree: null, file: undefined }
it("passes the Portless CA to HTTPS children without replacing an explicit trust bundle", async () => {
  vi.stubEnv("NODE_EXTRA_CA_CERTS", "")
  const caPath = path.join(state, "ca.pem")
  expect(proxyEnvironment(project).NODE_EXTRA_CA_CERTS).toBeUndefined()
  await writeFile(caPath, "fixture")
  expect(proxyEnvironment(project).NODE_EXTRA_CA_CERTS).toBe(caPath)
  const http = { ...project, config: configSchema.parse({ ...config, proxy: { https: false } }) }
  expect(proxyEnvironment(http).NODE_EXTRA_CA_CERTS).toBeUndefined()
  vi.stubEnv("NODE_EXTRA_CA_CERTS", "/custom/trust.pem")
  expect(proxyEnvironment(project).NODE_EXTRA_CA_CERTS).toBe("/custom/trust.pem")
})
it("delegates setup, status, and doctor without force or stopping the proxy", async () => {
  vi.stubEnv("npm_command", "exec")
  vi.stubEnv("PNPM_SCRIPT_SRC_DIR", "/consumer")
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
  const env = vi.mocked(runProcess).mock.calls[0]![1].env
  expect(env?.npm_command).toBeUndefined()
  expect(env?.PNPM_SCRIPT_SRC_DIR).toBeUndefined()
})
it("reuses a live proxy regardless of suffix, but rejects mismatched port, TLS, and identity", async () => {
  let isPortless = true
  const server = createServer((_req, res) => {
    if (isPortless) {
      res.setHeader("X-Portless", "1")
    }
    res.end()
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  try {
    const address = server.address()
    if (!address || typeof address === "string") {
      throw new Error("No port")
    }
    await Promise.all([
      writeFile(path.join(state, "proxy.pid"), String(process.pid)),
      writeFile(path.join(state, "proxy.port"), String(address.port)),
      writeFile(path.join(state, "proxy.tlds"), "another-project.test")
    ])
    const local = { ...project, config: configSchema.parse({ ...config, proxy: { https: false, port: address.port } }) }
    expect(await hasCompatibleProxy(local)).toBe(true)
    expect((await proxyCommand(local, "setup")).code).toBe(0)
    await ensureProxy(local)
    expect(runProcess).not.toHaveBeenCalled()
    await expect(hasCompatibleProxy(project)).rejects.toThrow("different port or TLS")
    await writeFile(path.join(state, "proxy.tls"), "1")
    await expect(hasCompatibleProxy(local)).rejects.toThrow("different port or TLS")
    await rm(path.join(state, "proxy.tls"))
    isPortless = false
    await expect(hasCompatibleProxy(local)).rejects.toThrow("not responding as Portless")
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})
it("reports unsuccessful startup and missing proxy metadata", async () => {
  expect(await hasCompatibleProxy(project)).toBe(false)
  vi.mocked(runProcess).mockResolvedValue({ code: 1, stderr: "failed" })
  await expect(ensureProxy(project)).rejects.toThrow("Could not start")
  vi.mocked(runProcess).mockResolvedValue({ code: 0, stderr: "" })
  await expect(ensureProxy(project)).rejects.toThrow("Could not start")
})
