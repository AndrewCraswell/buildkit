import { z } from "zod"
import {
  findMode,
  findSlot,
  findTarget,
  parseOptions,
  slotAddons,
  targetInfo,
  templateModes
} from "../manifest/catalog.js"
import type { AddonManifest, Answers, CatalogManifest, TemplateManifest } from "../manifest/types.js"
import { isRecord } from "../plan/json.js"
import { addonSupports } from "./resolve.js"

export interface Choice {
  id: string
  title: string
  description: string
}

export interface SlotQuestion {
  slot: string
  title: string
  /** Asked first when the slot is optional: "Add a database?". */
  question?: string
  choose: string
  required: boolean
  default?: string
  /** Add-ons that support the target in this mode. */
  choices: Choice[]
}

export interface OptionQuestion {
  addon: string
  key: string
  title: string
  /** JSON Schema of the option. */
  schema: Record<string, unknown>
  default?: unknown
}

export interface TemplateQuestions {
  template: string
  title: string
  description: string
  mode: string
  modes: Choice[]
  /** Installed every time, never asked about. */
  required: Choice[]
  slots: SlotQuestion[]
  optional: (Choice & { default: boolean })[]
}

export interface CatalogDescription {
  catalog: { id: string; version: string }
  templates: (Omit<TemplateQuestions, "mode"> & { questionsByMode: Record<string, Omit<TemplateQuestions, "modes">> })[]
  addons: {
    id: string
    title: string
    description: string
    version: string
    slot?: string
    ask: OptionQuestion[]
    options: Record<string, unknown>
  }[]
  slots: { id: string; title: string; question: string; choose: string }[]
  /** Each preset's saved answers, so other doors can show or apply them without the catalog. */
  presets: { id: string; title: string; template: string; answers: Omit<Answers, "name"> }[]
}

function choice(addon: AddonManifest): Choice {
  return { id: addon.id, title: addon.title, description: addon.description }
}

/** The questions a template asks in one mode, in the order the wizard asks them. */
export function templateQuestions(
  catalog: CatalogManifest,
  template: TemplateManifest,
  modeId: string
): TemplateQuestions {
  const target = findTarget(catalog, template.target)
  const mode = target ? findMode(target, modeId) : undefined
  const info = target && mode ? targetInfo(catalog, target, mode) : undefined
  const supported = (addon: AddonManifest) => !info || addonSupports(addon, info) === true
  const addon = (id: string) => catalog.addons.find((candidate) => candidate.id === id)
  return {
    template: template.id,
    title: template.title,
    description: template.description,
    mode: modeId,
    modes: templateModes(catalog, template).map((id) => ({
      id,
      title: target?.modes.find((candidate) => candidate.id === id)?.title ?? id,
      description: ""
    })),
    required: (template.required ?? []).flatMap((id) => {
      const found = addon(id)
      return found ? [choice(found)] : []
    }),
    slots: Object.entries(template.slots ?? {}).map(([slot, policy]) => {
      const definition = findSlot(catalog, slot)
      return {
        slot,
        title: definition?.title ?? slot,
        ...(policy.required ? {} : { question: definition?.question ?? `Add a ${slot}?` }),
        choose: definition?.choose ?? `Which ${slot}?`,
        required: policy.required,
        ...(policy.default === undefined ? {} : { default: policy.default }),
        choices: slotAddons(catalog, slot).filter(supported).map(choice)
      }
    }),
    optional: Object.entries(template.optional ?? {}).flatMap(([id, { default: preselected }]) => {
      const found = addon(id)
      return found && supported(found) ? [{ ...choice(found), default: preselected }] : []
    })
  }
}

/** JSON Schema for an add-on's options, or an empty object schema when it has none. */
export function optionsSchema(addon: AddonManifest): Record<string, unknown> {
  if (!addon.options) {
    return { type: "object", properties: {}, additionalProperties: false }
  }
  const schema: unknown = z.toJSONSchema(addon.options, { io: "input", unrepresentable: "any" })
  return isRecord(schema) ? schema : {}
}

/** The options an add-on asks about, with their schemas and defaults. */
export function optionQuestions(addon: AddonManifest): OptionQuestion[] {
  const schema = optionsSchema(addon)
  const properties = isRecord(schema.properties) ? schema.properties : {}
  const defaults = parseOptions(addon, {})
  return (addon.ask ?? []).flatMap((key) => {
    const property = properties[key]
    if (!isRecord(property)) {
      return []
    }
    const fallback = defaults.ok ? defaults.value[key] : undefined
    return [
      {
        addon: addon.id,
        key,
        title: typeof property.description === "string" ? property.description : key,
        schema: property,
        ...(fallback === undefined ? {} : { default: fallback })
      }
    ]
  })
}

/** Everything the wizard can ask, for `catalog --json`, the dashboard and agents. */
export function describeCatalog(catalog: CatalogManifest): CatalogDescription {
  return {
    catalog: { id: catalog.id, version: catalog.version },
    templates: catalog.templates.map((template) => {
      const modes = templateModes(catalog, template)
      const first = templateQuestions(catalog, template, modes[0] ?? "")
      const { mode: _mode, ...shared } = first
      return {
        ...shared,
        questionsByMode: Object.fromEntries(
          modes.map((mode) => {
            const { modes: _modes, ...questions } = templateQuestions(catalog, template, mode)
            return [mode, questions]
          })
        )
      }
    }),
    addons: catalog.addons.map((addon) => ({
      id: addon.id,
      title: addon.title,
      description: addon.description,
      version: addon.version,
      ...(addon.slot ? { slot: addon.slot } : {}),
      ask: optionQuestions(addon),
      options: optionsSchema(addon)
    })),
    slots: catalog.slots.map((slot) => ({
      id: slot.id,
      title: slot.title,
      question: slot.question,
      choose: slot.choose
    })),
    presets: (catalog.presets ?? []).map((preset) => ({
      id: preset.id,
      title: preset.title,
      template: preset.answers.template,
      answers: preset.answers
    }))
  }
}
