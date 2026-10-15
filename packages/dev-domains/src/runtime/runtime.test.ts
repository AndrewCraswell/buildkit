import { mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { afterEach, expect, it } from "vitest"
import { configSchema } from "../config/schema.js"
import { resolveEndpoints } from "../domains/resolve.js"
import { serverCommand, serverEnvironment } from "./command.js"
import { proxyEnvironment } from "./portless.js"
import { runProcess, withSignals } from "./process.js"

const dirs: string[] = []
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})
it("constructs strict framework commands with argument boundaries intact", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "buildkit-command-"))
  dirs.push(root)
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({ scripts: { dev: "vite", recursive: "dev-domains run app" } })
  )
  for (const framework of ["vite", "next", "storybook"] as const) {
    const config = configSchema.parse({
      project: "demo",
      endpoints: { app: { script: "dev", framework, env: { APP_URL: "{origin}" } } }
    })
    const endpoint = resolveEndpoints({ config, root, worktree: null, file: undefined })[0]!
    const command = await serverCommand(endpoint.endpoint, "npm", root, endpoint.variables, 4555)
    expect(command.slice(0, 4)).toEqual(["npm", "run", "dev", "--"])
    expect(command).toContain("4555")
    expect(serverEnvironment(endpoint, 4555, { Path: "original" })).toMatchObject({
      PORT: "4555",
      APP_URL: endpoint.origin,
      BUILDKIT_ACTIVE: "1"
    })
    await expect(serverCommand({ ...endpoint.endpoint, script: "recursive" }, "npm", root, {}, 4555)).rejects.toThrow(
      "wraps"
    )
    await expect(serverCommand({ ...endpoint.endpoint, script: "missing" }, "npm", root, {}, 4555)).rejects.toThrow(
      "does not exist"
    )
  }
  const endpoint = configSchema.parse({
    project: "demo",
    endpoints: { app: { command: ["node", "a file.js", "--port={port}"] } }
  }).endpoints.app!
  expect(await serverCommand(endpoint, "npm", root, {}, 4555)).toEqual(["node", "a file.js", "--port=4555"])
})
it.each(["npm", "pnpm", "yarn", "bun"] as const)(
  "uses %s script argument rules without shell concatenation",
  async (manager) => {
    const root = await mkdtemp(path.join(os.tmpdir(), "buildkit-command-"))
    dirs.push(root)
    await writeFile(path.join(root, "package.json"), JSON.stringify({ scripts: { "dev app": "vite" } }))
    const endpoint = configSchema.parse({
      project: "demo",
      endpoints: { app: { script: "dev app", framework: "vite" } }
    }).endpoints.app!
    expect(await serverCommand(endpoint, manager, root, {}, 4567)).toEqual([
      manager,
      "run",
      "dev app",
      ...(manager === "npm" ? ["--"] : []),
      "--host",
      "127.0.0.1",
      "--port",
      "4567",
      "--strictPort"
    ])
  }
)
it("isolates proxy options from inherited public-sharing settings", () => {
  const config = configSchema.parse({
    project: "demo",
    domain: "local.example.com",
    proxy: { domains: ["localhost", "local.example.com"], https: false, port: 8080, syncHosts: false },
    endpoints: { app: { command: ["node"] } }
  })
  expect(proxyEnvironment({ config, root: ".", worktree: null, file: undefined })).toMatchObject({
    PORTLESS_TLD: "localhost,local.example.com",
    PORTLESS_HTTPS: "0",
    PORTLESS_NGROK: "0",
    PORTLESS_SYNC_HOSTS: "0"
  })
})
it("preserves exit codes, spawn errors, bounded diagnostics, and cancellation", async () => {
  const result = await runProcess(
    [process.execPath, "-e", "process.stderr.write('x'.repeat(10000)); process.exit(7)"],
    { cwd: process.cwd(), quiet: true }
  )
  expect(result.code).toBe(7)
  expect(result.stderr.length).toBe(8192)
  await expect(runProcess([], { cwd: "." })).rejects.toThrow("command")
  await expect(runProcess(["buildkit-missing-executable-999"], { cwd: ".", quiet: true })).rejects.toThrow(
    "Cannot start"
  )
  const controller = new AbortController()
  const running = runProcess([process.execPath, "-e", "setInterval(()=>{},1000)"], {
    cwd: ".",
    quiet: true,
    signal: controller.signal,
    onSpawn: () => controller.abort()
  })
  expect((await running).code).not.toBe(0)
  await expect(runProcess([process.execPath], { cwd: ".", signal: controller.signal })).rejects.toThrow(Error)
  const before = process.listenerCount("SIGINT")
  await withSignals(async (signal) => {
    expect(signal.aborted).toBe(false)
  })
  expect(process.listenerCount("SIGINT")).toBe(before)
})
