import { createHash } from "node:crypto"
import { realpath } from "node:fs/promises"
import path from "node:path"
import { type loadProject } from "../config/load.js"

export type Project = Awaited<ReturnType<typeof loadProject>>
export function interpolate(value: string, variables: Record<string, string>): string {
  return value.replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g, (_, key: string) => {
    const replacement = variables[key]
    if (replacement === undefined) {
      throw new Error(`Unknown template variable {${key}}`)
    }
    return replacement
  })
}

export function resolveEndpoints(project: Project) {
  const { config, worktree, root } = project
  const names = new Set<string>()
  return Object.entries(config.endpoints).map(([service, endpoint]) => {
    const variables = { project: config.project, worktree, service, root }
    const expanded = interpolate(endpoint.name, variables)
    if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(expanded)) {
      throw new Error(`Endpoint ${service}: resolved name must be one lowercase DNS label`)
    }
    const name =
      expanded.length > 63
        ? `${expanded.slice(0, 52).replace(/-+$/, "")}-${createHash("sha256").update(expanded).digest("hex").slice(0, 10)}`
        : expanded
    if (names.has(name)) {
      throw new Error(`Multiple endpoints resolve to ${name}`)
    }
    names.add(name)
    const hostname = `${name}.${config.domain}`
    const protocol = config.proxy.https ? "https" : "http"
    const port = config.proxy.port === (config.proxy.https ? 443 : 80) ? "" : `:${config.proxy.port}`
    const origin = `${protocol}://${hostname}${port}`
    return {
      service,
      name,
      hostname,
      origin,
      cwd: path.resolve(root, endpoint.cwd),
      endpoint,
      variables: { ...variables, hostname, origin },
      callbacks: endpoint.auth.map((callback) => `${origin}${callback}`)
    }
  })
}
export type ResolvedEndpoint = ReturnType<typeof resolveEndpoints>[number]

export async function endpointDirectory(project: Project, endpoint: ResolvedEndpoint) {
  const root = await realpath(project.root)
  const directory = await realpath(endpoint.cwd)
  const relative = path.relative(root, directory)
  if (relative.startsWith(`..${path.sep}`) || relative === ".." || path.isAbsolute(relative)) {
    throw new Error(`Endpoint ${endpoint.service} is outside the configuration root`)
  }
  return directory
}
