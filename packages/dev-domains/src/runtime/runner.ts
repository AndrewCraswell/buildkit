import { z } from "zod"
import { configSchema } from "../config/schema.js"
import { resolveEndpoints } from "../domains/resolve.js"
import { serverCommand, serverEnvironment } from "./command.js"
import { routeStore } from "./portless.js"
import { runProcess, withSignals } from "./process.js"

const contextSchema = z.object({ config: configSchema, root: z.string(), worktree: z.string(), service: z.string() })
try {
  const context = contextSchema.parse(JSON.parse(process.env.BUILDKIT_RUN_CONTEXT || "null"))
  const endpoint = resolveEndpoints({ ...context, file: undefined }).find(
    (candidate) => candidate.service === context.service
  )
  if (!endpoint) {
    throw new Error("Endpoint disappeared from the runtime context")
  }
  const actual = new URL(process.env.PORTLESS_URL || "")
  const domains = context.config.proxy.domains ?? [context.config.domain]
  const actualPort = Number(actual.port || (actual.protocol === "https:" ? 443 : 80))
  if (
    !domains.some((domain) => actual.hostname === `${endpoint.name}.${domain}`) ||
    actualPort !== context.config.proxy.port ||
    actual.protocol !== (context.config.proxy.https ? "https:" : "http:")
  ) {
    throw new Error(
      "The running Portless proxy has different settings. Coordinate its domains, port, and TLS configuration before running this endpoint."
    )
  }
  const port = z.coerce.number().int().min(1).max(65535).parse(process.env.PORT)
  if (
    !routeStore()
      .loadRoutes()
      .some((route) => route.hostname === endpoint.hostname && route.port === port)
  ) {
    throw new Error(
      `The running proxy did not register ${endpoint.hostname}. Align proxy.domains across your projects.`
    )
  }
  const command = await serverCommand(
    endpoint.endpoint,
    context.config.packageManager,
    endpoint.cwd,
    endpoint.variables,
    port
  )
  const env = serverEnvironment(endpoint, port, process.env)
  delete env.BUILDKIT_RUN_CONTEXT
  delete env.BUILDKIT_RUNNER
  process.exitCode = (await withSignals((signal) => runProcess(command, { cwd: endpoint.cwd, env, signal }))).code
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
