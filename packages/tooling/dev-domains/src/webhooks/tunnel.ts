import { interpolate, type Project, type ResolvedEndpoint } from "../domains/resolve.js"
import { runProcess } from "../runtime/process.js"
import { routeStore } from "../runtime/state.js"
import { startGateway } from "./gateway.js"

export async function runTunnel(project: Project, endpoint: ResolvedEndpoint, signal?: AbortSignal) {
  const tunnel = endpoint.endpoint.tunnel
  if (!tunnel) {
    throw new Error(`No tunnel configured for ${endpoint.service}. Add an explicit command and allowed paths.`)
  }
  if (!tunnel.command.some((arg) => arg.includes("{url}"))) {
    throw new Error("Tunnel command must use {url} to target the restricted gateway")
  }
  const target = () =>
    routeStore()
      .loadRoutes()
      .find((route) => route.hostname === endpoint.hostname)?.port
  if (!target()) {
    throw new Error(`Start ${endpoint.service} before opening its tunnel`)
  }
  const gateway = await startGateway({ paths: tunnel.paths, hostname: endpoint.hostname, target })
  try {
    process.stdout.write(
      `Exposing POST ${tunnel.paths.join(", ")} for ${endpoint.origin}\n${tunnel.publicUrl ? `Public origin: ${tunnel.publicUrl}\n` : "The tunnel provider will print its public URL.\n"}`
    )
    return (
      await runProcess(
        tunnel.command.map((arg) => interpolate(arg, { ...endpoint.variables, url: gateway.url })),
        { cwd: project.root, signal }
      )
    ).code
  } finally {
    await gateway.close()
  }
}
