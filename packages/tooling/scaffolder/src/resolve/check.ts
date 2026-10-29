import {
  findAddon,
  findMode,
  findSlot,
  findTarget,
  findTemplate,
  packOf,
  parseOptions,
  slotAddons,
  targetInfo,
  templateModes
} from "../manifest/catalog.js"
import type { Answers, CatalogManifest } from "../manifest/types.js"
import { PlanError } from "../plan/errors.js"
import { isRecord } from "../plan/json.js"
import { render } from "../plan/render.js"
import { defineSettings } from "../state/settings.js"
import { compareVersions, isValidVersion } from "../upgrade/semver.js"
import { selectionFromAnswers } from "./answers.js"
import { optionsSchema } from "./questions.js"
import { addonSupports, resolveSelection } from "./resolve.js"

function duplicates(ids: readonly string[]): string[] {
  const seen = new Set<string>()
  const repeated = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) {
      repeated.add(id)
    }
    seen.add(id)
  }
  return [...repeated]
}

/**
 * Catalog CI: checks references, slot defaults, required add-on options and facets. With `matrix`, it also plans
 * every pair of answers for each template and mode, or for the `templates` listed, and reports any that fail.
 */
export function checkCatalog(
  catalog: CatalogManifest,
  options: { matrix?: boolean; templates?: readonly string[] } = {}
): string[] {
  const problems: string[] = []
  if (!isValidVersion(catalog.version)) {
    problems.push(`Catalog version "${catalog.version}" isn't a semantic version.`)
  }
  for (const [kind, ids] of [
    ["add-on", catalog.addons.map((addon) => addon.id)],
    ["target", catalog.targets.map((target) => target.id)],
    ["template", catalog.templates.map((template) => template.id)],
    ["slot", catalog.slots.map((slot) => slot.id)],
    ["preset", (catalog.presets ?? []).map((preset) => preset.id)]
  ] as const) {
    for (const id of duplicates(ids)) {
      problems.push(`More than one ${kind} has the id ${id}.`)
    }
  }
  // A template argument that looks like a package is fetched from npm, so built-in ids can't look like one.
  for (const template of catalog.templates) {
    const pack = packOf(template.id)
    const own = pack === undefined ? template.id : template.id.slice(pack.length + 1)
    if ((pack !== undefined && !catalog.packs?.[pack]) || /[/#:]/.test(own) || own.startsWith("@")) {
      problems.push(`Template id ${template.id} can't contain /, # or :, or start with @.`)
    }
  }
  for (const target of catalog.targets) {
    if (target.modes.length === 0) {
      problems.push(`Target ${target.id} has no modes.`)
    }
    for (const mode of target.modes) {
      for (const facet of mode.facets) {
        if (!catalog.facets.includes(facet)) {
          problems.push(`Target ${target.id} mode ${mode.id} uses facet ${facet}, which isn't registered.`)
        }
      }
    }
  }
  const provides = new Set(catalog.addons.flatMap((addon) => Object.keys(addon.provides ?? {})))
  for (const addon of catalog.addons) {
    if (!isValidVersion(addon.version)) {
      problems.push(`${addon.id} version "${addon.version}" isn't a semantic version.`)
    }
    if (addon.slot && !findSlot(catalog, addon.slot)) {
      problems.push(`${addon.id} fills slot ${addon.slot}, which isn't defined.`)
    }
    // The resolver reads `slot:` and `provides:` only in requires. Elsewhere they'd be accepted and do nothing.
    for (const reference of [...(addon.conflicts ?? []), ...(addon.after ?? [])]) {
      if (reference.startsWith("slot:") || reference.startsWith("provides:")) {
        problems.push(`${addon.id} uses ${reference} in conflicts or after, which take add-on ids only.`)
      } else if (!findAddon(catalog, reference)) {
        problems.push(`${addon.id} refers to ${reference}, which isn't in the catalog.`)
      }
    }
    for (const reference of addon.requires ?? []) {
      if (reference.startsWith("slot:")) {
        if (!findSlot(catalog, reference.slice(5))) {
          problems.push(`${addon.id} refers to ${reference}, which isn't defined.`)
        }
      } else if (reference.startsWith("provides:")) {
        if (!provides.has(reference.slice(9))) {
          problems.push(`${addon.id} refers to ${reference}, and no add-on provides it.`)
        }
      } else if (!findAddon(catalog, reference)) {
        problems.push(`${addon.id} refers to ${reference}, which isn't in the catalog.`)
      }
    }
    const schema = optionsSchema(addon)
    const properties = isRecord(schema.properties) ? schema.properties : {}
    for (const key of addon.ask ?? []) {
      if (!Object.hasOwn(properties, key)) {
        problems.push(`${addon.id} asks about option ${key}, which it doesn't define.`)
      }
    }
    for (const migration of addon.migrations ?? []) {
      if (!isValidVersion(migration.version)) {
        problems.push(
          `${addon.id} has a migration with version "${migration.version}", which isn't a semantic version.`
        )
      } else if (isValidVersion(addon.version) && compareVersions(migration.version, addon.version) > 0) {
        problems.push(`${addon.id} has a migration for ${migration.version}, which is newer than the add-on.`)
      }
    }
  }
  for (const template of catalog.templates) {
    const target = findTarget(catalog, template.target)
    if (!target) {
      problems.push(`Template ${template.id} uses target ${template.target}, which isn't in the catalog.`)
      continue
    }
    const modes = templateModes(catalog, template)
    for (const modeId of modes) {
      const mode = findMode(target, modeId)
      if (!mode) {
        problems.push(`Template ${template.id} offers mode ${modeId}, which ${target.id} doesn't have.`)
        continue
      }
      const info = targetInfo(catalog, target, mode)
      const check = (id: string, role: string) => {
        const addon = findAddon(catalog, id)
        if (!addon) {
          problems.push(`Template ${template.id} names ${role} add-on ${id}, which isn't in the catalog.`)
          return
        }
        const support = addonSupports(addon, info)
        if (support !== true) {
          problems.push(
            `Template ${template.id} names ${id}, which doesn't support ${target.id}/${mode.id}: ${support}`
          )
        }
      }
      for (const id of template.required ?? []) {
        check(id, "required")
        const addon = findAddon(catalog, id)
        if (addon && !parseOptions(addon, {}).ok) {
          problems.push(`${id} is required by template ${template.id}, so every option needs a default.`)
        }
      }
      for (const id of Object.keys(template.optional ?? {})) {
        check(id, "optional")
      }
      for (const [slot, policy] of Object.entries(template.slots ?? {})) {
        if (!findSlot(catalog, slot)) {
          problems.push(`Template ${template.id} asks about slot ${slot}, which isn't defined.`)
        }
        if (policy.default !== undefined) {
          if (findAddon(catalog, policy.default)?.slot !== slot) {
            problems.push(
              `Template ${template.id} defaults ${slot} to ${policy.default}, which isn't one of that slot's add-ons.`
            )
          } else {
            check(policy.default, "default")
          }
        }
      }
    }
  }
  for (const preset of catalog.presets ?? []) {
    if (!findTemplate(catalog, preset.answers.template)) {
      problems.push(`Preset ${preset.id} uses template ${preset.answers.template}, which isn't in the catalog.`)
      continue
    }
    problems.push(...planAnswers(catalog, { ...preset.answers, name: "catalog-check" }, `Preset ${preset.id}`))
  }
  if (options.matrix && problems.length === 0) {
    for (const template of catalog.templates.filter(
      (candidate) => options.templates === undefined || options.templates.includes(candidate.id)
    )) {
      for (const mode of templateModes(catalog, template)) {
        for (const answers of pairwiseAnswers(catalog, template.id, mode)) {
          problems.push(
            ...planAnswers(
              catalog,
              answers,
              `Template ${template.id} (${JSON.stringify({ mode, slots: answers.slots, optional: answers.optional })})`
            )
          )
        }
      }
    }
  }
  return [...new Set(problems)]
}

function planAnswers(catalog: CatalogManifest, answers: Answers, label: string): string[] {
  try {
    const selection = selectionFromAnswers(catalog, answers, answers.name ?? "catalog-check")
    if (!selection.ok) {
      return []
    }
    const resolved = resolveSelection(catalog, selection.selection)
    if (resolved.ok) {
      render(catalog, resolved.value, defineSettings({ product: "catalog-check" }))
    }
    return []
  } catch (error) {
    return [
      `${label} fails to plan: ${error instanceof PlanError || error instanceof Error ? error.message : String(error)}`
    ]
  }
}

/** Answer sets that cover every pair of values across a template's questions, for catalog CI's matrix. */
export function pairwiseAnswers(catalog: CatalogManifest, templateId: string, mode: string): Answers[] {
  const template = findTemplate(catalog, templateId)
  if (!template) {
    return []
  }
  const target = findTarget(catalog, template.target)
  const found = target ? findMode(target, mode) : undefined
  const info = target && found ? targetInfo(catalog, target, found) : undefined
  type Factor = { apply: (answers: Answers, value: number) => Answers; values: number }
  const factors: Factor[] = []
  for (const [slot, policy] of Object.entries(template.slots ?? {})) {
    const candidates = slotAddons(catalog, slot)
      .filter((addon) => !info || addonSupports(addon, info) === true)
      .map((addon) => addon.id)
    const values: (string | null)[] = [...(policy.required ? [] : [null]), ...candidates]
    factors.push({
      values: values.length,
      apply: (answers, value) => ({ ...answers, slots: { ...answers.slots, [slot]: values[value] ?? null } })
    })
  }
  for (const id of Object.keys(template.optional ?? {})) {
    factors.push({
      values: 2,
      apply: (answers, value) => ({
        ...answers,
        optional:
          value === 1 ? [...(answers.optional ?? []), id] : (answers.optional ?? []).filter((entry) => entry !== id)
      })
    })
  }
  const base: Answers = { template: templateId, mode, name: "catalog-check", optional: [] }
  if (factors.length < 2) {
    const [only] = factors
    return only ? Array.from({ length: only.values }, (_, value) => only.apply(base, value)) : [base]
  }
  const result: Answers[] = []
  for (let left = 0; left < factors.length; left++) {
    for (let right = left + 1; right < factors.length; right++) {
      const a = factors[left]
      const b = factors[right]
      if (!a || !b) {
        continue
      }
      for (let x = 0; x < a.values; x++) {
        for (let y = 0; y < b.values; y++) {
          result.push(b.apply(a.apply(base, x), y))
        }
      }
    }
  }
  return result
}
