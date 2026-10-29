import { defineAddon, type Contribution } from "@buildkitgg/scaffolder"
import { file, json } from "../files.js"
import { betterAppsDependency } from "../versions.js"
import { ciStep, setupSteps } from "./ci.js"

const deployWorkflow = ".github/workflows/deploy.yml"

/** Capabilities the app's add-ons declare resources with, keyed by the add-on that adds them. */
const capabilities: Record<string, string> = { "@buildkit/sql": "sql" }

/**
 * The environments Better Apps' deploy service reads. They say how each environment gets its resources, never where
 * it runs: the deploy service picks the cloud.
 */
function environments(used: string[]): string {
  const resources = (policy: string) => Object.fromEntries(used.map((capability) => [capability, policy]))
  const value = {
    environments: {
      preview: { kind: "per-pr", resources: resources("per-pr") },
      staging: { kind: "long-lived", resources: resources("shared") },
      production: { kind: "long-lived", protected: true, resources: resources("shared") }
    }
  }
  return [
    "// Better Apps' deploy service reads this file: each environment, and whether it gets its own resources (per-pr),",
    "// shares them (shared) or has none. It names no cloud, account or binding.",
    json(value)
  ].join("\n")
}

/**
 * Deploys through Better Apps' deploy service: the Better Apps Vite plugin finds the resources the app declares, and a
 * workflow runs `better-apps deploy`. Neither package is published yet, so this add-on isn't offered by the template.
 */
export const betterAppsDeploy = defineAddon({
  id: "@buildkit/better-apps-deploy",
  version: "1.0.0",
  title: "Better Apps deploys",
  description:
    "Deploys to staging with Better Apps' deploy service on every push to main. Waits on Better Apps' deploy packages.",
  requires: ["@buildkit/ci"],
  supports: ({ target }) => (target.has("vite") ? true : "The Better Apps plugin is a Vite plugin."),
  contribute(ctx): Contribution[] {
    const used = Object.entries(capabilities)
      .filter(([addon]) => ctx.selected(addon))
      .map(([, capability]) => capability)
    return [
      ...betterAppsDependency("@better-apps/tanstack-start"),
      ...betterAppsDependency("@better-apps/cli", true),
      // In `framework`, so it runs before tanstackStart(): it reads the declarations Start's server bundle keeps.
      {
        kind: "entry",
        point: "vite.plugins",
        id: "better-apps",
        order: { band: "framework" },
        value: { call: { module: "@better-apps/tanstack-start/vite", export: "betterApps" } }
      },
      file("better-apps.environments.jsonc", environments(used)),
      { kind: "yaml", path: deployWorkflow, pointer: "/name", op: "set", value: "Deploy" },
      { kind: "yaml", path: deployWorkflow, pointer: "/on", op: "set", value: { push: { branches: ["main"] } } },
      { kind: "yaml", path: deployWorkflow, pointer: "/permissions", op: "set", value: { contents: "read" } },
      {
        kind: "yaml",
        path: deployWorkflow,
        pointer: "/concurrency",
        op: "set",
        value: { group: "deploy-staging", "cancel-in-progress": false }
      },
      { kind: "yaml", path: deployWorkflow, pointer: "/jobs/staging/runs-on", op: "set", value: "ubuntu-latest" },
      { kind: "yaml", path: deployWorkflow, pointer: "/jobs/staging/environment", op: "set", value: "staging" },
      ...[
        ...setupSteps(),
        { id: "deploy", name: "Deploy to staging with Better Apps", run: "pnpm exec better-apps deploy --env staging" }
      ].map((step) => ciStep(step, deployWorkflow, "staging"))
    ]
  },
  nextSteps: () => [
    "Deploys start working once Better Apps publishes @better-apps/tanstack-start and @better-apps/cli with the deploy service."
  ]
})
