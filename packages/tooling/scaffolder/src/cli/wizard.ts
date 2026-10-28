import { findAddon, findTemplate, templateModes } from "../manifest/catalog.js"
import type { Answers, CatalogManifest } from "../manifest/types.js"
import { PlanError } from "../plan/errors.js"
import { isRecord } from "../plan/json.js"
import type { EnvVar } from "../plan/types.js"
import { optionQuestions, templateQuestions, type OptionQuestion } from "../resolve/questions.js"
import { projectNameProblem, requireAddonId } from "../resolve/resolve.js"
import { cancelled, type Cancelled, type Prompter } from "./prompter.js"

/** Answers already given by flags or a preset. The wizard asks only what's missing. */
export interface PartialAnswers {
  template?: string
  mode?: string
  name?: string
  slots: Record<string, string | null>
  /** The exact optional add-ons, from a preset. */
  optional?: string[]
  with: string[]
  without: string[]
  options: Record<string, Record<string, unknown>>
  adopt?: boolean
}

export function emptyAnswers(): PartialAnswers {
  return { slots: {}, with: [], without: [], options: {} }
}

/** Combines answers without prompting: unanswered questions take their defaults in the planner. */
export function completeAnswers(catalog: CatalogManifest, partial: PartialAnswers): Answers {
  const template = partial.template ?? (catalog.templates.length === 1 ? catalog.templates[0]?.id : undefined)
  if (template === undefined) {
    throw new PlanError(
      "E_USAGE",
      `Choose a template: ${catalog.templates.map((candidate) => candidate.id).join(", ")}.`
    )
  }
  const found = findTemplate(catalog, template)
  let optional = partial.optional
  if (optional === undefined && (partial.with.length > 0 || partial.without.length > 0)) {
    const defaults = Object.entries(found?.optional ?? {})
      .filter(([, policy]) => policy.default)
      .map(([id]) => id)
    optional = defaults
  }
  if (optional !== undefined) {
    const without = new Set(partial.without.map((name) => requireAddonId(catalog, name)))
    optional = [...new Set([...optional, ...partial.with].map((name) => requireAddonId(catalog, name)))].filter(
      (id) => !without.has(id)
    )
  }
  return {
    template,
    ...(partial.mode === undefined ? {} : { mode: partial.mode }),
    ...(partial.name === undefined ? {} : { name: partial.name }),
    ...(Object.keys(partial.slots).length > 0 ? { slots: partial.slots } : {}),
    ...(optional === undefined ? {} : { optional }),
    ...(Object.keys(partial.options).length > 0 ? { options: partial.options } : {}),
    ...(partial.adopt ? { adopt: true } : {})
  }
}

/**
 * Asks every question the flags left open, generated from the catalog in this order: template, project name, mode,
 * each slot, the optional add-ons, then the options each chosen add-on lists in `ask`.
 */
