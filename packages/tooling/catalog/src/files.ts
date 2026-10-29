import { readFileSync } from "node:fs"
import type { Contribution, Ownership } from "@buildkitgg/scaffolder"

const templates = new URL("../templates/", import.meta.url)

/**
 * A starter file from the package's `templates/` folder. Templates are real files, formatted like the generated app,
 * so they read and diff like the code they become. Line endings are normalized, so a Windows checkout plans the same.
 */
export function template(path: string): string {
  return readFileSync(new URL(path, templates), "utf8").replaceAll("\r\n", "\n")
}

/** A file the engine writes. `seed` files are merged on upgrade; `sample` files are yours once written. */
export function file(path: string, content: string, ownership: Ownership = "seed"): Contribution {
  return { kind: "file", path, content, ownership }
}

/** A file copied from `templates/<set>/<path>`, written at `<path>` in the app. */
export function fromTemplate(set: string, path: string, ownership: Ownership = "seed"): Contribution {
  return file(path, template(`${set}/${path}`), ownership)
}

/** A package at the version the catalog pins. */
export function dependency(versions: { version(name: string): string }, name: string, dev = false): Contribution {
  return { kind: "dependency", name, version: versions.version(name), ...(dev ? { dev: true } : {}) }
}

/** Sets one key of a JSON file the app shares with the engine. */
export function jsonKey(path: string, pointer: string, value: unknown): Contribution {
  return { kind: "json", path, pointer, op: "set", value }
}

/** Adds items to a JSON array the engine keeps as a set, such as `tsconfig.json`'s `include`. */
export function jsonItems(path: string, pointer: string, value: unknown[]): Contribution {
  return { kind: "json", path, pointer, op: "append", value }
}

function isScalar(value: unknown): boolean {
  return typeof value !== "object" || value === null
}

function printJson(value: unknown, indent: string): string {
  const inner = `${indent}  `
  if (Array.isArray(value)) {
    const inline = `[${value.map((item) => JSON.stringify(item)).join(", ")}]`
    if (value.every(isScalar) && inner.length + inline.length <= 100) {
      return inline
    }
    return `[\n${value.map((item) => `${inner}${printJson(item, inner)}`).join(",\n")}\n${indent}]`
  }
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value)
    if (entries.length === 0) {
      return "{}"
    }
    return `{\n${entries.map(([key, item]) => `${inner}${JSON.stringify(key)}: ${printJson(item, inner)}`).join(",\n")}\n${indent}}`
  }
  return JSON.stringify(value)
}

/**
 * JSON as the app's formatter prints it: two-space indentation, objects expanded, short arrays of scalars on one line
 * and a final newline. Starter JSON files then pass `pnpm format:check` as written.
 */
export function json(value: unknown): string {
  return `${printJson(value, "")}\n`
}
