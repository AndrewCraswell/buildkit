import { findAddon, findSlot, findTarget, findTemplate, lookupAddon } from "../manifest/catalog.js"
import type { CatalogManifest } from "../manifest/types.js"
import type { ResolveIssue } from "../resolve/resolve.js"
import type { DecisionChoice, Intent, PlanDecision, PlanRequest } from "./types.js"

function title(catalog: CatalogManifest, id: string): string {
  return findAddon(catalog, id)?.title ?? id
}

function withIntent(request: PlanRequest, intent: Intent): PlanRequest {
  return { ...request, intent }
}

/** True when a name in a request is the add-on itself, by id or short name, or the slot it fills. */
function refersTo(catalog: CatalogManifest, name: string, id: string): boolean {
  const lookup = lookupAddon(catalog, name)
  if ("id" in lookup) {
    return lookup.id === id
  }
  const slot = findSlot(catalog, name)
  return slot !== undefined && findAddon(catalog, id)?.slot === slot.id
}

/** Adds an add-on to whatever the request asks for, so the choice resolves without asking again. */
function addingTo(catalog: CatalogManifest, request: PlanRequest, id: string, replace?: string): PlanRequest {
  const { intent } = request
  if (intent.command === "init") {
    const slot = findAddon(catalog, id)?.slot
    const answered =
      slot !== undefined &&
      (findTemplate(catalog, intent.answers.template)?.slots?.[slot] !== undefined ||
        intent.answers.slots?.[slot] !== undefined)
    const optional = (intent.answers.optional ?? []).filter((entry) => entry !== replace && entry !== id)
    return withIntent(request, {
      command: "init",
      answers:
        answered && slot !== undefined
          ? { ...intent.answers, optional, slots: { ...intent.answers.slots, [slot]: id } }
          : { ...intent.answers, optional: [...optional, id] }
    })
  }
  if (intent.command === "add") {
    return withIntent(request, {
      ...intent,
      addons: [...intent.addons.filter((name) => !refersTo(catalog, name, id)), id],
      replace: replace === undefined ? intent.replace : [...new Set([...intent.replace, replace])]
    })
  }
  return withIntent(request, {
    command: "add",
    addons: [id],
    replace: replace === undefined ? [] : [replace],
    options: {}
  })
}

/** Turns a resolver issue into a decision whose every choice is a complete request. */
export function issueDecision(catalog: CatalogManifest, request: PlanRequest, issue: ResolveIssue): PlanDecision {
  const { intent } = request
  switch (issue.kind) {
    case "choose-mode": {
      const template = findTemplate(catalog, issue.template)
      const target = template ? findTarget(catalog, template.target) : undefined
      const choices: DecisionChoice[] =
        intent.command === "init"
          ? issue.modes.map((mode) => ({
              id: mode,
              label: target?.modes.find((candidate) => candidate.id === mode)?.title ?? mode,
              request: withIntent(request, { command: "init", answers: { ...intent.answers, mode } })
            }))
          : []
      return { id: "mode", message: `Which mode should ${template?.title ?? issue.template} use?`, choices }
    }
    case "choose-slot": {
      const slot = findSlot(catalog, issue.slot)
      const lead = issue.by ? `${title(catalog, issue.by)} needs a ${slot?.title.toLowerCase() ?? issue.slot}. ` : ""
      return {
        id: `slot:${issue.slot}`,
        message: `${lead}${slot?.choose ?? `Choose a ${issue.slot}.`}`,
        choices: issue.candidates.map((id) => ({
          id,
          label: title(catalog, id),
          request: addingTo(catalog, request, id)
        }))
      }
    }
    case "choose-provider":
      return {
        id: `provides:${issue.capability}`,
        message: `${title(catalog, issue.by)} needs an add-on that provides ${issue.capability}. Which one?`,
        choices: issue.candidates.map((id) => ({
          id,
          label: title(catalog, id),
          request: addingTo(catalog, request, id)
        }))
      }
    case "slot-taken": {
      const slot = findSlot(catalog, issue.slot)
      return {
        id: `slot:${issue.slot}`,
        message: `${title(catalog, issue.installed)} is already the ${slot?.title.toLowerCase() ?? issue.slot}. Replace it with ${title(catalog, issue.incoming)}?`,
        choices: [
          {
            id: "replace",
            label: `Replace ${title(catalog, issue.installed)}`,
            request: addingTo(catalog, request, issue.incoming, issue.installed)
          }
        ]
      }
    }
    case "conflicts":
      return {
        id: `conflicts:${issue.addon}`,
        message: `${title(catalog, issue.addon)} can't be used with ${title(catalog, issue.other)}. Remove one of them from the config.`,
        choices: []
      }
  }
}
