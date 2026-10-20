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
    const variables = { project: config.project, worktree: worktree ?? "", service, root }
    const expanded = interpolate(worktree === null ? endpoint.primaryName : endpoint.name, variables)
    const labels = expanded.split(".")
    if (!labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) {
      throw new Error(`Endpoint ${service}: use lowercase DNS labels of at most 63 characters`)
    }
    const name = expanded
    if (names.has(name)) {
      throw new Error(`Multiple endpoints resolve to ${name}`)
    }
    names.add(name)
    const hostname = `${name}.${config.domain}`
    if (hostname.length > 253) {
      throw new Error(`Endpoint ${service}: hostname exceeds the 253-character DNS limit`)
    }
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
