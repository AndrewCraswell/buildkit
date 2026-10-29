import { isRecord } from "../plan/json.js"
import type {
  AddonManifest,
  CatalogManifest,
  PackRecord,
  PresetManifest,
  SlotDefinition,
  TargetInfo,
  TargetManifest,
  TargetMode,
  TemplateManifest
} from "./types.js"

export function findAddon(catalog: CatalogManifest, id: string): AddonManifest | undefined {
  return catalog.addons.find((addon) => addon.id === id)
}

export function findTarget(catalog: CatalogManifest, id: string): TargetManifest | undefined {
  return catalog.targets.find((target) => target.id === id)
}

export function findTemplate(catalog: CatalogManifest, id: string): TemplateManifest | undefined {
  return catalog.templates.find((template) => template.id === id)
}

export function findSlot(catalog: CatalogManifest, id: string): SlotDefinition | undefined {
  return catalog.slots.find((slot) => slot.id === id)
}

export function findPreset(catalog: CatalogManifest, id: string): PresetManifest | undefined {
  return (catalog.presets ?? []).find((preset) => preset.id === id)
}

export function slotAddons(catalog: CatalogManifest, slot: string): AddonManifest[] {
  return catalog.addons.filter((addon) => addon.slot === slot)
}

export function findMode(target: TargetManifest, mode: string): TargetMode | undefined {
  return target.modes.find((candidate) => candidate.id === mode)
}

/** The modes a template offers: its own list, or every mode of its target. */
export function templateModes(catalog: CatalogManifest, template: TemplateManifest): string[] {
  const target = findTarget(catalog, template.target)
  return template.modes ?? target?.modes.map((mode) => mode.id) ?? []
}

export function targetInfo(catalog: CatalogManifest, target: TargetManifest, mode: TargetMode): TargetInfo {
  const facets = new Set(mode.facets)
  return {
    id: target.id,
    family: target.family,
    mode: mode.id,
    renderModel: mode.renderModel,
    has(facet) {
      if (!catalog.facets.includes(facet)) {
        throw new Error(`Facet "${facet}" isn't registered in catalog ${catalog.id}.`)
      }
      return facets.has(facet)
    }
  }
}

/** The part of an add-on id after its scope: `@buildkit/db-d1` is `db-d1`. */
export function shortName(id: string): string {
  const slash = id.lastIndexOf("/")
  return slash === -1 ? id : id.slice(slash + 1)
}

export type NameLookup = { id: string } | { suggestions: string[]; ambiguous: boolean }

/** Resolves an add-on id or its short name. An unknown or ambiguous name comes back with suggestions. */
export function lookupAddon(catalog: CatalogManifest, name: string): NameLookup {
  if (findAddon(catalog, name)) {
    return { id: name }
  }
  const matches = catalog.addons.filter((addon) => shortName(addon.id) === name)
  const [only] = matches
  if (only && matches.length === 1) {
    return { id: only.id }
  }
  if (matches.length > 1) {
    return { suggestions: matches.map((addon) => addon.id).sort(), ambiguous: true }
  }
  const wanted = shortName(name)
  const suggestions = catalog.addons
    .map((addon) => addon.id)
    .filter((id) => {
      const short = shortName(id)
      return short.includes(wanted) || wanted.includes(short) || editDistance(short, wanted) <= 2
    })
    .sort()
  return { suggestions, ambiguous: false }
}

export type OptionsResult = { ok: true; value: Record<string, unknown> } | { ok: false; issues: string[] }

/** Validates raw options against the add-on's schema, filling defaults. */
export function parseOptions(addon: AddonManifest, raw: Record<string, unknown> | undefined): OptionsResult {
  const input = raw ?? {}
  if (!addon.options) {
    const keys = Object.keys(input)
    return keys.length === 0
      ? { ok: true, value: {} }
      : { ok: false, issues: keys.map((key) => `${key}: unknown option`) }
  }
  const result = addon.options.safeParse(input)
  if (!result.success) {
    return {
      ok: false,
      issues: result.error.issues.map((issue) => `${issue.path.map(String).join(".") || "(options)"}: ${issue.message}`)
    }
  }
  const value: unknown = result.data
  return isRecord(value) ? { ok: true, value } : { ok: false, issues: ["(options): options must be an object"] }
}

function editDistance(left: string, right: string): number {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let row = 1; row <= left.length; row++) {
    const current = [row]
    for (let column = 1; column <= right.length; column++) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1
      current.push(
        Math.min((previous[column] ?? 0) + 1, (current[column - 1] ?? 0) + 1, (previous[column - 1] ?? 0) + cost)
      )
    }
    previous = current
  }
  return previous[right.length] ?? 0
}

/** The template package a catalog template comes from: `<package>#<id>`. Built-in templates have none. */
export function packOf(templateId: string): string | undefined {
  const hash = templateId.indexOf("#")
  return hash === -1 ? undefined : templateId.slice(0, hash)
}

/** Whether two catalogs, or a catalog and a lock, record the same catalog version and the same pack versions. */
export function sameCatalogVersion(
  left: { version: string; packs?: Record<string, PackRecord> | undefined },
  right: { version: string; packs?: Record<string, PackRecord> | undefined }
): boolean {
  const versions = (packs: Record<string, PackRecord> | undefined) =>
    Object.entries(packs ?? {})
      .map(([name, pack]) => `${name}@${pack.version}`)
      .sort()
      .join(" ")
  return left.version === right.version && versions(left.packs) === versions(right.packs)
}

/** `1.0.0`, or `1.0.0 with @acme/tower-defense@1.2.0` when packs are merged in. */
export function catalogVersionText(catalog: {
  version: string
  packs?: Record<string, PackRecord> | undefined
}): string {
  const packs = Object.entries(catalog.packs ?? {}).map(([name, pack]) => `${name}@${pack.version}`)
  return packs.length === 0 ? catalog.version : `${catalog.version} with ${packs.sort().join(", ")}`
}
