import { findTemplate, lookupAddon, shortName } from "../manifest/catalog.js"
import type { Answers, CatalogManifest, PresetManifest } from "../manifest/types.js"
import { compareText } from "./json.js"
import type { PlanRequest } from "./types.js"

type Options = Record<string, Record<string, unknown>>

/**
 * How a command names add-ons. A flag uses the short name, or the full id where the catalog has two add-ons with that
 * short name. Two names are the same add-on when the catalog resolves them to one id or, without the catalog, when
 * their short names match.
 */
interface AddonNames {
  flag(name: string): string
  key(name: string): string
}

function addonNames(catalog: CatalogManifest | undefined): AddonNames {
  if (!catalog) {
    return { flag: shortName, key: shortName }
  }
  const counts = new Map<string, number>()
  for (const { id } of catalog.addons) {
    counts.set(shortName(id), (counts.get(shortName(id)) ?? 0) + 1)
  }
  const key = (name: string) => {
    const found = lookupAddon(catalog, name)
    return "id" in found ? found.id : name
  }
  return {
    flag: (name) => {
      const id = key(name)
      return (counts.get(shortName(id)) ?? 0) > 1 ? id : shortName(id)
    },
    key
  }
}

function optionValue(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value)
}

function setFlags(options: Options, names: AddonNames): string[] {
  return Object.entries(options)
    .sort(([left], [right]) => compareText(left, right))
    .flatMap(([id, values]) =>
      Object.entries(values).flatMap(([key, value]) => ["--set", `${names.flag(id)}.${key}=${optionValue(value)}`])
    )
}

/** Options by the add-on they belong to, however the add-on is named. */
function optionsByAddon(options: Options, names: AddonNames): Map<string, Record<string, unknown>> {
  return new Map(Object.entries(options).map(([id, values]) => [names.key(id), values]))
}

/** Options that differ from a preset's, by add-on and key. */
function changedOptions(options: Options, preset: Options, names: AddonNames): Options {
  const presetOptions = optionsByAddon(preset, names)
  return Object.fromEntries(
    Object.entries(options)
      .map(([id, values]): [string, Record<string, unknown>] => [
        id,
        Object.fromEntries(
          Object.entries(values).filter(
            ([key, value]) => JSON.stringify(value) !== JSON.stringify(presetOptions.get(names.key(id))?.[key])
          )
        )
      ])
      .filter(([, values]) => Object.keys(values).length > 0)
  )
}

/**
 * Whether the answers answer every question the preset does. One they leave to the template's default can't be written
 * as a difference from the preset, because `--preset` answers it.
 */
function answersPreset(answers: Answers, preset: Answers, names: AddonNames): boolean {
  const options = optionsByAddon(answers.options ?? {}, names)
  return (
    (preset.mode === undefined || answers.mode !== undefined) &&
    (preset.optional === undefined || answers.optional !== undefined) &&
    Object.keys(preset.slots ?? {}).every((slot) => answers.slots?.[slot] !== undefined) &&
    Object.entries(preset.options ?? {}).every(([id, values]) =>
      Object.keys(values).every((key) => options.get(names.key(id))?.[key] !== undefined)
    )
  )
}

/** Whether a preset's slot answer is the request's: the same add-on, however it's named, or both "no". */
function sameAnswer(preset: string | null | undefined, answer: string | null, names: AddonNames): boolean {
  if (preset === undefined || preset === null || answer === null) {
    return preset === answer
  }
  return names.key(preset) === names.key(answer)
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
 * default writes `--without` for it, and an add-on whose short name another add-on shares is written by its full id.
 * A catalog of another version than the request's isn't used, since its defaults and add-ons can differ.
 */
export function requestArgv(
  request: PlanRequest,
  options: { preset?: PresetManifest; catalog?: CatalogManifest } = {}
): string[] {
  const catalog =
    options.catalog && (request.catalogVersion === undefined || request.catalogVersion === options.catalog.version)
      ? options.catalog
      : undefined
  const names = addonNames(catalog)
  const { intent } = request
  const argv: string[] = []
  switch (intent.command) {
    case "init": {
      const { answers } = intent
      const preset =
        options.preset?.answers.template === answers.template && answersPreset(answers, options.preset.answers, names)
          ? options.preset
          : undefined
      const name = answers.name === undefined ? [] : [answers.name]
      argv.push("init", ...(preset ? ["--preset", preset.id] : [answers.template]), ...name)
      if (answers.mode !== undefined && answers.mode !== preset?.answers.mode) {
        argv.push("--mode", answers.mode)
      }
      for (const [slot, answer] of Object.entries(answers.slots ?? {})) {
        if (preset && sameAnswer(preset.answers.slots?.[slot], answer, names)) {
          continue
        }
        argv.push(...(answer === null ? [`--no-${slot}`] : [`--${slot}`, names.flag(answer)]))
      }
      // `--with` and `--without` change the preset's optional add-ons or, without them, the template's defaults.
      if (answers.optional !== undefined) {
        const chosen = new Map(answers.optional.map((id) => [names.key(id), id]))
        const start = new Map(
          (preset?.answers.optional ?? templateDefaults(catalog, answers.template)).map((id) => [names.key(id), id])
        )
        for (const [key, id] of chosen) {
          if (!start.has(key)) {
            argv.push("--with", names.flag(id))
          }
        }
        for (const [key, id] of start) {
          if (!chosen.has(key)) {
            argv.push("--without", names.flag(id))
          }
        }
      }
      argv.push(...setFlags(changedOptions(answers.options ?? {}, preset?.answers.options ?? {}, names), names))
      if (answers.adopt) {
        argv.push("--adopt")
      }
      break
    }
    case "add":
      argv.push("add", ...intent.addons.map((id) => names.flag(id)))
      for (const id of intent.replace) {
        argv.push("--replace", names.flag(id))
      }
      argv.push(...setFlags(intent.options, names))
      break
    case "config":
      argv.push("config", "set", ...setFlags(intent.options, names).filter((_, index) => index % 2 === 1))
      argv.push(...(intent.addons ?? []).flatMap((id) => ["--with", names.flag(id)]))
      break
    case "upgrade":
    case "sync":
      argv.push(intent.command, ...(intent.addons ?? []).flatMap((id) => ["--with", names.flag(id)]))
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
