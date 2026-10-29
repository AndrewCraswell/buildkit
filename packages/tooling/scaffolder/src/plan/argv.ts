import { shortName } from "../manifest/catalog.js"
import type { PresetManifest } from "../manifest/types.js"
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
 * The CLI arguments that make the same request, without the product's own name. With `preset`, an `init` for that
 * preset's template is written as `init --preset <id>` plus flags for the answers that differ from the preset's.
 */
export function requestArgv(request: PlanRequest, options: { preset?: PresetManifest } = {}): string[] {
  const { intent } = request
  const argv: string[] = []
  switch (intent.command) {
    case "init": {
      const { answers } = intent
      const preset = options.preset?.answers.template === answers.template ? options.preset : undefined
      const name = answers.name === undefined ? [] : [answers.name]
      argv.push("init", ...(preset ? ["--preset", preset.id] : [answers.template]), ...name)
      if (answers.mode !== undefined && answers.mode !== preset?.answers.mode) {
        argv.push("--mode", answers.mode)
      }
      for (const [slot, answer] of Object.entries(answers.slots ?? {})) {
        if (preset && preset.answers.slots?.[slot] === answer) {
          continue
        }
        argv.push(...(answer === null ? [`--no-${slot}`] : [`--${slot}`, shortName(answer)]))
      }
      const inPreset = new Set(preset?.answers.optional ?? [])
      for (const id of answers.optional ?? []) {
        if (!inPreset.has(id)) {
          argv.push("--with", shortName(id))
        }
      }
      for (const id of inPreset) {
        if (!(answers.optional ?? []).includes(id)) {
          argv.push("--without", shortName(id))
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
