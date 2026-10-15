import path from "node:path"
import { type Endpoint } from "../config/schema.js"
import { interpolate, type ResolvedEndpoint } from "../domains/resolve.js"
import { readManifest } from "../project/detect.js"

export async function serverCommand(
  endpoint: Endpoint,
  packageManager: string,
  cwd: string,
  variables: Record<string, string>,
  port: number
) {
  const values = { ...variables, port: String(port) }
  let command: string[]
  if (endpoint.script) {
    const manifest = await readManifest(cwd)
    const source = manifest.scripts[endpoint.script]
    if (!source) {
      throw new Error(`Script ${endpoint.script} does not exist in ${cwd}`)
    }
    if (/\b(dev-domains|portless)\b/.test(source)) {
      throw new Error(`Script ${endpoint.script} wraps a domain CLI. Point to the underlying server script instead.`)
    }
    command = [packageManager, "run", endpoint.script]
    if (packageManager === "npm") {
      command.push("--")
    }
  } else {
    command = (endpoint.command ?? []).map((arg) => interpolate(arg, values))
  }
  if (endpoint.framework === "next") {
    command.push("--hostname", "127.0.0.1", "--port", String(port))
  }
  if (endpoint.framework === "vite") {
    command.push("--host", "127.0.0.1", "--port", String(port), "--strictPort")
  }
  if (endpoint.framework === "storybook") {
    command.push("--host", "127.0.0.1", "--port", String(port), "--exact-port", "--no-open", "--ci")
  }
  return command
}

export function serverEnvironment(
  endpoint: ResolvedEndpoint,
  port: number,
  inherited: NodeJS.ProcessEnv
): NodeJS.ProcessEnv {
  const env = {
    ...inherited,
    ...Object.fromEntries(
      Object.entries(endpoint.endpoint.env).map(([key, value]) => [
        key,
        interpolate(value, { ...endpoint.variables, port: String(port) })
      ])
    )
  }
  // Package-local binaries take precedence, followed by workspace ancestors and the current Node runtime.
  const bins = []
  let directory = endpoint.cwd
  while (true) {
    bins.push(path.join(directory, "node_modules", ".bin"))
    const parent = path.dirname(directory)
    if (directory === parent) {
      break
    }
    directory = parent
  }
  const existingPath = Object.entries(env).find(([key]) => key.toUpperCase() === "PATH")?.[1] || ""
  for (const key of Object.keys(env)) {
    if (key.toUpperCase() === "PATH") {
      delete env[key]
    }
  }
  return {
    ...env,
    PATH: [...bins, path.dirname(process.execPath), existingPath].join(path.delimiter),
    PORT: String(port),
    HOST: "127.0.0.1",
    BUILDKIT_ACTIVE: "1",
    DEV_DOMAINS_ORIGIN: endpoint.origin,
    DEV_DOMAINS_HOSTNAME: endpoint.hostname,
    DEV_DOMAINS_WORKTREE: endpoint.variables.worktree
  }
}
