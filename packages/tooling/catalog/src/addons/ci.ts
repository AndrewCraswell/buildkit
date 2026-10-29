import { defineAddon, type Contribution } from "@buildkitgg/scaffolder"

export const ciWorkflow = ".github/workflows/ci.yml"

/** A step of the CI workflow's `verify` job. Steps are keyed by `id`, so add-ons add their own and keep yours. */
export interface CiStep {
  id: string
  name?: string
  if?: string
  uses?: string
  run?: string
  with?: Record<string, string | number | boolean>
  env?: Record<string, string>
}

/** Appends a step to the CI workflow's `verify` job. */
export function ciStep(step: CiStep, path = ciWorkflow, job = "verify"): Contribution {
  return { kind: "yaml", path, pointer: `/jobs/${job}/steps`, op: "append", key: "id", value: step }
}

/** The steps every Buildkit workflow starts with: check out, then install with the app's pinned pnpm and Node 24. */
export function setupSteps(): CiStep[] {
  return [
    { id: "checkout", uses: "actions/checkout@v7", with: { "persist-credentials": false } },
    { id: "pnpm", uses: "pnpm/action-setup@v6" },
    { id: "node", uses: "actions/setup-node@v7", with: { "node-version": 24, cache: "pnpm" } },
    { id: "install", run: "pnpm install --frozen-lockfile" }
  ]
}

/**
 * The app-code checks, as a GitHub Actions workflow. They're Buildkit's: deploys belong to Better Apps' deploy service,
 * whose workflow the Better Apps deploys add-on writes.
 */
export const ci = defineAddon({
  id: "@buildkit/ci",
  version: "1.0.0",
  title: "CI",
  description: "A GitHub Actions workflow that checks, lints, builds and type-checks every push and pull request.",
  contribute: (): Contribution[] => [
    { kind: "yaml", path: ciWorkflow, pointer: "/name", op: "set", value: "CI" },
    {
      kind: "yaml",
      path: ciWorkflow,
      pointer: "/on",
      op: "set",
      value: { push: { branches: ["main"] }, pull_request: { branches: ["main"] } }
    },
    { kind: "yaml", path: ciWorkflow, pointer: "/permissions", op: "set", value: { contents: "read" } },
    { kind: "yaml", path: ciWorkflow, pointer: "/jobs/verify/runs-on", op: "set", value: "ubuntu-latest" },
    ...[
      ...setupSteps(),
      { id: "generated", name: "Check Buildkit's generated files", run: "pnpm buildkit check" },
      { id: "lint", run: "pnpm lint" },
      { id: "format", run: "pnpm format:check" },
      // The build writes src/routeTree.gen.ts, which the type check reads.
      { id: "build", run: "pnpm build" },
      { id: "typecheck", run: "pnpm typecheck" }
    ].map((step) => ciStep(step))
  ]
})
