import {
  memoryTree,
  plan,
  type Answers,
  type CatalogManifest,
  type Plan,
  type PlanRequest
} from "@buildkitgg/scaffolder"
import { catalog } from "../catalog.js"
import { settings } from "../settings.js"

/** Plans a request against an in-memory project. */
export function planProject(
  files: Record<string, string>,
  request: PlanRequest,
  options: { catalog?: CatalogManifest; catalogs?: (version: string) => CatalogManifest | undefined } = {}
): Promise<Plan> {
  return plan({
    catalog: options.catalog ?? catalog,
    settings,
    tree: memoryTree(files),
    request,
    ...(options.catalogs ? { catalogs: options.catalogs } : {})
  })
}

export function initRequest(answers: Partial<Answers> = {}): PlanRequest {
  return { intent: { command: "init", answers: { template: "app", mode: "ssr", name: "demo", ...answers } } }
}

export function addRequest(addons: string[], options: Record<string, Record<string, unknown>> = {}): PlanRequest {
  return { intent: { command: "add", addons, replace: [], options } }
}

/** Applies a plan to an in-memory project, the way `applyPlan` does on disk. */
export function applied(files: Record<string, string>, planned: Plan): Record<string, string> {
  if (planned.status !== "planned" && planned.status !== "unchanged") {
    throw new Error(
      `Expected a plan, got ${planned.status}: ${JSON.stringify(planned.error ?? planned.decisions ?? planned.conflicts)}`
    )
  }
  const next = { ...files }
  for (const operation of planned.operations) {
    if (operation.action === "delete") {
      delete next[operation.path]
    } else if (operation.content !== undefined) {
      next[operation.path] = operation.content
    }
  }
  return next
}

/** The text a plan writes at a path, failing the test when it writes nothing there. */
export function written(planned: Plan, path: string): string {
  const content = planned.operations.find((operation) => operation.path === path)?.content
  if (content === undefined) {
    throw new Error(
      `The plan writes nothing at ${path}. It writes ${planned.operations.map((o) => o.path).join(", ")}.`
    )
  }
  return content
}

/** Every path the plan creates or changes. */
export function paths(planned: Plan): string[] {
  return planned.operations.filter((operation) => operation.action !== "delete").map((operation) => operation.path)
}

const preload = '    defaultPreload: "intent",\n'

/**
 * The catalog as an earlier release, for upgrade tests: a lower version whose target's `src/router.tsx` has no
 * `defaultPreload`, and whose localization add-on is an older version.
 */
export function previousCatalog(current: CatalogManifest = catalog): CatalogManifest {
  return {
    ...current,
    version: `${current.version}-previous`,
    targets: current.targets.map((target) => ({
      ...target,
      base: (ctx) =>
        target
          .base(ctx)
          .map((contribution) =>
            contribution.kind === "file" && contribution.path === "src/router.tsx"
              ? { ...contribution, content: contribution.content.replace(preload, "") }
              : contribution
          )
    })),
    addons: current.addons.map((addon) => (addon.id === "@buildkit/i18n" ? { ...addon, version: "0.9.0" } : addon))
  }
}

/** The line the upgrade adds to `src/router.tsx`. */
export const upgradedRouterLine = preload.trim()
