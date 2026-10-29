import { findAddon, lookupAddon } from "../manifest/catalog.js"
import type { CatalogManifest, FileClass } from "../manifest/types.js"
import { resolveSelection } from "../resolve/resolve.js"
import { readConfig, readLock } from "../state/files.js"
import { lockPath, type ProductSettings } from "../state/settings.js"
import { selectionFromConfig, selectionFromLock } from "./desired.js"
import { PlanError } from "./errors.js"
import { render } from "./render.js"
import type { VirtualTree } from "./tree.js"

export type Explanation =
  | {
      kind: "path"
      path: string
      class: FileClass
      contributors: string[]
      keys?: { key: string; provenance?: "introduced" | "adopted"; contributors: string[] }[]
    }
  | {
      kind: "addon"
      id: string
      title: string
      version: string
      installed: boolean
      explicit: boolean
      by: string[]
      requires: string[]
      requiredBy: string[]
      slot?: string
      options: Record<string, unknown>
    }
  | { kind: "entry"; id: string; point: string; contributor: string; band: string; after: string[]; before: string[] }
  | { kind: "unknown"; subject: string; suggestions: string[] }

/** Who contributes a path, why an add-on is installed, or where an entry comes from. */
export function explain(input: {
  catalog: CatalogManifest
  tree: VirtualTree
  settings: ProductSettings
  subject: string
}): Explanation {
  const { catalog, tree, settings, subject } = input
  const configState = tree.read(settings.configFile)
  const lockState = tree.read(lockPath(settings))
  if (configState.kind !== "file") {
    throw new PlanError("E_NOT_INITIALIZED", "This folder isn't a project yet, so there's nothing to explain.")
  }
  const config = readConfig(settings.configFile, configState.content)
  const lock = lockState.kind === "file" ? readLock(lockPath(settings), lockState.content) : undefined
  const resolution = resolveSelection(catalog, lock ? selectionFromLock(lock) : selectionFromConfig(config))
  const rendered = resolution.ok ? render(catalog, resolution.value, settings) : undefined
  const recorded = lock?.files[subject]
  const file = rendered?.files.get(subject)
  const document = rendered?.documents.get(subject)
  const lines = rendered?.lines.get(subject)
  const env = rendered?.env.get(subject)
  if (recorded || file || document || lines || env) {
    const keyed = document?.desired.keys ?? lines ?? env
    const recordedKeys = recorded?.class === "shared" ? recorded.keys : {}
    const keys = keyed
      ? [...keyed].map(([key, desired]) => ({
          key,
          contributors: desired.contributors,
          ...(recordedKeys[key] ? { provenance: recordedKeys[key].provenance } : {})
        }))
      : undefined
    const contributors = file?.contributors ?? [...new Set(keys?.flatMap((key) => key.contributors) ?? [])].sort()
    return {
      kind: "path",
      path: subject,
      class: file?.ownership ?? recorded?.class ?? "shared",
      contributors,
      ...(keys ? { keys } : {})
    }
  }
  const entry = rendered?.entries.find((candidate) => `${candidate.contributor}/${candidate.id}` === subject)
  if (entry) {
    return {
      kind: "entry",
      id: subject,
      point: entry.point,
      contributor: entry.contributor,
      band: entry.order?.band ?? "framework",
      after: entry.order?.after ?? [],
      before: entry.order?.before ?? []
    }
  }
  const lookup = lookupAddon(catalog, subject)
  if ("id" in lookup) {
    const addon = findAddon(catalog, lookup.id)
    const resolved = resolution.ok
      ? resolution.value.addons.find((candidate) => candidate.manifest.id === lookup.id)
      : undefined
    const requiredBy = resolution.ok
      ? resolution.value.addons
          .filter((candidate) => candidate.manifest.requires?.includes(lookup.id))
          .map((candidate) => candidate.manifest.id)
      : []
    return {
      kind: "addon",
      id: lookup.id,
      title: addon?.title ?? lookup.id,
      version: addon?.version ?? "",
      installed: resolved !== undefined,
      explicit: resolved?.explicit ?? false,
      by: resolved?.by ?? [],
      requires: addon?.requires ?? [],
      requiredBy,
      ...(addon?.slot ? { slot: addon.slot } : {}),
      options: resolved?.options ?? {}
    }
  }
  return { kind: "unknown", subject, suggestions: lookup.suggestions }
}
