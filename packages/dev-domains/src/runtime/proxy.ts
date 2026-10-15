import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import http from "node:http"
import https from "node:https"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { isErrnoException, isProcessAlive, PORTLESS_HEADER } from "portless"
import type { Project } from "../domains/resolve.js"
import { runProcess } from "./process.js"
import { stateDirectory } from "./state.js"

const cli = fileURLToPath(new URL("./cli.js", import.meta.resolve("portless")))

export function proxyEnvironment(project: Project): NodeJS.ProcessEnv {
  const proxy = project.config.proxy
  return {
    ...process.env,
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

async function readState(name: string) {
  try {
    return (await readFile(path.join(stateDirectory(), name), "utf8")).trim()
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      return undefined
    }
    throw error
  }
}

/** Suffixes do not limit Portless's exact routes or its per-hostname TLS certificates. */
export async function hasCompatibleProxy(project: Project, signal?: AbortSignal) {
  const pid = Number(await readState("proxy.pid"))
  if (!Number.isSafeInteger(pid) || pid <= 0 || !isProcessAlive(pid)) {
    return false
  }
  const proxy = project.config.proxy
  const port = Number(await readState("proxy.port"))
  const isHttps = existsSync(path.join(stateDirectory(), "proxy.tls"))
  if (port !== proxy.port || isHttps !== proxy.https) {
    throw new Error(
      "The shared Portless proxy has different port or TLS settings. Coordinate those settings before starting this endpoint. The proxy was left running."
    )
  }
  const ca = isHttps ? await readFile(path.join(stateDirectory(), "ca.pem")) : undefined
  const request = isHttps ? https.request : http.request
  const hostname = `proxy.${project.config.domain}`
  await new Promise<void>((resolve, reject) => {
    const req = request(
      {
        host: "127.0.0.1",
        port,
        method: "HEAD",
        path: "/",
        servername: hostname,
        ca,
        headers: { host: hostname },
        signal: AbortSignal.any([AbortSignal.timeout(10000), ...(signal ? [signal] : [])])
      },
      (response) => {
        response.resume()
        if (response.headers[PORTLESS_HEADER.toLowerCase()] !== "1") {
          reject(new Error("The configured port is not responding as Portless. The existing process was left running."))
        } else {
          resolve()
        }
      }
    )
    req.once("error", reject)
    req.end()
  })
  return true
}

export async function proxyCommand(project: Project, action: "setup" | "status" | "doctor", signal?: AbortSignal) {
  if (action === "setup" && (await hasCompatibleProxy(project, signal))) {
    return { code: 0, stderr: "" }
  }
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

export async function ensureProxy(project: Project, signal?: AbortSignal) {
  const result = await proxyCommand(project, "setup", signal)
  if (result.code !== 0 || !(await hasCompatibleProxy(project, signal))) {
    throw new Error("Could not start the Portless proxy. Run dev-domains setup and resolve the reported issue.")
  }
}
