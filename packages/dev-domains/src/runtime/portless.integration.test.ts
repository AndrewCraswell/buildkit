import { execFileSync } from "node:child_process"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { createServer, request } from "node:http"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { expect, it } from "vitest"
import { proxyCommand, routeStore, runEndpoint } from "../../dist/runtime/portless.js"
import { loadProject } from "../config/load.js"
import { resolveEndpoints } from "../domains/resolve.js"
import { runProcess } from "./process.js"

async function unusedPort() {
  const server = createServer()
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (!address || typeof address === "string") {
    throw new Error("No port")
  }
  await new Promise<void>((resolve) => server.close(() => resolve()))
  return address.port
}
async function waitFor(check: () => boolean | Promise<boolean>) {
  const deadline = Date.now() + 20000
  while (Date.now() < deadline) {
    if (await check()) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error("Timed out waiting for server state")
}
async function get(port: number, hostname: string) {
  return new Promise<string>((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port, headers: { host: hostname } }, (res) => {
      let body = ""
      res.on("data", (chunk) => {
        body += chunk
      })
      res.on("end", () => resolve(body))
    })
    req.on("error", reject)
    req.end()
  })
}

it("isolates real repositories and linked worktrees, rejects takeover, and cleans owned routes", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "buildkit-integration-"))
  const state = path.join(root, "state")
  const primary = path.join(root, "repo one")
  const secondary = path.join(root, "repo two")
  const worktreeParent =
    process.platform === "win32" ? "D:/system/worktrees/buildkit" : path.join(os.tmpdir(), "buildkit-worktrees")
  await mkdir(worktreeParent, { recursive: true })
  const worktree = path.join(worktreeParent, path.basename(root))
  const previous = process.env.PORTLESS_STATE_DIR
  process.env.PORTLESS_STATE_DIR = state
  const port = await unusedPort()
  const controllers: AbortController[] = []
  const running: Promise<number>[] = []
  const git = (...args: string[]) => execFileSync("git", ["-C", primary, ...args], { stdio: "pipe" })
  try {
    for (const [directory, project] of [
      [primary, "first"],
      [secondary, "second"]
    ]) {
      await mkdir(directory!, { recursive: true })
      await writeFile(
        path.join(directory!, "server.mjs"),
        'import {createServer} from "node:http"; createServer((req,res)=>res.end(process.env.DEV_DOMAINS_ORIGIN)).listen(Number(process.env.PORT),"127.0.0.1")'
      )
      await writeFile(
        path.join(directory!, "dev-domains.json"),
        JSON.stringify({
          project,
          domain: project === "second" ? "local.example.test" : "localhost",
          proxy: { port, https: false, syncHosts: false, domains: ["localhost", "local.example.test"] },
          endpoints: { app: { command: [process.execPath, "server.mjs"], name: "{project}-{worktree}" } }
        })
      )
    }
    git("init", "--quiet")
    git("add", ".")
    git(
      "-c",
      "user.name=Buildkit tests",
      "-c",
      "user.email=tests@example.invalid",
      "-c",
      "core.hooksPath=/dev/null",
      "commit",
      "--quiet",
      "-m",
      "fixture"
    )
    git("worktree", "add", "--detach", worktree, "HEAD")
    const projects = await Promise.all([primary, secondary, worktree].map((directory) => loadProject(directory)))
    expect(projects[2]!.worktree).not.toBe("main")
    expect((await proxyCommand(projects[0]!, "setup")).code).toBe(0)
    for (const project of projects) {
      const endpoint = resolveEndpoints(project)[0]!
      const controller = new AbortController()
      controllers.push(controller)
      running.push(runEndpoint(project, endpoint, controller.signal, true))
    }
    await waitFor(() => routeStore().loadRoutes().length === 6)
    const routes = routeStore().loadRoutes()
    expect(new Set(routes.map((route) => route.port)).size).toBe(3)
    for (const project of projects) {
      const endpoint = resolveEndpoints(project)[0]!
      let last = ""
      try {
        await waitFor(async () => {
          last = await get(port, endpoint.hostname)
          return last === endpoint.origin
        })
      } catch {
        throw new Error(
          `Expected ${endpoint.origin}; received ${last.slice(-1600) + JSON.stringify(routeStore().loadRoutesRaw())}`
        )
      }
    }
    const duplicate = await runEndpoint(projects[0]!, resolveEndpoints(projects[0]!)[0]!, undefined, true)
    expect(duplicate).not.toBe(0)
    expect(routeStore().loadRoutes().length).toBe(6)
    controllers[0]!.abort()
    await running[0]
    expect(routeStore().loadRoutes().length).toBe(4)
    const survivor = resolveEndpoints(projects[1]!)[0]!
    expect(await get(port, survivor.hostname)).toBe(survivor.origin)
    const packedCli = fileURLToPath(new URL("../../dist/cli/main.js", import.meta.url))
    const help = await runProcess([process.execPath, packedCli, "--help"], { cwd: primary, quiet: true })
    expect(help.code).toBe(0)
    expect(await readFile(path.join(primary, "dev-domains.json"), "utf8")).toContain("first")
  } finally {
    controllers.forEach((controller) => controller.abort())
    await Promise.allSettled(running)
    expect(routeStore().loadRoutes().length).toBe(0)
    const portless = fileURLToPath(new URL("./cli.js", import.meta.resolve("portless")))
    await runProcess([process.execPath, portless, "proxy", "stop"], {
      cwd: root,
      env: { ...process.env, PORTLESS_PORT: String(port), PORTLESS_HTTPS: "0", PORTLESS_SYNC_HOSTS: "0" },
      quiet: true
    })
    try {
      git("worktree", "remove", "--force", worktree)
    } catch {
      /* Setup may fail before creation. */
    }
    if (previous === undefined) {
      delete process.env.PORTLESS_STATE_DIR
    } else {
      process.env.PORTLESS_STATE_DIR = previous
    }
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }
})
