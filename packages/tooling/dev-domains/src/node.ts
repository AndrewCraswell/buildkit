import { loadProject } from "./config/load.js"
import { resolveEndpoints } from "./domains/resolve.js"

/** Resolved addresses for build scripts, workers, and other Node.js tooling. */
export type EndpointInfo = {
  service: string
  hostname: string
  origin: string
  callbacks: string[]
  cwd: string
}

/** Loads the same trusted local configuration as the CLI, without starting a server. */
export async function getEndpoint(service: string, cwd = process.cwd()): Promise<EndpointInfo> {
  const endpoint = resolveEndpoints(await loadProject(cwd)).find((entry) => entry.service === service)
  if (!endpoint) {
    throw new Error(`Unknown endpoint: ${service}`)
  }
  return {
    service: endpoint.service,
    hostname: endpoint.hostname,
    origin: endpoint.origin,
    callbacks: endpoint.callbacks,
    cwd: endpoint.cwd
  }
}
