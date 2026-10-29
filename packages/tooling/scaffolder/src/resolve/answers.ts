import {
  findAddon,
  findMode,
  findSlot,
  findTarget,
  findTemplate,
  slotAddons,
  targetInfo,
  templateModes
} from "../manifest/catalog.js"
import type { Answers, CatalogManifest, SlotPolicy } from "../manifest/types.js"
import { PlanError } from "../plan/errors.js"
import { addonSupports, requireAddonId, type ResolveIssue, type Selection } from "./resolve.js"

export type AnswersResult = { ok: true; selection: Selection } | { ok: false; issue: ResolveIssue }

/**
 * Turns a template's answers into a selection. Required add-ons are always included. An unanswered question takes its
 * default; only a question with no default and more than one choice comes back as an issue.
 */
export function selectionFromAnswers(catalog: CatalogManifest, answers: Answers, name: string): AnswersResult {
  const template = findTemplate(catalog, answers.template)
  if (!template) {
    throw new PlanError("E_UNKNOWN_TEMPLATE", `There's no template named "${answers.template}".`, {
      next: catalog.templates.map((candidate) => candidate.id)
    })
  }
  const target = findTarget(catalog, template.target)
  if (!target) {
    throw new PlanError(
      "E_UNKNOWN_TARGET",
      `Template ${template.id} uses target "${template.target}", which isn't in the catalog.`
    )
  }
  const modes = templateModes(catalog, template)
  if (answers.mode !== undefined && !modes.includes(answers.mode)) {
    throw new PlanError("E_USAGE", `${template.title} has no mode "${answers.mode}". Use ${modes.join(" or ")}.`)
  }
  const modeId = answers.mode ?? (modes.length === 1 ? modes[0] : undefined)
  if (modeId === undefined) {
    return { ok: false, issue: { kind: "choose-mode", template: template.id, modes } }
  }
  const mode = findMode(target, modeId)
  if (!mode) {
    throw new PlanError("E_UNKNOWN_TARGET", `${target.title} has no mode "${modeId}".`)
  }
  const info = targetInfo(catalog, target, mode)
  const addons: Record<string, Record<string, unknown>> = {}
  const declined: string[] = []
  for (const id of template.required ?? []) {
    addons[id] = {}
  }
  const slotPolicies: [string, SlotPolicy][] = Object.entries(template.slots ?? {})
  for (const slot of Object.keys(answers.slots ?? {})) {
    if (!template.slots?.[slot]) {
      if (!findSlot(catalog, slot)) {
        throw new PlanError("E_USAGE", `There's no question named "${slot}".`)
      }
      slotPolicies.push([slot, { required: false }])
    }
  }
  for (const [slot, policy] of slotPolicies) {
    const answer = answers.slots?.[slot]
    if (answer === null) {
      if (policy.required) {
        throw new PlanError(
          "E_USAGE",
          `${template.title} needs a ${findSlot(catalog, slot)?.title.toLowerCase() ?? slot}, so "no" isn't an answer.`
        )
      }
      declined.push(`slot:${slot}`)
      continue
    }
    if (answer !== undefined) {
      const id = requireAddonId(catalog, answer)
      if (findAddon(catalog, id)?.slot !== slot) {
        throw new PlanError(
          "E_USAGE",
          `${id} isn't a choice for ${slot}. Choose ${slotAddons(catalog, slot)
            .map((addon) => addon.id)
            .join(", ")}.`
        )
      }
      addons[id] = {}
      continue
    }
    if (policy.default !== undefined) {
      addons[policy.default] = {}
      continue
    }
    if (!policy.required) {
      declined.push(`slot:${slot}`)
      continue
    }
    const candidates = slotAddons(catalog, slot)
      .filter((addon) => addonSupports(addon, info) === true)
      .map((addon) => addon.id)
    const [only] = candidates
    if (only !== undefined && candidates.length === 1) {
      addons[only] = {}
      continue
    }
    if (candidates.length === 0) {
      throw new PlanError("E_UNSUPPORTED", `No ${slot} add-on supports ${target.title} (${mode.title}).`)
    }
    return { ok: false, issue: { kind: "choose-slot", slot, candidates } }
  }
  const optional = Object.entries(template.optional ?? {})
  const chosen = answers.optional?.map((entry) => requireAddonId(catalog, entry))
  for (const [id, { default: preselected }] of optional) {
    if (chosen ? chosen.includes(id) : preselected) {
      addons[id] = {}
    } else {
      declined.push(id)
    }
  }
  for (const id of chosen ?? []) {
    addons[id] = {}
  }
  for (const [key, options] of Object.entries(answers.options ?? {})) {
    const id = requireAddonId(catalog, key)
    if (!addons[id]) {
      throw new PlanError("E_USAGE", `Options were given for ${id}, but it isn't selected.`)
    }
    addons[id] = { ...addons[id], ...options }
  }
  return {
    ok: true,
    selection: {
      name,
      template: template.id,
      target: { id: target.id, mode: mode.id },
      addons,
      declined: [...new Set(declined)].sort()
    }
  }
}
