import type { Answers, FileClass } from "../manifest/types.js"
import type { Lock } from "../state/schemas.js"

/** What the user asked for. Plans are reproducible from it, and every decision choice carries a complete one. */
export type Intent =
  | { command: "init"; answers: Answers }
  | {
      command: "add"
      /** Add-on ids to add. */
      addons: string[]
      /** Installed add-on ids to remove, replacing them within their slot. */
      replace: string[]
      options: Record<string, Record<string, unknown>>
    }
  | { command: "config"; options: Record<string, Record<string, unknown>> }
  | { command: "upgrade" }
  | { command: "sync" }

export type Resolution = "keep-current" | "take-incoming" | { content: string }

export interface PlanRequest {
  intent: Intent
  /** Answers to conflicts, keyed by conflict id. */
  resolve?: Record<string, Resolution>
  /** Write conflict markers into text seeds instead of stopping. */
  conflictStyle?: "stop" | "markers"
  /** Plan against this recorded catalog version instead of the installed one. */
  catalogVersion?: string
}

export type ConflictKind =
  | "exists"
  | "edited"
  | "deleted"
  | "both-changed"
  | "orphan-edited"
  | "invalid"
  | "moved"
  | "class-change"
  | "secret-pattern"
  | "merge"
  | "baseline-unverified"
  | "type"

export interface PlanConflict {
  id: string
  path: string
  kind: ConflictKind
  message: string
  pointer?: string
  base?: string
  current?: string
  incoming?: string
  resolutions: ("keep-current" | "take-incoming" | "file")[]
}

export interface DecisionChoice {
  id: string
  label: string
  request: PlanRequest
}

export interface PlanDecision {
  id: string
  message: string
  choices: DecisionChoice[]
}

export type OperationClass = FileClass | "config" | "lock"

export interface Operation {
  path: string
  action: "create" | "update" | "delete"
  class: OperationClass
  /** Hash of the normalized file before the change, or `undefined` when it doesn't exist. */
  beforeHash?: string
  /** Exact bytes to write. Absent for deletes. */
  content?: string
  linesAdded: number
  linesRemoved: number
  /** Show hashes only: the file may hold secrets. */
  secret?: boolean
  /** Previous content, kept for patches. Never serialized into plan artifacts for secret files. */
  before?: string
}

export interface Notice {
  code: string
  text: string
  /** The file the notice is about, when there is one. */
  path?: string
}

export interface EnvVar {
  name: string
  scope: "server" | "client" | "build"
  secret: boolean
  required: boolean
  description: string
  example?: string
}

export interface PackageChange {
  name: string
  section: string
  from?: string
  to?: string
}

export interface CommandHint {
  run: string
  when: "after-apply" | "after-install"
  why: string
}

export interface MigrationNote {
  id: string
  kind: "codemod" | "packages" | "options" | "agent"
  description: string
  prompt?: string
}

export interface PulledAddon {
  id: string
  by: string[]
}

export type ErrorCode =
  | "E_DRIFT"
  | "E_LOCKED"
  | "E_INTERRUPTED"
  | "E_BASELINE_UNAVAILABLE"
  | "E_UNSUPPORTED"
  | "E_INVALID_OPTIONS"
  | "E_UNKNOWN_ADDON"
  | "E_UNKNOWN_TEMPLATE"
  | "E_UNKNOWN_TARGET"
  | "E_CATALOG_MISMATCH"
  | "E_CONTRIBUTION"
  | "E_UNSAFE_PATH"
  | "E_UNSAFE_KEY"
  | "E_LOCK_VERSION"
  | "E_INVALID_STATE"
  | "E_NOT_INITIALIZED"
  | "E_ALREADY_INITIALIZED"
  | "E_DESTINATION"
  | "E_CONFLICT_MARKERS"
  | "E_CYCLE"
  | "E_USAGE"
  | "E_CANCELLED"
  | "E_INTERNAL"

export interface PlanErrorInfo {
  code: ErrorCode
  message: string
  paths?: string[]
  retryable: boolean
  next?: string[]
}

export type PlanStatus = "planned" | "unchanged" | "needs-decision" | "conflict" | "error"

export interface UpgradeSummary {
  catalog: { from: string; to: string }
  addons: { id: string; from?: string; to?: string }[]
}

export interface Plan {
  status: PlanStatus
  request: PlanRequest
  fingerprint: string
  catalog: { id: string; version: string }
  baseline?: { source: "installed" | "cache" | "two-way"; catalogVersion: string }
  operations: Operation[]
  decisions: PlanDecision[]
  conflicts: PlanConflict[]
  pulled: PulledAddon[]
  required: string[]
  packages: PackageChange[]
  env: EnvVar[]
  commands: CommandHint[]
  migrations: MigrationNote[]
  notices: Notice[]
  nextSteps: string[]
  merged: { path: string; hunks: number }[]
  upgrade?: UpgradeSummary
  error?: PlanErrorInfo
  /** The lock after applying. Written last. */
  lock?: Lock
}
