import { styleText } from "node:util"
import * as prompts from "@clack/prompts"

export class Cancelled extends Error {
  constructor() {
    super("Setup cancelled. No configuration was written.")
  }
}
export function answer<T>(value: T): Exclude<T, symbol>
export function answer(value: unknown) {
  if (typeof value === "symbol") {
    throw new Cancelled()
  }
  return value
}
export function intro() {
  prompts.intro(`${styleText(["bgBlue", "white"], " BUILDKIT ")} / Development domains`)
}
export function output(value: unknown) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}
export function text(value: string) {
  process.stdout.write(`${value}\n`)
}

export async function chooseEndpoint(names: { service: string; origin: string }[], selected?: string) {
  if (selected) {
    const endpoint = names.find((entry) => entry.service === selected)
    if (!endpoint) {
      throw new Error(`Unknown endpoint ${selected}. Available: ${names.map((entry) => entry.service).join(", ")}`)
    }
    return endpoint.service
  }
  if (names.length === 1) {
    return names[0]!.service
  }
  if (!process.stdin.isTTY) {
    throw new Error(`Specify an endpoint: ${names.map((entry) => entry.service).join(", ")}`)
  }
  intro()
  return answer(
    await prompts.select({
      showInstructions: false,
      message: "Which endpoint should run?",
      options: names.map((entry) => ({ value: entry.service, label: entry.service, hint: entry.origin }))
    })
  )
}