export async function runWizard(input: {
  catalog: CatalogManifest
  partial: PartialAnswers
  prompter: Prompter
  askName: boolean
}): Promise<Answers | Cancelled> {
  const { catalog, prompter } = input
  const partial: PartialAnswers = structuredClone(input.partial)
  if (partial.template === undefined) {
    const [only] = catalog.templates
    if (only && catalog.templates.length === 1) {
      partial.template = only.id
    } else {
      const answer = await prompter.select({
        message: "Which template?",
        options: catalog.templates.map((template) => ({
          value: template.id,
          label: template.title,
          hint: template.description
        }))
      })
      if (answer === cancelled) {
        return cancelled
      }
      partial.template = answer
    }
  }
  const template = findTemplate(catalog, partial.template)
  if (!template) {
    throw new PlanError("E_UNKNOWN_TEMPLATE", `There's no template named "${partial.template}".`)
  }
  if (input.askName && partial.name === undefined) {
    const answer = await prompter.text({
      message: "Project name?",
      placeholder: "my-app",
      validate: (value) => projectNameProblem(value.trim())
    })
    if (answer === cancelled) {
      return cancelled
    }
    partial.name = answer.trim()
  }
  const modes = templateModes(catalog, template)
  if (partial.mode === undefined && modes.length > 1) {
    const questions = templateQuestions(catalog, template, modes[0] ?? "")
    const answer = await prompter.select({
      message: "Which mode?",
      options: questions.modes.map((mode) => ({ value: mode.id, label: mode.title }))
    })
    if (answer === cancelled) {
      return cancelled
    }
    partial.mode = answer
  }
  const questions = templateQuestions(catalog, template, partial.mode ?? modes[0] ?? "")
  for (const slot of questions.slots) {
    if (Object.hasOwn(partial.slots, slot.slot)) {
      continue
    }
    if (!slot.required) {
      if (slot.choices.length === 0) {
        partial.slots[slot.slot] = null
        continue
      }
      const wanted = await prompter.confirm({
        message: slot.question ?? `Add a ${slot.slot}?`,
        initialValue: slot.default !== undefined
      })
      if (wanted === cancelled) {
        return cancelled
      }
      if (!wanted) {
        partial.slots[slot.slot] = null
        continue
      }
    }
    const [only] = slot.choices
    if (only && slot.choices.length === 1) {
      partial.slots[slot.slot] = only.id
      continue
    }
    const answer = await prompter.select({
      message: slot.choose,
      options: slot.choices.map((choice) => ({ value: choice.id, label: choice.title, hint: choice.description })),
      ...(slot.default === undefined ? {} : { initialValue: slot.default })
    })
    if (answer === cancelled) {
      return cancelled
    }
    partial.slots[slot.slot] = answer
  }
  if (
    partial.optional === undefined &&
    partial.with.length === 0 &&
    partial.without.length === 0 &&
    questions.optional.length > 0
  ) {
    const answer = await prompter.multiselect({
      message: "Add any of these?",
      options: questions.optional.map((choice) => ({
        value: choice.id,
        label: choice.title,
        hint: choice.description
      })),
      initialValues: questions.optional.filter((choice) => choice.default).map((choice) => choice.id)
    })
    if (answer === cancelled) {
      return cancelled
    }
    partial.optional = answer
  }
  const answers = completeAnswers(catalog, partial)
  const chosen = [
    ...Object.values(answers.slots ?? {}).filter((id) => id !== null),
    ...(answers.optional ??
      Object.entries(template.optional ?? {})
        .filter(([, policy]) => policy.default)
        .map(([id]) => id))
  ]
  const options: Record<string, Record<string, unknown>> = structuredClone(answers.options ?? {})
  for (const id of chosen) {
    const addon = findAddon(catalog, id)
    if (!addon) {
      continue
    }
    for (const question of optionQuestions(addon)) {
      if (options[id] && Object.hasOwn(options[id], question.key)) {
        continue
      }
      const value = await askOption(prompter, addon.title, question)
      if (value === cancelled) {
        return cancelled
      }
      options[id] = { ...options[id], [question.key]: value }
    }
  }
  return { ...answers, ...(Object.keys(options).length > 0 ? { options } : {}) }
}

async function askOption(prompter: Prompter, title: string, question: OptionQuestion): Promise<unknown> {
  const schema = question.schema
  const message = `${title}: ${question.title}`
  const items = isRecord(schema.items) ? schema.items : undefined
  const choices = (values: unknown) =>
    Array.isArray(values) ? values.filter((value) => typeof value === "string") : []
  if (schema.type === "boolean") {
    return prompter.confirm({ message, initialValue: question.default === true })
  }
  if (Array.isArray(schema.enum)) {
    return prompter.select({
      message,
      options: choices(schema.enum).map((value) => ({ value, label: value })),
      ...(typeof question.default === "string" ? { initialValue: question.default } : {})
    })
  }
  if (schema.type === "array" && items && Array.isArray(items.enum)) {
    return prompter.multiselect({
      message,
      options: choices(items.enum).map((value) => ({ value, label: value })),
      initialValues: choices(question.default)
    })
  }
  let initial: string | undefined
  if (Array.isArray(question.default)) {
    initial = question.default.join(", ")
  } else if (question.default !== undefined) {
    initial = String(question.default)
  }
  const numeric = schema.type === "number" || schema.type === "integer"
  const answer = await prompter.text({
    message,
    ...(initial === undefined ? {} : { initialValue: initial }),
    // Number("") is 0, so a blank answer has to be refused on its own.
    validate: (value) =>
      numeric && (value.trim() === "" || Number.isNaN(Number(value))) ? "Enter a number." : undefined
  })
  if (answer === cancelled) {
    return cancelled
  }
  if (numeric) {
    return Number(answer)
  }
  return schema.type === "array"
    ? answer
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
    : answer
}

/** Asks for each required secret with a masked prompt. Values go only to the secrets file. */
export async function askSecrets(env: EnvVar[], prompter: Prompter): Promise<Record<string, string> | Cancelled> {
  const values: Record<string, string> = {}
  for (const variable of env.filter((entry) => entry.secret && entry.required)) {
    const answer = await prompter.password({
      message: `${variable.name}: ${variable.description}`,
      validate: (value) => (value.trim() === "" ? "Enter a value, or press Ctrl+C to stop." : undefined)
    })
    if (answer === cancelled) {
      return cancelled
    }
    values[variable.name] = answer
  }
  return values
}
