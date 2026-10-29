import { findTemplate, shortName } from "../manifest/catalog.js"
import type { Answers, CatalogManifest, PresetManifest } from "../manifest/types.js"
import { compareText } from "./json.js"
import type { PlanRequest } from "./types.js"

function optionValue(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value)
}

function setFlags(options: Record<string, Record<string, unknown>>): string[] {
  return Object.entries(options)
    .sort(([left], [right]) => compareText(left, right))
    .flatMap(([id, values]) =>
      Object.entries(values).flatMap(([key, value]) => ["--set", `${shortName(id)}.${key}=${optionValue(value)}`])
    )
}

/** Options that differ from a preset's, by add-on and key. */
function changedOptions(
  options: Record<string, Record<string, unknown>>,
  preset: Record<string, Record<string, unknown>>
): Record<string, Record<string, unknown>> {
  return Object.fromEntries(
    Object.entries(options)
      .map(([id, values]): [string, Record<string, unknown>] => [
        id,
        Object.fromEntries(
          Object.entries(values).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(preset[id]?.[key]))
        )
      ])
      .filter(([, values]) => Object.keys(values).length > 0)
  )
}

/**
 * Whether the answers answer every question the preset does. One they leave to the template's default can't be written
 * as a difference from the preset, because `--preset` answers it.
 */
function answersPreset(answers: Answers, preset: Answers): boolean {
  return (
    (preset.mode === undefined || answers.mode !== undefined) &&
    (preset.optional === undefined || answers.optional !== undefined) &&
    Object.keys(preset.slots ?? {}).every((slot) => answers.slots?.[slot] !== undefined) &&
    Object.entries(preset.options ?? {}).every(([id, values]) =>
      Object.keys(values).every((key) => answers.options?.[id]?.[key] !== undefined)
    )
  )
}

/** Whether a preset's slot answer is the request's: the same add-on, by id or short name, or both "no". */
function sameAnswer(preset: string | null | undefined, answer: string | null): boolean {
  if (preset === undefined || preset === null || answer === null) {
    return preset === answer
  }
  return shortName(preset) === shortName(answer)
}

/** The optional add-ons a template selects by default. Without the catalog they aren't known, so there are none. */
function templateDefaults(catalog: CatalogManifest | undefined, templateId: string): string[] {
  const template = catalog ? findTemplate(catalog, templateId) : undefined
  return Object.entries(template?.optional ?? {})
    .filter(([, { default: preselected }]) => preselected)
    .map(([id]) => id)
}

/**
 * The CLI arguments that make the same request, without the product's own name. With `preset`, an `init` for that
 * preset's template that answers every question the preset does is written as `init --preset <id>` plus flags for the
 * answers that differ from the preset's. With `catalog`, an `init` that leaves out an add-on its template selects by
 * default writes `--without` for it; without the catalog, those defaults aren't known.
 */
export function requestArgv(
  request: PlanRequest,
  options: { preset?: PresetManifest; catalog?: CatalogManifest } = {}
): string[] {
  const { intent } = request
  const argv: string[] = []
  switch (intent.command) {
    case "init": {
      const { answers } = intent
      const preset =
        options.preset?.answers.template === answers.template && answersPreset(answers, options.preset.answers)
          ? options.preset
          : undefined
      const name = answers.name === undefined ? [] : [answers.name]
      argv.push("init", ...(preset ? ["--preset", preset.id] : [answers.template]), ...name)
      if (answers.mode !== undefined && answers.mode !== preset?.answers.mode) {
        argv.push("--mode", answers.mode)
      }
      // Add-ons are compared by the short names the flags use, since a preset can name one either way.
      for (const [slot, answer] of Object.entries(answers.slots ?? {})) {
        if (preset && sameAnswer(preset.answers.slots?.[slot], answer)) {
          continue
        }
        argv.push(...(answer === null ? [`--no-${slot}`] : [`--${slot}`, shortName(answer)]))
      }
      // `--with` and `--without` change the preset's optional add-ons or, without them, the template's defaults.
      if (answers.optional !== undefined) {
        const chosen = new Set(answers.optional.map((id) => shortName(id)))
        const start = new Set(
          (preset?.answers.optional ?? templateDefaults(options.catalog, answers.template)).map((id) => shortName(id))
        )
        for (const name of chosen) {
          if (!start.has(name)) {
            argv.push("--with", name)
          }
        }
        for (const name of start) {
          if (!chosen.has(name)) {
            argv.push("--without", name)
          }
        }
      }
      argv.push(...setFlags(changedOptions(answers.options ?? {}, preset?.answers.options ?? {})))
      if (answers.adopt) {
        argv.push("--adopt")
      }
      break
    }
    case "add":
      argv.push("add", ...intent.addons.map((id) => shortName(id)))
      for (const id of intent.replace) {
        argv.push("--replace", shortName(id))
      }
      argv.push(...setFlags(intent.options))
      break
    case "config":
      argv.push("config", "set", ...setFlags(intent.options).filter((_, index) => index % 2 === 1))
      argv.push(...(intent.addons ?? []).flatMap((id) => ["--with", shortName(id)]))
      break
    case "upgrade":
    case "sync":
      argv.push(intent.command, ...(intent.addons ?? []).flatMap((id) => ["--with", shortName(id)]))
      break
  }
  for (const [id, resolution] of Object.entries(request.resolve ?? {})) {
    argv.push("--resolve", `${id}=${typeof resolution === "string" ? resolution : "file:<path>"}`)
  }
  if (request.conflictStyle === "markers") {
    argv.push("--conflict", "markers")
  }
  if (request.catalogVersion !== undefined) {
    argv.push("--catalog-version", request.catalogVersion)
  }
  return argv
}
