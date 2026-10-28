import {
  findAddon,
  findMode,
  findTarget,
  findTemplate,
  lookupAddon,
  parseOptions,
  slotAddons,
  targetInfo
} from "../manifest/catalog.js"
import type {
  AddonManifest,
  CatalogManifest,
  TargetInfo,
  TargetManifest,
  TargetMode,
  TemplateManifest
} from "../manifest/types.js"
import { PlanError } from "../plan/errors.js"

/** The project's choices: what the config holds, and what the lock records as applied. */
export interface Selection {
  name: string
  template: string
  target: { id: string; mode: string }
  /** Explicitly chosen add-ons and their raw options. */
  addons: Record<string, Record<string, unknown>>
  declined: string[]
}

export interface ResolvedAddon {
  manifest: AddonManifest
  options: Record<string, unknown>
  explicit: boolean
  /** Add-ons that pulled this one in through `requires`. */
  by: string[]
}

export interface ResolvedSelection {
  name: string
  template: TemplateManifest
  target: TargetManifest
  mode: TargetMode
  info: TargetInfo
  /** In contribution order: each add-on after everything it requires or runs after. */
  addons: ResolvedAddon[]
  declined: string[]
}

/** Something only the user can answer. The planner turns each issue into a decision with complete requests. */
export type ResolveIssue =
  | { kind: "choose-mode"; template: string; modes: string[] }
  | { kind: "choose-slot"; slot: string; by?: string; candidates: string[] }
  | { kind: "choose-provider"; capability: string; by: string; candidates: string[] }
  | { kind: "slot-taken"; slot: string; installed: string; incoming: string }
  | { kind: "conflicts"; addon: string; other: string }

export type ResolveResult = { ok: true; value: ResolvedSelection } | { ok: false; issue: ResolveIssue }

const projectNamePattern = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/

/** npm-safe names only: no path separators, spaces, uppercase or leading dots. */
export function projectNameProblem(name: string): string | undefined {
  if (name.length === 0 || name.length > 214) {
    return "Use 1 to 214 characters."
  }
  if (!projectNamePattern.test(name)) {
    return "Use lowercase letters, digits, hyphens, dots and underscores, starting with a letter or digit."
  }
  if (name === "node_modules" || name === "favicon.ico") {
    return `"${name}" is reserved.`
  }
  return undefined
}

export function unknownAddonError(catalog: CatalogManifest, name: string): PlanError {
  const lookup = lookupAddon(catalog, name)
  const suggestions = "suggestions" in lookup ? lookup.suggestions : []
  const ambiguous = "ambiguous" in lookup && lookup.ambiguous
  const hint = suggestions.length > 0 ? ` ${ambiguous ? "It could be" : "Did you mean"} ${suggestions.join(", ")}?` : ""
  return new PlanError(
    "E_UNKNOWN_ADDON",
    `${ambiguous ? `"${name}" matches more than one add-on.` : `There's no add-on named "${name}".`}${hint}`,
    {
      next: suggestions
    }
  )
}

/** Resolves a name to an add-on id, or throws `E_UNKNOWN_ADDON` with suggestions. */
export function requireAddonId(catalog: CatalogManifest, name: string): string {
  const lookup = lookupAddon(catalog, name)
  if ("id" in lookup) {
    return lookup.id
  }
  throw unknownAddonError(catalog, name)
}

export function resolveTarget(catalog: CatalogManifest, selection: Pick<Selection, "template" | "target">) {
  const template = findTemplate(catalog, selection.template)
  if (!template) {
    throw new PlanError("E_UNKNOWN_TEMPLATE", `There's no template named "${selection.template}".`, {
      next: catalog.templates.map((candidate) => candidate.id)
    })
  }
  const target = findTarget(catalog, selection.target.id)
  if (!target) {
    throw new PlanError("E_UNKNOWN_TARGET", `There's no target named "${selection.target.id}".`)
  }
  const mode = findMode(target, selection.target.mode)
  if (!mode) {
    throw new PlanError(
      "E_UNKNOWN_TARGET",
      `${target.title} has no mode "${selection.target.mode}". Use ${target.modes.map((candidate) => candidate.id).join(" or ")}.`
    )
  }
  return { template, target, mode, info: targetInfo(catalog, target, mode) }
}

/** Calls `supports()` with the add-on's default options. Used to filter the choices a question offers. */
export function addonSupports(
  addon: AddonManifest,
  info: TargetInfo,
  options?: Record<string, unknown>
): true | string {
  if (!addon.supports) {
    return true
  }
  const parsed = parseOptions(addon, options)
  if (!parsed.ok) {
    return true
  }
  return addon.supports({ options: parsed.value, target: info, provided: () => undefined, selected: () => false })
}

