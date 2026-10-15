import * as prompts from "@clack/prompts"
import { z } from "zod"
import { findConfig, saveConfig } from "../config/load.js"
import { configSchema, type DevDomainsConfig } from "../config/schema.js"
import { resolveEndpoints } from "../domains/resolve.js"
import { detectConfig } from "../project/detect.js"
import { projectIdentity } from "../project/identity.js"
import { answer, Cancelled, intro, output, text } from "./terminal.js"

async function ask(message: string, value: string, validate?: (input: string) => string | undefined) {
  return answer(
    await prompts.text({
      message,
      defaultValue: value,
      placeholder: value,
      validate: (input) => validate?.(input?.trim() || value)
    })
  )
}
async function commandInput() {
  const value = await ask(
    'Command as a JSON argument array, for example ["node", "server.js"]',
    '["node", "server.js"]',
    (input) => {
      try {
        z.array(z.string().min(1)).min(1).parse(JSON.parse(input))
        return undefined
      } catch {
        return 'Use a JSON array, for example ["node", "server.js"].'
      }
    }
  )
  return z.array(z.string().min(1)).min(1).parse(JSON.parse(value))
}

export async function initialize(
  cwd: string,
  options: { yes?: boolean; domain?: string; project?: string; dryRun?: boolean }
) {
  const identity = await projectIdentity(cwd)
  if (await findConfig(identity.root, identity.root)) {
    throw new Error("Configuration already exists. Edit it directly; init does not overwrite files.")
  }
  const candidate = await detectConfig(identity.root)
  candidate.project = options.project || candidate.project
  candidate.domain = options.domain || "localhost"
  if (!options.yes) {
    if (!process.stdin.isTTY) {
      throw new Error("Interactive setup needs a terminal. Use init --yes to accept detected defaults.")
    }
    intro()
    prompts.note("Use arrow keys to move, Space to select, and Enter to continue. Ctrl+C cancels.", "Keyboard")
    candidate.project = await ask("Project name", candidate.project, (value) =>
      configSchema.shape.project.safeParse(value).success ? undefined : "Use a lowercase DNS label."
    )
    candidate.domain = await ask("Local domain suffix", candidate.domain, (value) =>
      configSchema.shape.domain.safeParse(value).success ? undefined : "Use a domain without protocol, path, or port."
    )
    const entries = Object.entries(candidate.endpoints)
    if (entries.length) {
      const selected = answer(
        await prompts.multiselect({
          showInstructions: false,
          message: "Which detected servers should have domains?",
          required: true,
          initialValues: entries.map(([key]) => key),
          options: entries.map(([key, endpoint]) => ({
            value: key,
            label: key,
            hint: `${endpoint.cwd} / ${endpoint.script}`
          }))
        })
      )
      candidate.endpoints = Object.fromEntries(entries.filter(([key]) => selected.includes(key)))
    } else {
      prompts.note(
        "No dev server scripts were detected. Add a command that listens on PORT or accepts {port}.",
        "Add a server"
      )
      candidate.endpoints.app = { command: await commandInput(), name: "{project}-{worktree}" }
    }
    const additions: DevDomainsConfig["endpoints"] = {}
    for (const [key, endpoint] of Object.entries(candidate.endpoints)) {
      endpoint.name = await ask(
        `Domain name for ${key} ({project}, {worktree}, {service} supported)`,
        endpoint.name || "{project}-{worktree}-{service}"
      )
      if (endpoint.kind === "storybook") {
        continue
      }
      const capabilities = answer(
        await prompts.multiselect({
          showInstructions: false,
          message: `Optional capabilities for ${key}`,
          required: false,
          options: [
            { value: "auth", label: "Authentication callback paths" },
            { value: "e2e", label: "Dedicated Playwright server" },
            { value: "webhooks", label: "Webhook tunnel" }
          ]
        })
      )
      if (capabilities.includes("auth")) {
        endpoint.auth = (await ask("Callback paths, separated by commas", "/callback"))
          .split(",")
          .map((value) => value.trim())
      }
      if (capabilities.includes("e2e")) {
        const script = await ask("Script for the dedicated test server", endpoint.script || "dev")
        const name = `${key}-e2e`
        if (candidate.endpoints[name]) {
          throw new Error(`Endpoint ${name} already exists`)
        }
        additions[name] = {
          ...endpoint,
          kind: "e2e",
          command: undefined,
          script,
          name: "{project}-{worktree}-{service}",
          auth: [],
          env: { DEV_DOMAINS_OUTPUT_DIR: `.dev-domains/${name}` }
        }
        prompts.note(
          "For frameworks with build locks, configure the test server to use DEV_DOMAINS_OUTPUT_DIR as a separate output directory. Databases remain shared.",
          "Test server isolation"
        )
      }
      if (capabilities.includes("webhooks")) {
        prompts.note(
          "Enter a tunnel command that uses {url} for its target. Credentials stay in the provider's environment or login store. Exposure starts only with dev-domains tunnel.",
          "Public webhook access"
        )
        endpoint.tunnel = {
          command: await commandInput(),
          paths: (await ask("Allowed POST paths, separated by commas", "/api/webhooks"))
            .split(",")
            .map((value) => value.trim())
        }
      }
    }
    Object.assign(candidate.endpoints, additions)
  }
  const config = configSchema.parse(candidate)
  const endpoints = resolveEndpoints({ config, ...identity, file: undefined })
  if (options.dryRun) {
    output(candidate)
    return
  }
  if (!options.yes) {
    prompts.note(endpoints.map((endpoint) => `${endpoint.service}: ${endpoint.origin}`).join("\n"), "Review domains")
    if (!answer(await prompts.confirm({ message: "Save dev-domains.json?", initialValue: true }))) {
      throw new Cancelled()
    }
  }
  const file = await saveConfig(identity.root, candidate)
  if (options.yes) {
    text(`Saved ${file}\nNext: dev-domains setup, then dev-domains run <endpoint>`)
  } else {
    prompts.outro(`Saved ${file}\nNext: dev-domains setup, then dev-domains run <endpoint>`)
  }
}
