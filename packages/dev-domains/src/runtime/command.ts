import path from "node:path"
import { resolveCommand } from "package-manager-detector/commands"
import { type Endpoint, type ResolvedConfig } from "../config/schema.js"
import { interpolate, type ResolvedEndpoint } from "../domains/resolve.js"
import { readManifest } from "../project/manifest.js"

export async function serverCommand(
  endpoint: Endpoint,
  packageManager: ResolvedConfig["packageManager"],
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
    command = []
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
  if (endpoint.script) {
    const resolved = resolveCommand(packageManager, "run", [endpoint.script, ...command])
    if (!resolved) {
      throw new Error(`Cannot run scripts with ${packageManager}`)
    }
    return [resolved.command, ...resolved.args]
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
    PORTLESS_URL: endpoint.origin,
    __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS: endpoint.hostname,
    BUILDKIT_ACTIVE: "1",
    DEV_DOMAINS_ORIGIN: endpoint.origin,
    DEV_DOMAINS_HOSTNAME: endpoint.hostname,
    DEV_DOMAINS_WORKTREE: endpoint.variables.worktree
  }
}
