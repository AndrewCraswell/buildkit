import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { createTwoFilesPatch } from "diff"
import { z } from "zod"
import type { CatalogManifest } from "../manifest/types.js"
import { artifactName, toEnvelope } from "../plan/envelope.js"
import { PlanError } from "../plan/errors.js"
import { plan } from "../plan/plan.js"
import { planRequestSchema } from "../plan/request-schema.js"
import type { Plan, PlanRequest } from "../plan/types.js"
import { readLock } from "../state/files.js"
import { lockPath, type ProductSettings } from "../state/settings.js"
import { applyPlan, type ApplyHooks } from "./apply.js"
import { nodeTree, readSafely } from "./tree.js"

export interface ProjectContext {
  root: string
  catalog: CatalogManifest
  settings: ProductSettings
  catalogs?: (version: string) => CatalogManifest | undefined
  catalogIntegrity?: string
}

/** Snapshots the project on disk and plans the request. */
export async function planProject(context: ProjectContext, request: PlanRequest): Promise<Plan> {
  return plan({
    catalog: context.catalog,
    request,
    tree: nodeTree(context.root),
    settings: context.settings,
    ...(context.catalogs ? { catalogs: context.catalogs } : {}),
    ...(context.catalogIntegrity ? { catalogIntegrity: context.catalogIntegrity } : {})
  })
}

function lastApplied(context: ProjectContext): string | undefined {
  const path = lockPath(context.settings)
  const state = readSafely(context.root, path)
  if (state.kind !== "file") {
    return undefined
  }
  try {
    return readLock(path, state.content).lastApply?.fingerprint
  } catch {
    return undefined
  }
}

/**
 * Applies a reviewed plan: plans the request again, and applies only when the new plan has the reviewed fingerprint.
 * Re-applying a plan that was already applied is a no-op.
 */
export async function applyReviewed(
  context: ProjectContext,
  reviewed: { request: PlanRequest; fingerprint: string },
  options: { secrets?: Record<string, string>; hooks?: ApplyHooks } = {}
): Promise<{ plan: Plan; status: "applied" | "unchanged" }> {
  if (lastApplied(context) === reviewed.fingerprint) {
    // The lock now records this apply, so the fingerprint differs even with no change. The status is what counts. An
    // init can't be planned twice, so a sync checks that the project still matches what it created.
    const again: PlanRequest =
      reviewed.request.intent.command === "init" ? { intent: { command: "sync" } } : reviewed.request
    const current = await planProject(context, again)
    if (current.status !== "unchanged") {
      throw new PlanError("E_DRIFT", "The project changed after the plan was applied. Review the new plan.", {
        paths: current.operations.map((operation) => operation.path)
      })
    }
    return { plan: current, status: "unchanged" }
  }
  const current = await planProject(context, reviewed.request)
  if (current.fingerprint !== reviewed.fingerprint) {
    throw new PlanError("E_DRIFT", "The project changed after the plan was reviewed. Review the new plan.", {
      paths: current.operations.map((operation) => operation.path)
    })
  }
  const result = await applyPlan(current, {
    root: context.root,
    settings: context.settings,
    ...(options.secrets ? { secrets: options.secrets } : {}),
    ...(options.hooks ? { hooks: options.hooks } : {})
  })
  current.notices.push(...result.notices)
  return { plan: current, status: result.status }
}

const planFileSchema = z.object({ fingerprint: z.string(), request: planRequestSchema })

/** Reads a plan artifact. It's untrusted: only its request and fingerprint are used, and the request is planned again. */
export function readPlanFile(path: string): { request: PlanRequest; fingerprint: string } {
  let value: unknown
  try {
    value = JSON.parse(readFileSync(path, "utf8"))
  } catch (error) {
    throw new PlanError(
      "E_USAGE",
      `${path} can't be read as a plan: ${error instanceof Error ? error.message : String(error)}`
    )
  }
  const parsed = planFileSchema.safeParse(value)
  if (!parsed.success) {
    throw new PlanError("E_USAGE", `${path} isn't a plan file.`)
  }
  return parsed.data
}

export type DiffScope = "none" | "user" | "all"

/** Writes `plan.json`, a patch per changed path, and each conflict's base, current and incoming versions. */
export function writeArtifacts(plan: Plan, folder: string, options: { product: string; diff?: DiffScope }): string {
  mkdirSync(folder, { recursive: true })
  const envelope = toEnvelope(plan, { product: options.product, artifacts: folder })
  writeFileSync(
    join(folder, "plan.json"),
    `${JSON.stringify({ fingerprint: plan.fingerprint, request: plan.request, envelope }, null, 2)}\n`
  )
  const scope = options.diff ?? "user"
  for (const operation of plan.operations) {
    if (
      operation.secret ||
      scope === "none" ||
      (scope === "user" && operation.class === "owned" && operation.action !== "delete")
    ) {
      continue
    }
    const patch = createTwoFilesPatch(
      `a/${operation.path}`,
      `b/${operation.path}`,
      operation.before ?? "",
      operation.content ?? ""
    )
    const target = join(folder, "patches", `${operation.path}.patch`)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, patch)
  }
  for (const conflict of plan.conflicts) {
    const target = join(folder, "conflicts", artifactName(conflict.id))
    mkdirSync(target, { recursive: true })
    for (const side of ["base", "current", "incoming"] as const) {
      const content = conflict[side]
      if (content !== undefined) {
        writeFileSync(join(target, side), content)
      }
    }
  }
  return folder
}

export function defaultArtifactFolder(root: string, settings: ProductSettings, plan: Plan): string {
  return join(root, settings.stateDir, "plans", plan.fingerprint.slice(0, 16))
}
