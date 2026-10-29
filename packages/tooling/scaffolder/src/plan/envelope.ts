import type { CatalogManifest } from "../manifest/types.js"
import { requestArgv } from "./argv.js"
import type { Plan, PlanErrorInfo, PlanRequest } from "./types.js"

export type EnvelopeStatus = "planned" | "applied" | "unchanged" | "needs-decision" | "conflict" | "error"

/** One bounded JSON object on stdout. Full contents go to plan artifacts, never here. */
export interface Envelope {
  status: EnvelopeStatus
  fingerprint?: string
  catalog?: { id: string; version: string }
  baseline?: Plan["baseline"]
  decisions?: {
    id: string
    message: string
    choices: { id: string; label: string; request: PlanRequest; argv: string[] }[]
  }[]
  conflicts?: { id: string; path: string; kind: string; message: string; resolutions: string[]; artifacts?: string }[]
  operations?: {
    path: string
    action: "create" | "update" | "delete"
    class: string
    linesAdded: number
    linesRemoved: number
    secret?: boolean
  }[]
  pulled?: Plan["pulled"]
  required?: string[]
  packages?: Plan["packages"]
  env?: Plan["env"]
  commands?: Plan["commands"]
  migrations?: Plan["migrations"]
  merged?: Plan["merged"]
  upgrade?: Plan["upgrade"]
  notices?: Plan["notices"]
  nextSteps?: string[]
  artifacts?: string
  error?: PlanErrorInfo
}

function nonEmpty<T>(key: string, values: T[] | undefined): Record<string, T[]> {
  return values && values.length > 0 ? { [key]: values } : {}
}

export function toEnvelope(
  plan: Plan,
  options: {
    product: string
    status?: EnvelopeStatus
    artifacts?: string
    /** The installed catalog, so each choice's command writes `--without` for a declined default. */
    catalog?: CatalogManifest
    /** Earlier catalog versions, for a choice that plans with one. */
    catalogs?: (version: string) => CatalogManifest | undefined
  }
): Envelope {
  // A choice that plans with another catalog version is written against that version's defaults.
  const catalogFor = (request: PlanRequest) =>
    request.catalogVersion === undefined || request.catalogVersion === options.catalog?.version
      ? options.catalog
      : options.catalogs?.(request.catalogVersion)
  return {
    status: options.status ?? plan.status,
    ...(plan.fingerprint ? { fingerprint: plan.fingerprint } : {}),
    catalog: plan.catalog,
    ...(plan.baseline ? { baseline: plan.baseline } : {}),
    ...nonEmpty(
      "decisions",
      plan.decisions.map((decision) => ({
        id: decision.id,
        message: decision.message,
        choices: decision.choices.map((choice) => {
          const catalog = catalogFor(choice.request)
          return { ...choice, argv: [options.product, ...requestArgv(choice.request, catalog ? { catalog } : {})] }
        })
      }))
    ),
    ...nonEmpty(
      "conflicts",
      plan.conflicts.map((conflict) => ({
        id: conflict.id,
        path: conflict.path,
        kind: conflict.kind,
        message: conflict.message,
        resolutions: conflict.resolutions,
        ...(options.artifacts ? { artifacts: `${options.artifacts}/conflicts/${artifactName(conflict.id)}` } : {})
      }))
    ),
    ...nonEmpty(
      "operations",
      plan.operations.map((operation) => ({
        path: operation.path,
        action: operation.action,
        class: operation.class,
        linesAdded: operation.secret ? 0 : operation.linesAdded,
        linesRemoved: operation.secret ? 0 : operation.linesRemoved,
        ...(operation.secret ? { secret: true } : {})
      }))
    ),
    ...nonEmpty("pulled", plan.pulled),
    ...nonEmpty("required", plan.required),
    ...nonEmpty("packages", plan.packages),
    ...nonEmpty("env", plan.env),
    ...nonEmpty("commands", plan.commands),
    ...nonEmpty("migrations", plan.migrations),
    ...nonEmpty("merged", plan.merged),
    ...(plan.upgrade &&
    (plan.upgrade.addons.length > 0 ||
      plan.upgrade.packs.length > 0 ||
      plan.upgrade.catalog.from !== plan.upgrade.catalog.to)
      ? { upgrade: plan.upgrade }
      : {}),
    ...nonEmpty("notices", plan.notices),
    ...nonEmpty("nextSteps", plan.nextSteps),
    ...(options.artifacts ? { artifacts: options.artifacts } : {}),
    ...(plan.error ? { error: plan.error } : {})
  }
}

/** A file-system-safe folder name for a conflict's artifacts. */
export function artifactName(id: string): string {
  return id.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 120)
}

/** 0 planned, applied or unchanged; 1 needs a decision; 3 conflict; 4 drift; 5 locked or interrupted; 130 cancelled; 2 otherwise. */
export function exitCode(envelope: Pick<Envelope, "status" | "error">): number {
  switch (envelope.status) {
    case "planned":
    case "applied":
    case "unchanged":
      return 0
    case "needs-decision":
      return 1
    case "conflict":
      return 3
    case "error":
      switch (envelope.error?.code) {
        case "E_DRIFT":
          return 4
        case "E_LOCKED":
        case "E_INTERRUPTED":
          return 5
        case "E_CANCELLED":
          return 130
        default:
          return 2
      }
  }
}
