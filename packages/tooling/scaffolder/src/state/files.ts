import { applyEdits, findNodeAtLocation, parseTree, type FormattingOptions } from "jsonc-parser"
import { jsonFormatting, parseJsonc, removeJson, setJson } from "../edit/json.js"
import { defaultJsonLayout, printJson, replaceJsonValue, type JsonLayout } from "../edit/layout.js"
import { hasConflictMarkers } from "../ownership/text.js"
import { PlanError } from "../plan/errors.js"
import { isRecord, jsonEqual, stableJson } from "../plan/json.js"
import { lockSchema, lockSchemaVersion, projectConfigSchema, type Lock, type ProjectConfig } from "./schemas.js"
import type { ProductSettings } from "./settings.js"

function parseState(path: string, text: string): unknown {
  if (hasConflictMarkers(text)) {
    throw new PlanError("E_CONFLICT_MARKERS", `${path} has git conflict markers. Resolve them, then run sync.`, {
      paths: [path]
    })
  }
  const parsed = parseJsonc(text)
  if (!parsed.ok) {
    throw new PlanError(
      parsed.reason === "unsafe-key" ? "E_UNSAFE_KEY" : "E_INVALID_STATE",
      parsed.reason === "unsafe-key"
        ? `${path} has an unsafe key at ${parsed.pointer}.`
        : `${path} isn't valid JSON: ${parsed.message}.`,
      { paths: [path] }
    )
  }
  return parsed.value
}

export function readConfig(path: string, text: string): ProjectConfig {
  const result = projectConfigSchema.safeParse(parseState(path, text))
  if (!result.success) {
    const issues = result.error.issues.map(
      (issue) => `${issue.path.map(String).join(".") || "(root)"}: ${issue.message}`
    )
    throw new PlanError("E_INVALID_STATE", `${path} is invalid: ${issues.join("; ")}.`, { paths: [path] })
  }
  return result.data
}

export function readLock(path: string, text: string): Lock {
  const value = parseState(path, text)
  if (isRecord(value) && value.schemaVersion !== lockSchemaVersion) {
    throw new PlanError(
      "E_LOCK_VERSION",
      `${path} has schema version ${JSON.stringify(value.schemaVersion)}, and this engine reads version ${lockSchemaVersion}. Upgrade the CLI, or rebuild the lock with sync.`,
      { paths: [path] }
    )
  }
  const result = lockSchema.safeParse(value)
  if (!result.success) {
    throw new PlanError("E_INVALID_STATE", `${path} is invalid. Rebuild it with sync.`, { paths: [path] })
  }
  return result.data
}

export function writeLock(lock: Lock): string {
  return stableJson(lock)
}

/** Lock contents that matter for change detection: everything except the last apply's fingerprint. */
export function lockEqual(left: Lock | undefined, right: Lock | undefined): boolean {
  if (!left || !right) {
    return left === right
  }
  const { lastApply: _left, ...a } = left
  const { lastApply: _right, ...b } = right
  return jsonEqual(a, b)
}

/** A config property, its value on one line when it fits, as the formatters keep a one-line object. */
function configProperty(
  key: string,
  value: unknown,
  at: { indent: string; unit: string; eol: string },
  last: boolean,
  printWidth: number
) {
  const { indent, unit, eol } = at
  const name = JSON.stringify(key)
  const printed = printJson(value, {
    layout: { style: "json", printWidth },
    unit,
    eol,
    objects: "inline",
    column: indent.length + name.length + 2,
    indent,
    trailing: last ? 0 : 1
  })
  return `${indent}${name}: ${printed}`
}

function renderAddons(
  addons: Record<string, Record<string, unknown>>,
  unit: string,
  eol: string,
  printWidth: number
): string {
  const ids = Object.keys(addons).sort()
  if (ids.length === 0) {
    return "{}"
  }
  const lines = ids.map((id, index) =>
    configProperty(id, addons[id] ?? {}, { indent: `${unit}${unit}`, unit, eol }, index === ids.length - 1, printWidth)
  )
  return `{${eol}${lines.join(`,${eol}`)}${eol}${unit}}`
}

/**
 * A new config file. Each add-on sits on one line when it fits, so git merges changes to different add-ons cleanly, and
 * the layout is the formatter's.
 */
export function renderConfig(config: ProjectConfig, settings: ProductSettings): string {
  const { $schema: _schema, addons, declined, ...rest } = config
  const printWidth = settings.printWidth ?? defaultJsonLayout.printWidth
  const head = {
    ...(settings.schemaUrl ? { $schema: settings.schemaUrl } : {}),
    ...rest
  }
  const hasDeclined = declined !== undefined && declined.length > 0
  const at = { indent: "  ", unit: "  ", eol: "\n" }
  const lines = Object.entries(head).map(([key, value]) => configProperty(key, value, at, false, printWidth))
  lines.push(`  "addons": ${renderAddons(addons, "  ", "\n", printWidth)}`)
  if (hasDeclined) {
    lines.push(configProperty("declined", [...declined].sort(), at, true, printWidth))
  }
  return `{\n${lines.join(",\n")}\n}\n`
}

/** Updates an existing config, keeping comments and keys the engine doesn't know. */
export function updateConfig(
  text: string,
  previous: ProjectConfig,
  next: ProjectConfig,
  settings?: Pick<ProductSettings, "printWidth">
): string {
  const layout: JsonLayout = { style: "json", printWidth: settings?.printWidth ?? defaultJsonLayout.printWidth }
  let result = text
  for (const key of ["name", "template", "target"] as const) {
    if (!jsonEqual(previous[key], next[key])) {
      const formatting = jsonFormatting(result)
      result = replaceJsonValue(setJson(result, [key], next[key], layout), [key], next[key], {
        layout,
        unit: indentOf(formatting),
        eol: formatting.eol ?? "\n",
        objects: "inline"
      })
    }
  }
  if (!jsonEqual(previous.addons, next.addons)) {
    const formatting = jsonFormatting(result)
    const rendered = renderAddons(next.addons, indentOf(formatting), formatting.eol ?? "\n", layout.printWidth)
    const locate = (source: string) => {
      const tree = parseTree(source)
      return tree ? findNodeAtLocation(tree, ["addons"]) : undefined
    }
    let node = locate(result)
    if (!node) {
      result = setJson(result, ["addons"], {})
      node = locate(result)
    }
    if (node) {
      result = applyEdits(result, [{ offset: node.offset, length: node.length, content: rendered }])
    }
  }
  const declined = [...(next.declined ?? [])].sort()
  if (!jsonEqual([...(previous.declined ?? [])].sort(), declined)) {
    result =
      declined.length > 0 ? setJson(result, ["declined"], declined, layout) : removeJson(result, ["declined"], layout)
  }
  return result
}

function indentOf(formatting: FormattingOptions): string {
  return formatting.insertSpaces === false ? "\t" : " ".repeat(formatting.tabSize ?? 2)
}
