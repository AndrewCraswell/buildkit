import MagicString from "magic-string"
import { parseSync } from "oxc-parser"
import { isRecord } from "../plan/json.js"

/**
 * Small codemods for adopting an existing project, on oxc's AST with magic-string edits: everything outside the edited
 * span stays byte for byte. They never merge at the AST level; they only add an import or an array element.
 */

interface Node {
  type: string
  start: number
  end: number
  [key: string]: unknown
}

function isNode(value: unknown): value is Node {
  return (
    isRecord(value) &&
    typeof value.type === "string" &&
    typeof value.start === "number" &&
    typeof value.end === "number"
  )
}

function parse(filename: string, source: string): Node {
  const result = parseSync(filename, source)
  const [first] = result.errors
  if (first) {
    throw new Error(`${filename} can't be parsed: ${first.message}`)
  }
  const program: unknown = result.program
  if (!isNode(program)) {
    throw new Error(`${filename} has no program.`)
  }
  return program
}

function children(node: Node): Node[] {
  return Object.entries(node).flatMap(([key, value]) => {
    if (key === "parent") {
      return []
    }
    if (Array.isArray(value)) {
      return value.filter(isNode)
    }
    return isNode(value) ? [value] : []
  })
}

function walk(node: Node, visit: (node: Node) => void) {
  visit(node)
  for (const child of children(node)) {
    walk(child, visit)
  }
}

function nameOf(node: unknown): string | undefined {
  if (!isNode(node)) {
    return undefined
  }
  if (node.type === "Identifier" && typeof node.name === "string") {
    return node.name
  }
  if (node.type === "Literal" && typeof node.value === "string") {
    return node.value
  }
  return undefined
}

export interface ImportSpec {
  module: string
  /** Named imports to ensure. */
  named?: string[]
  /** A default import to ensure. */
  defaultName?: string
}

/** Adds an import, or the missing names to an existing import of the same module. Returns the source unchanged if present. */
export function ensureImport(filename: string, source: string, spec: ImportSpec): string {
  const program = parse(filename, source)
  const body = Array.isArray(program.body) ? program.body.filter(isNode) : []
  const imports = body.filter((node) => node.type === "ImportDeclaration")
  // Type-only imports are erased at runtime, so neither they nor `type` specifiers count as importing a value.
  const values = imports.filter(
    (node) => isNode(node.source) && node.source.value === spec.module && node.importKind !== "type"
  )
  const valueSpecifiers = values.flatMap(specifiersOf).filter((node) => node.importKind !== "type")
  const present = new Set(
    valueSpecifiers.filter((node) => node.type === "ImportSpecifier").map((node) => nameOf(node.imported))
  )
  const edit = new MagicString(source)
  // `import { type A }` becomes `import { A }` when the value is wanted, rather than importing A twice.
  for (const node of values.flatMap(specifiersOf)) {
    const imported = node.imported
    const name = nameOf(imported)
    if (node.importKind === "type" && isNode(imported) && name !== undefined && spec.named?.includes(name)) {
      edit.remove(node.start, imported.start)
      present.add(name)
    }
  }
  const missing = (spec.named ?? []).filter((name) => !present.has(name))
  const defaultName = valueSpecifiers.some((node) => node.type === "ImportDefaultSpecifier")
    ? undefined
    : spec.defaultName
  if (values.length > 0 && missing.length === 0 && !defaultName) {
    return edit.toString()
  }
  // `import * as ns, { a }` isn't valid, so names never join a namespace import.
  const existing = values.find(
    (node) => missing.length === 0 || !specifiersOf(node).some((s) => s.type === "ImportNamespaceSpecifier")
  )
  if (existing) {
    const specifiers = specifiersOf(existing)
    const named = specifiers.filter((node) => node.type === "ImportSpecifier")
    const [first] = specifiers
    if (!first) {
      // A side-effect import, `import "m"`: write it again with the names.
      if (missing.length > 0 || defaultName) {
        edit.overwrite(
          existing.start,
          existing.end,
          renderImport({ module: spec.module, named: missing, ...(defaultName ? { defaultName } : {}) })
        )
      }
      return edit.toString()
    }
    const lastNamed = named.at(-1)
    if (missing.length > 0) {
      const anchor = lastNamed ?? specifiers.at(-1)
      edit.appendLeft(anchor?.end ?? first.end, lastNamed ? `, ${missing.join(", ")}` : `, { ${missing.join(", ")} }`)
    }
    if (defaultName) {
      // The default import goes first: before the `{` of a named list, or before `* as ns`.
      edit.prependLeft(
        first.type === "ImportSpecifier" ? source.lastIndexOf("{", first.start) : first.start,
        `${defaultName}, `
      )
    }
    return edit.toString()
  }
  const line = `${renderImport({ module: spec.module, named: missing, ...(defaultName ? { defaultName } : {}) })}\n`
  const last = imports.at(-1)
  if (last) {
    edit.appendLeft(last.end, `\n${line.trimEnd()}`)
  } else {
    edit.prepend(line)
  }
  return edit.toString()
}

function specifiersOf(node: Node): Node[] {
  return Array.isArray(node.specifiers) ? node.specifiers.filter(isNode) : []
}

function renderImport(spec: ImportSpec): string {
  const named = spec.named && spec.named.length > 0 ? `{ ${spec.named.join(", ")} }` : ""
  const parts = [spec.defaultName, named].filter(Boolean).join(", ")
  return parts === "" ? `import ${JSON.stringify(spec.module)}` : `import ${parts} from ${JSON.stringify(spec.module)}`
}

/**
 * Appends an element to an array property, such as `plugins: [...]` inside `defineConfig({ ... })`. Returns the source
 * unchanged when an element with the same text is already there, and `undefined` when there's no such array.
 */
export function appendToArray(
  filename: string,
  source: string,
  target: { property: string; call?: string; element: string }
): string | undefined {
  const program = parse(filename, source)
  const arrays: Node[] = []
  const collect = (root: Node) =>
    walk(root, (node) => {
      if (
        node.type === "Property" &&
        nameOf(node.key) === target.property &&
        isNode(node.value) &&
        node.value.type === "ArrayExpression"
      ) {
        arrays.push(node.value)
      }
    })
  if (target.call) {
    walk(program, (node) => {
      if (node.type === "CallExpression" && nameOf(node.callee) === target.call) {
        for (const argument of Array.isArray(node.arguments) ? node.arguments.filter(isNode) : []) {
          collect(argument)
        }
      }
    })
  } else {
    collect(program)
  }
  const [array] = arrays
  if (!array) {
    return undefined
  }
  const elements = Array.isArray(array.elements) ? array.elements.filter(isNode) : []
  if (elements.some((element) => source.slice(element.start, element.end).trim() === target.element.trim())) {
    return source
  }
  const edit = new MagicString(source)
  const last = elements.at(-1)
  if (last) {
    edit.appendLeft(last.end, `, ${target.element}`)
  } else {
    edit.appendLeft(array.start + 1, target.element)
  }
  return edit.toString()
}
