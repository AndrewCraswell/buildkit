import type { AddonManifest, Migration } from "../manifest/types.js"
import { PlanError } from "../plan/errors.js"
import type { ScratchTree } from "../plan/tree.js"
import type { MigrationNote } from "../plan/types.js"
import { compareVersions } from "./semver.js"

export interface PendingMigration {
  addon: AddonManifest
  migration: Migration
}

/** Migrations that run when an add-on moves from `from` to `to`: those with from < version <= to, oldest first. */
export function pendingMigrations(addon: AddonManifest, from: string, to: string): PendingMigration[] {
  if (compareVersions(from, to) >= 0) {
    return []
  }
  return (addon.migrations ?? [])
    .filter((migration) => compareVersions(migration.version, from) > 0 && compareVersions(migration.version, to) <= 0)
    .sort((left, right) => compareVersions(left.version, right.version))
    .map((migration) => ({ addon, migration }))
}

export function migrationId(pending: PendingMigration): string {
  return `${pending.addon.id}@${pending.migration.version}`
}

/**
 * Runs migrations: option rewrites change the recorded options, codemods and package bumps edit the scratch tree, and
 * agent tasks are only listed. Returns the rewritten options and a note for each migration.
 */
export function runMigrations(
  pending: PendingMigration[],
  options: Record<string, Record<string, unknown>>,
  tree: ScratchTree
): { options: Record<string, Record<string, unknown>>; notes: MigrationNote[] } {
  const next = { ...options }
  const notes: MigrationNote[] = []
  for (const item of pending) {
    const { addon, migration } = item
    const id = migrationId(item)
    try {
      if (migration.options && next[addon.id]) {
        next[addon.id] = migration.options(next[addon.id] ?? {})
      }
      if (migration.kind !== "agent") {
        migration.run?.(tree)
      }
    } catch (error) {
      throw new PlanError(
        "E_INTERNAL",
        `Migration ${id} failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
    notes.push({
      id,
      kind: migration.kind,
      description: migration.description,
      ...(migration.prompt === undefined ? {} : { prompt: migration.prompt })
    })
  }
  return { options: next, notes }
}