/** Resolves a selection: pulls in `requires`, checks slots and conflicts, orders add-ons, validates options and support. */
export function resolveSelection(catalog: CatalogManifest, selection: Selection): ResolveResult {
  const nameProblem = projectNameProblem(selection.name)
  if (nameProblem) {
    throw new PlanError("E_INVALID_OPTIONS", `"${selection.name}" can't be a project name. ${nameProblem}`)
  }
  const { template, target, mode, info } = resolveTarget(catalog, selection)
  const chosen = new Map<string, { explicit: boolean; by: Set<string> }>()
  const visit = (id: string, by: string | undefined) => {
    const addon = findAddon(catalog, id)
    if (!addon) {
      throw unknownAddonError(catalog, id)
    }
    const existing = chosen.get(id)
    if (existing) {
      if (by) {
        existing.by.add(by)
      } else {
        existing.explicit = true
      }
      return
    }
    chosen.set(id, { explicit: by === undefined, by: new Set(by ? [by] : []) })
    for (const requirement of addon.requires ?? []) {
      if (!requirement.startsWith("slot:") && !requirement.startsWith("provides:")) {
        visit(requirement, id)
      }
    }
  }
  for (const id of Object.keys(selection.addons).sort()) {
    visit(id, undefined)
  }
  const selected = [...chosen.keys()].map((id) => findAddon(catalog, id)).filter((addon) => addon !== undefined)
  for (const addon of selected) {
    for (const requirement of addon.requires ?? []) {
      if (requirement.startsWith("slot:")) {
        const slot = requirement.slice(5)
        if (!selected.some((other) => other.slot === slot)) {
          const candidates = slotAddons(catalog, slot)
            .filter((candidate) => addonSupports(candidate, info) === true)
            .map((candidate) => candidate.id)
          return { ok: false, issue: { kind: "choose-slot", slot, by: addon.id, candidates } }
        }
      }
      if (requirement.startsWith("provides:")) {
        const capability = requirement.slice(9)
        if (!selected.some((other) => other.provides && Object.hasOwn(other.provides, capability))) {
          const candidates = catalog.addons
            .filter((candidate) => candidate.provides && Object.hasOwn(candidate.provides, capability))
            .filter((candidate) => addonSupports(candidate, info) === true)
            .map((candidate) => candidate.id)
          return { ok: false, issue: { kind: "choose-provider", capability, by: addon.id, candidates } }
        }
      }
    }
  }
  const bySlot = new Map<string, string>()
  for (const addon of selected) {
    if (addon.slot) {
      const other = bySlot.get(addon.slot)
      if (other) {
        return { ok: false, issue: { kind: "slot-taken", slot: addon.slot, installed: other, incoming: addon.id } }
      }
      bySlot.set(addon.slot, addon.id)
    }
  }
  for (const addon of selected) {
    for (const other of selected) {
      if (addon.conflicts?.includes(other.id)) {
        return { ok: false, issue: { kind: "conflicts", addon: addon.id, other: other.id } }
      }
    }
  }
  const ordered = orderAddons(selected)
  const provided = (name: string): unknown =>
    ordered.find((addon) => addon.provides && Object.hasOwn(addon.provides, name))?.provides?.[name]
  const isSelected = (id: string) => chosen.has(id)
  const addons: ResolvedAddon[] = []
  for (const addon of ordered) {
    const parsed = parseOptions(addon, selection.addons[addon.id])
    if (!parsed.ok) {
      throw new PlanError("E_INVALID_OPTIONS", `${addon.title} has invalid options: ${parsed.issues.join("; ")}.`)
    }
    const support = addon.supports?.({ options: parsed.value, target: info, provided, selected: isSelected }) ?? true
    if (support !== true) {
      throw new PlanError("E_UNSUPPORTED", `${addon.title} doesn't support ${target.title} (${mode.title}): ${support}`)
    }
    const state = chosen.get(addon.id)
    addons.push({
      manifest: addon,
      options: parsed.value,
      explicit: state?.explicit ?? false,
      by: [...(state?.by ?? [])].sort()
    })
  }
  return {
    ok: true,
    value: { name: selection.name, template, target, mode, info, addons, declined: [...selection.declined].sort() }
  }
}

/** Orders add-ons so each comes after what it requires or runs after. Ties sort by id; a cycle is an error. */
function orderAddons(addons: AddonManifest[]): AddonManifest[] {
  const ids = new Set(addons.map((addon) => addon.id))
  const edges = new Map<string, Set<string>>()
  for (const addon of addons) {
    const before = new Set<string>()
    for (const requirement of addon.requires ?? []) {
      if (requirement.startsWith("slot:")) {
        const slot = requirement.slice(5)
        addons.filter((other) => other.slot === slot).forEach((other) => before.add(other.id))
      } else if (requirement.startsWith("provides:")) {
        const capability = requirement.slice(9)
        addons
          .filter((other) => other.provides && Object.hasOwn(other.provides, capability))
          .forEach((other) => before.add(other.id))
      } else {
        before.add(requirement)
      }
    }
    for (const after of addon.after ?? []) {
      if (ids.has(after)) {
        before.add(after)
      }
    }
    before.delete(addon.id)
    edges.set(addon.id, before)
  }
  const result: AddonManifest[] = []
  const done = new Set<string>()
  const pending = addons.map((addon) => addon.id).sort()
  while (pending.length > 0) {
    const index = pending.findIndex((id) => [...(edges.get(id) ?? [])].every((dependency) => done.has(dependency)))
    const next = index === -1 ? undefined : pending[index]
    if (next === undefined) {
      throw new PlanError("E_CYCLE", `These add-ons require each other in a cycle: ${pending.join(", ")}.`)
    }
    pending.splice(index, 1)
    done.add(next)
    const addon = addons.find((candidate) => candidate.id === next)
    if (addon) {
      result.push(addon)
    }
  }
  return result
}
