import { loadProject } from "./config/load.js"
import { resolveEndpoints } from "./domains/resolve.js"

/** Structural Playwright options without a runtime dependency on Playwright. */
export async function playwrightServer(service: string, cwd = process.cwd()) {
  const project = await loadProject(cwd)
  const endpoint = resolveEndpoints(project).find((entry) => entry.service === service)
  if (!endpoint || endpoint.endpoint.kind !== "e2e") {
    throw new Error(`Configure ${service} with kind: e2e for a dedicated test server`)
  }
  return {
    use: { baseURL: endpoint.origin },
    webServer: {
      command: `dev-domains run ${service}`,
      cwd: project.root,
      url: endpoint.origin,
      reuseExistingServer: false,
      timeout: 120000
    }
  }
}
