import { RouteConflictError } from "portless"
import { endpointDirectory, type Project, type ResolvedEndpoint } from "../domains/resolve.js"
import { serverCommand, serverEnvironment } from "./command.js"
import { reservePort } from "./port.js"
import { runProcess } from "./process.js"
import { ensureProxy, proxyEnvironment } from "./proxy.js"
import { routeStore } from "./state.js"

export async function runEndpoint(project: Project, endpoint: ResolvedEndpoint, signal?: AbortSignal, quiet = false) {
  if (process.env.BUILDKIT_ACTIVE) {
    throw new Error("Recursive dev-domains invocation. Configure the underlying server command.")
  }
  await endpointDirectory(project, endpoint)
  const hostnames = (project.config.proxy.domains ?? [project.config.domain]).map(
    (domain) => `${endpoint.name}.${domain}`
  )
  await ensureProxy(project, signal)
  const store = routeStore()
  for (let attempt = 0; attempt < 3; attempt++) {
    signal?.throwIfAborted()
    const reservation = await reservePort()
    const claimed: string[] = []
    try {
      const command = await serverCommand(
        endpoint.endpoint,
        project.config.packageManager,
        endpoint.cwd,
        endpoint.variables,
        reservation.port
      )
      for (const hostname of hostnames) {
        try {
          const existing = store.loadRoutes().find((route) => route.hostname === hostname)
          if (existing) {
            throw new RouteConflictError(hostname, existing.pid)
          }
          // addRoute takes Portless's cross-process lock and never replaces a live owner.
          store.addRoute(hostname, reservation.port, process.pid)
          claimed.push(hostname)
        } catch (error) {
          if (error instanceof RouteConflictError) {
            throw new Error(
              `Domain ${hostname} is already in use. Rename the worktree or configure a different endpoint name. The existing server was left running.`,
              { cause: error }
            )
          }
          throw error
        }
      }
      const env = serverEnvironment(endpoint, reservation.port, proxyEnvironment(project))
      // Most framework CLIs accept a port, not an inherited listening socket.
      // Keep the registration until the child exits; retry a competing external bind.
      await reservation.release()
      const result = await runProcess(command, { cwd: endpoint.cwd, env, signal, quiet })
      if (
        signal?.aborted ||
        result.code === 0 ||
        !/EADDRINUSE|address already in use/i.test(result.stderr) ||
        attempt === 2
      ) {
        return result.code
      }
    } finally {
      // Closing an already released reservation is harmless. Cleanup must also
      // cover command validation failures and partially registered alias sets.
      try {
        await reservation.release()
      } finally {
        for (const hostname of claimed) {
          store.removeRoute(hostname, process.pid)
        }
      }
    }
  }
  return 1
}
