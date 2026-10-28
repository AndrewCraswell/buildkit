import { findAddon, findSlot, findTarget, findTemplate, lookupAddon, slotAddons } from "../manifest/catalog.js"
import type { CatalogManifest } from "../manifest/types.js"
import { selectionFromAnswers } from "../resolve/answers.js"
import { addonSupports, requireAddonId, resolveTarget, type ResolveIssue, type Selection } from "../resolve/resolve.js"
import type { Lock, ProjectConfig } from "../state/schemas.js"
import { PlanError } from "./errors.js"
import type { Intent } from "./types.js"

export type DesiredResult =
  | { ok: true; selection: Selection; required: string[]; adopt: boolean; unchanged: string[] }
  | { ok: false; issue: ResolveIssue }

export function selectionFromConfig(config: ProjectConfig): Selection {
  return {
    name: config.name,
    template: config.template,
    target: { id: config.target.id, mode: config.target.mode },
    addons: structuredClone(config.addons),
    declined: [...(config.declined ?? [])]
  }
}

export function selectionFromLock(lock: Lock): Selection {
  const addons: Record<string, Record<string, unknown>> = {}
  for (const [id, state] of Object.entries(lock.addons)) {
    if (state.explicit) {
      addons[id] = structuredClone(state.options)
    }
  }
  return {
    name: lock.project.name,
    template: lock.project.template,
    target: { ...lock.project.target },
    addons,
    declined: [...lock.project.declined]
  }
}

function requireConfig(config: ProjectConfig | undefined, command: string): ProjectConfig {
  if (!config) {
    throw new PlanError(
      "E_NOT_INITIALIZED",
      `This folder isn't a project yet, so ${command} has nothing to change. Run init first.`
    )
  }
  return config
}

/** The selection a command asks for, built from the current config. */
export function desiredSelection(
  catalog: CatalogManifest,
  intent: Intent,
  config: ProjectConfig | undefined,
  lock: Lock | undefined
): DesiredResult {
  switch (intent.command) {
    case "init": {
      if (config) {
        throw new PlanError(
          "E_ALREADY_INITIALIZED",
          "This folder is already a project. Use add, config or upgrade to change it."
        )
      }
      const name = intent.answers.name
      if (name === undefined) {
        throw new PlanError("E_USAGE", "init needs a project name.")
      }
      const result = selectionFromAnswers(catalog, intent.answers, name)
      if (!result.ok) {
        return result
      }
      const required = findTemplate(catalog, intent.answers.template)?.required ?? []
      return { ok: true, selection: result.selection, required, adopt: intent.answers.adopt === true, unchanged: [] }
    }
    case "add":
      return addSelection(catalog, intent, requireConfig(config, "add"), lock)
    case "config": {
      const current = requireConfig(config, "config")
      const selection = selectionFromConfig(current)
      for (const [name, options] of Object.entries(intent.options)) {
        const id = requireAddonId(catalog, name)
        const installed = Object.hasOwn(selection.addons, id) || lock?.addons[id] !== undefined
        if (!installed) {
          throw new PlanError("E_USAGE", `${id} isn't installed, so its options can't be set. Add it first.`)
        }
        selection.addons[id] = { ...selection.addons[id], ...options }
      }
      return { ok: true, selection, required: [], adopt: false, unchanged: [] }
    }
    case "upgrade":
    case "sync":
      return {
        ok: true,
        selection: selectionFromConfig(requireConfig(config, intent.command)),
        required: [],
        adopt: false,
        unchanged: []
      }
  }
}

function addSelection(
  catalog: CatalogManifest,
  intent: Extract<Intent, { command: "add" }>,
  config: ProjectConfig,
  lock: Lock | undefined
): DesiredResult {
  const selection = selectionFromConfig(config)
  const { info } = resolveTarget(catalog, selection)
  const installed = (id: string) => Object.hasOwn(selection.addons, id) || lock?.addons[id] !== undefined
  const replaced: string[] = []
  for (const name of intent.replace) {
    if (findTarget(catalog, name) || name === config.target.id) {
      throw new PlanError("E_USAGE", "The target can't be replaced. Start a new project with init instead.")
    }
    const id = requireAddonId(catalog, name)
    if (!Object.hasOwn(selection.addons, id)) {
      throw new PlanError("E_USAGE", `${id} isn't installed, so it can't be replaced.`)
    }
    replaced.push(id)
  }
  const adding: string[] = []
  const unchanged: string[] = []
  for (const name of intent.addons) {
    const slot = "id" in lookupAddon(catalog, name) ? undefined : findSlot(catalog, name)
    if (slot) {
      const occupant = slotAddons(catalog, slot.id).find((addon) => installed(addon.id) && !replaced.includes(addon.id))
      if (occupant) {
        unchanged.push(occupant.id)
        continue
      }
      const candidates = slotAddons(catalog, slot.id)
        .filter((addon) => addonSupports(addon, info) === true)
        .map((addon) => addon.id)
      const [only] = candidates
      if (only === undefined || candidates.length > 1) {
        return { ok: false, issue: { kind: "choose-slot", slot: slot.id, candidates } }
      }
      adding.push(only)
      continue
    }
    adding.push(requireAddonId(catalog, name))
  }
  for (const id of replaced) {
    const slot = findAddon(catalog, id)?.slot
    if (!slot || !adding.some((other) => findAddon(catalog, other)?.slot === slot)) {
      throw new PlanError(
        "E_USAGE",
        `--replace works within a slot, and nothing you're adding shares a slot with ${id}.`
      )
    }
    delete selection.addons[id]
  }
  for (const id of adding) {
    const addon = findAddon(catalog, id)
    if (Object.hasOwn(selection.addons, id) && !intent.options[id]) {
      unchanged.push(id)
      continue
    }
    if (addon?.slot) {
      const occupant = Object.keys(selection.addons).find(
        (other) => other !== id && findAddon(catalog, other)?.slot === addon.slot
      )
      if (occupant) {
        return { ok: false, issue: { kind: "slot-taken", slot: addon.slot, installed: occupant, incoming: id } }
      }
    }
    selection.addons[id] = { ...selection.addons[id], ...intent.options[id] }
    selection.declined = selection.declined.filter((entry) => entry !== id && entry !== `slot:${addon?.slot ?? ""}`)
  }
  for (const [id, options] of Object.entries(intent.options)) {
    if (!adding.includes(id)) {
      if (!Object.hasOwn(selection.addons, id)) {
        throw new PlanError("E_USAGE", `Options were given for ${id}, but it isn't being added.`)
      }
      selection.addons[id] = { ...selection.addons[id], ...options }
    }
  }
  return { ok: true, selection, required: [], adopt: false, unchanged }
}
