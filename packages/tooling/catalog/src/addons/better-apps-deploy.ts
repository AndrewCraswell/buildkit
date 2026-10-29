import { defineAddon, type Contribution } from "@buildkitgg/scaffolder"
import { file, json } from "../files.js"
import { betterAppsDependency } from "../versions.js"
import { ciStep, setupSteps, type CiStep } from "./ci.js"

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
 * CI runs can finish out of order, so a commit deploys only while it's still main's newest. Once the job holds the
 * deploy slot, a commit main has moved past is skipped: the newer one deploys when its own CI passes.
 */
const newestStep: CiStep = {
  id: "newest",
  name: "Check that main has no newer commit",
  env: { GH_TOKEN: "${{ github.token }}", HEAD_SHA: "${{ github.event.workflow_run.head_sha }}" },
  run: [
    'newest="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"',
    'if [ "$newest" = "$HEAD_SHA" ]; then',
    '  echo "newest=true" >> "$GITHUB_OUTPUT"',
    "else",
    '  echo "main is at $newest now, which deploys once its CI passes."',
    "fi"
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
    "Deploys to staging with Better Apps' deploy service once CI passes on main. Waits on Better Apps' deploy packages.",
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
      // Runs when CI finishes on main, so a commit deploys only once its checks pass.
      {
        kind: "yaml",
        path: deployWorkflow,
        pointer: "/on",
        op: "set",
        value: { workflow_run: { workflows: ["CI"], types: ["completed"], branches: ["main"] } }
      },
      { kind: "yaml", path: deployWorkflow, pointer: "/permissions", op: "set", value: { contents: "read" } },
      {
        kind: "yaml",
        path: deployWorkflow,
        pointer: "/jobs/staging/if",
        op: "set",
        value: "github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.event == 'push'"
      },
      // On the job, so a run whose CI failed is skipped before it joins the queue. Every passing run waits its turn:
      // with one pending run at most, an older commit's could replace the newest's, then skip as not the newest.
      {
        kind: "yaml",
        path: deployWorkflow,
        pointer: "/jobs/staging/concurrency",
        op: "set",
        value: { group: "deploy-staging", "cancel-in-progress": false, queue: "max" }
      },
      { kind: "yaml", path: deployWorkflow, pointer: "/jobs/staging/runs-on", op: "set", value: "ubuntu-latest" },
      { kind: "yaml", path: deployWorkflow, pointer: "/jobs/staging/environment", op: "set", value: "staging" },
      ...[
        newestStep,
        // The commit CI checked, not whatever main is now.
        ...setupSteps().map((step) =>
          step.id === "checkout"
            ? { ...step, with: { ...step.with, ref: "${{ github.event.workflow_run.head_sha }}" } }
            : step
        ),
        { id: "deploy", name: "Deploy to staging with Better Apps", run: "pnpm exec better-apps deploy --env staging" }
      ]
        .map((step) => (step.id === newestStep.id ? step : { ...step, if: "steps.newest.outputs.newest == 'true'" }))
        .map((step) => ciStep(step, { path: deployWorkflow, job: "staging" }))
    ]
  },
  nextSteps: () => [
    "Deploys start working once Better Apps publishes @better-apps/tanstack-start and @better-apps/cli with the deploy service."
  ]
})
