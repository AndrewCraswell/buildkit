import path from "node:path"
import { fileURLToPath } from "node:url"
import { RouteStore, resolveUserHome } from "portless"
import { endpointDirectory, type Project, type ResolvedEndpoint } from "../domains/resolve.js"
import { runProcess } from "./process.js"

const cli = fileURLToPath(new URL("./cli.js", import.meta.resolve("portless")))
export function stateDirectory() {
  return process.env.PORTLESS_STATE_DIR || path.join(resolveUserHome(), ".portless")
}
export function routeStore() {
  return new RouteStore(stateDirectory())
}

export function proxyEnvironment(project: Project): NodeJS.ProcessEnv {
  const proxy = project.config.proxy
  return {
    ...process.env,
    // We invoke our pinned local dependency directly, not through a package
    // downloader. Do not pass the caller's pnpm exec/npx launcher markers.
    npm_command: undefined,
    PNPM_SCRIPT_SRC_DIR: undefined,
    PORTLESS: "1",
    PORTLESS_TLD: (proxy.domains ?? [project.config.domain]).join(","),
    PORTLESS_PORT: String(proxy.port),
    PORTLESS_HTTPS: proxy.https ? "1" : "0",
    PORTLESS_LAN: "0",
    PORTLESS_SYNC_HOSTS: proxy.syncHosts ? "1" : "0",
    PORTLESS_NGROK: "0",
    PORTLESS_TAILSCALE: "0",
    PORTLESS_FUNNEL: "0",
    PORTLESS_APP_PORT: ""
  }
}

export async function proxyCommand(project: Project, action: "setup" | "status" | "doctor", signal?: AbortSignal) {
  const args =
    action === "setup"
      ? [
          "proxy",
          "start",
          ...(project.config.proxy.domains ?? [project.config.domain]).flatMap((domain) => ["--tld", domain]),
          "--port",
          String(project.config.proxy.port),
          ...(project.config.proxy.https ? [] : ["--no-tls"])
        ]
      : [action === "status" ? "list" : "doctor"]
  return runProcess([process.execPath, cli, ...args], { cwd: project.root, env: proxyEnvironment(project), signal })
}

export async function runEndpoint(project: Project, endpoint: ResolvedEndpoint, signal?: AbortSignal, quiet = false) {
  if (process.env.BUILDKIT_ACTIVE) {
    throw new Error("Recursive dev-domains invocation. Configure the underlying server command.")
  }
  await endpointDirectory(project, endpoint)
  const hostnames = (project.config.proxy.domains ?? [project.config.domain]).map(
    (domain) => `${endpoint.name}.${domain}`
  )
  const conflict = routeStore()
    .loadRoutes()
    .find((route) => hostnames.includes(route.hostname))
  if (conflict) {
    throw new Error(
      `Domain ${conflict.hostname} is already in use on port ${conflict.port}. Rename the worktree or configure a different endpoint name. The existing server was left running.`
    )
  }
  const env = proxyEnvironment(project)
  env.BUILDKIT_RUN_CONTEXT = JSON.stringify({
    config: project.config,
    root: project.root,
    worktree: project.worktree,
    service: endpoint.service
  })
  env.BUILDKIT_RUNNER = new URL("./runner.js", import.meta.url).href
  // Portless 0.15.8 joins Windows arguments through cmd.exe. Keep user input in the
  // environment and pass only a fixed bootstrap expression through that shell.
  const expression = "import(process.env.BUILDKIT_RUNNER)"
  const args = [process.execPath, cli, "--name", endpoint.name, "node", "-e", expression]
  for (let attempt = 0; attempt < 3; attempt++) {
    let owner: number | undefined
    try {
      const result = await runProcess(args, {
        cwd: endpoint.cwd,
        env,
        signal,
        quiet,
        onSpawn: (pid) => {
          owner = pid
        }
      })
      if (
        signal?.aborted ||
        result.code === 0 ||
        !/EADDRINUSE|address already in use/i.test(result.stderr) ||
        attempt === 2
      ) {
        return result.code
      }
    } finally {
      // Windows termination may skip Portless's JS exit handler. Owner checks
      // prevent this cleanup from removing a route acquired by another process.
      if (owner) {
        const store = routeStore()
        for (const route of store.loadRoutesRaw()) {
          if (route.pid === owner) {
            store.removeRoute(route.hostname, owner)
          }
        }
      }
    }
  }
  return 1
}
