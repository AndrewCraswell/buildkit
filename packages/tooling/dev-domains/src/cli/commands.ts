import { z } from "zod"
import { loadProject } from "../config/load.js"
import { configSchema } from "../config/schema.js"
import { resolveEndpoints } from "../domains/resolve.js"
import { detectConfig } from "../project/detect.js"
import { projectIdentity } from "../project/identity.js"
import { runEndpoint } from "../runtime/portless.js"
import { withSignals } from "../runtime/process.js"
import { proxyCommand } from "../runtime/proxy.js"
import { runTunnel } from "../webhooks/tunnel.js"
import { defineCliCommand as defineCommand } from "./command.js"
import { initialize } from "./init.js"
import { chooseEndpoint, output, text } from "./terminal.js"

const location = {
  cwd: { type: "string", description: "Project directory", default: "." },
  config: { type: "string", description: "Explicit config file (relative to cwd)" }
} as const
const selection = {
  ...location,
  endpoint: { type: "positional", description: "Endpoint name", required: false }
} as const
export const run = defineCommand({
  meta: { description: "Run a detected or configured server through Portless" },
  args: selection,
  async run({ args }) {
    const project = await loadProject(args.cwd, args.config)
    const endpoints = resolveEndpoints(project)
    const name = await chooseEndpoint(endpoints, args.endpoint)
    const endpoint = endpoints.find((entry) => entry.service === name)!
    text(`${name}: ${endpoint.origin}`)
    process.exitCode = await withSignals((signal) => runEndpoint(project, endpoint, signal))
  }
})

const proxy = (action: "setup" | "status" | "doctor", description: string) =>
  defineCommand({
    meta: { description },
    args: location,
    async run({ args }) {
      const project = await loadProject(args.cwd, args.config)
      process.exitCode = (await withSignals((signal) => proxyCommand(project, action, signal))).code
    }
  })

export const commands = {
  run,
  init: defineCommand({
    meta: { description: "Detect tools and save project configuration" },
    args: {
      cwd: location.cwd,
      yes: { type: "boolean", description: "Accept detected defaults without prompts" },
      domain: { type: "string", description: "Local domain suffix" },
      project: { type: "string", description: "Project name" },
      "dry-run": { type: "boolean", description: "Print the config without writing files" }
    },
    async run({ args }) {
      await initialize(args.cwd, { yes: args.yes, domain: args.domain, project: args.project, dryRun: args["dry-run"] })
    }
  }),
  detect: defineCommand({
    meta: { description: "Print detected defaults without reading executable config" },
    args: { cwd: location.cwd },
    async run({ args }) {
      output(await detectConfig((await projectIdentity(args.cwd)).root))
    }
  }),
  urls: defineCommand({
    meta: { description: "Print domains and callback URLs as JSON" },
    args: location,
    async run({ args }) {
      output(
        resolveEndpoints(await loadProject(args.cwd, args.config)).map(
          ({ service, origin, hostname, callbacks, endpoint }) => ({
            service,
            origin,
            hostname,
            callbacks,
            webhookOrigin: endpoint.tunnel?.publicUrl
          })
        )
      )
    }
  }),
  setup: proxy("setup", "Start Portless with the project's proxy settings"),
  status: proxy("status", "Show active Portless routes"),
  doctor: proxy("doctor", "Check Portless, DNS, and certificate trust"),
  tunnel: defineCommand({
    meta: { description: "Expose configured webhook POST paths through a tunnel" },
    args: selection,
    async run({ args }) {
      const project = await loadProject(args.cwd, args.config)
      const endpoints = resolveEndpoints(project).filter((entry) => entry.endpoint.tunnel)
      if (!endpoints.length) {
        throw new Error("No webhook tunnels configured. Run init or add an endpoint.tunnel configuration.")
      }
      const name = await chooseEndpoint(endpoints, args.endpoint)
      process.exitCode = await withSignals((signal) =>
        runTunnel(
          project,
          endpoints.find((entry) => entry.service === name)!,
          signal
        )
      )
    }
  }),
  schema: defineCommand({
    meta: { description: "Print the JSON Schema for editor configuration" },
    run() {
      output(z.toJSONSchema(configSchema, { io: "input", unrepresentable: "any" }))
    }
  })
}
