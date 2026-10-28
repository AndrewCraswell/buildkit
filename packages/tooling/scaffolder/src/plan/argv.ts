import { shortName } from "../manifest/catalog.js"
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

/** The CLI arguments that make the same request, without the product's own name. */
export function requestArgv(request: PlanRequest): string[] {
  const { intent } = request
  const argv: string[] = []
  switch (intent.command) {
    case "init": {
      const { answers } = intent
      argv.push("init", answers.template, ...(answers.name === undefined ? [] : [answers.name]))
      if (answers.mode !== undefined) {
        argv.push("--mode", answers.mode)
      }
      for (const [slot, answer] of Object.entries(answers.slots ?? {})) {
        argv.push(...(answer === null ? [`--no-${slot}`] : [`--${slot}`, shortName(answer)]))
      }
      for (const id of answers.optional ?? []) {
        argv.push("--with", shortName(id))
      }
      argv.push(...setFlags(answers.options ?? {}))
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
