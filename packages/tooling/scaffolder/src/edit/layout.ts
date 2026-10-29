import { createScanner, findNodeAtLocation, parseTree, type Node } from "jsonc-parser"

/**
 * How the project's formatter prints JSON, so the engine's edits are what oxfmt and Prettier would write. `json` is
 * their layout for JSON and JSONC: an object stays across lines when it's written that way, an array goes on one line
 * when it fits `printWidth`, and a long array of numbers fills its lines. `stringify` is their layout for `package.json`,
 * as `JSON.stringify` prints it: every object and array across lines.
 */
export interface JsonLayout {
  style: "json" | "stringify"
  printWidth: number
}

export const defaultJsonLayout: JsonLayout = { style: "json", printWidth: 80 }

/** The layout the formatters use for a file: `stringify` for `package.json`, `package-lock.json` and `composer.json`. */
export function jsonLayoutFor(path: string, printWidth = defaultJsonLayout.printWidth): JsonLayout {
  const name = path.slice(path.lastIndexOf("/") + 1)
  const stringify = ["package.json", "package-lock.json", "composer.json"].includes(name)
  return { style: stringify ? "stringify" : "json", printWidth }
}

type Layout =
  | { kind: "scalar"; text: string; number: boolean }
  | { kind: "array"; items: Layout[] }
  | { kind: "object"; entries: [key: string, value: Layout][]; expanded: boolean }

interface Position {
  /** The width of the line before the value. */
  column: number
  /** The indentation of the value's line. */
  indent: string
  /** Characters that follow the value on its line, such as a comma. */
  trailing: number
}

/**
 * A value printed as the formatters print it, starting at `column` on a line indented by `indent`. Objects go across
 * lines; `objects: "inline"` puts each on one line instead when it fits, as the formatters keep an object written that
 * way.
 */
export function printJson(
  value: unknown,
  options: {
    layout?: JsonLayout
    unit?: string
    eol?: string
    objects?: "expanded" | "inline"
  } & Partial<Position> = {}
): string {
  const layout = options.layout ?? defaultJsonLayout
  return print(fromValue(value, options.objects === "inline"), layout, options.unit ?? "  ", options.eol ?? "\n", {
    column: options.column ?? 0,
    indent: options.indent ?? "",
    trailing: options.trailing ?? 0
  })
}

/**
 * Lays out the value at `path` again after an edit, with the arrays and one-line objects around it whose layout the
 * edit can change. `changed` is the text the edit rewrote: jsonc-parser reformats every line an edit touches, which
 * puts a list on the line before across lines, so the lists and one-line objects in it are laid out again too. A value
 * with a comment in it is left as it is, so no comment is lost.
 */
export function relayoutJson(
  text: string,
  path: (string | number)[] | undefined,
  layout: JsonLayout,
  unit: string,
  eol: string,
  changed?: { start: number; end: number }
): string {
  const tree = parseTree(text, [], { allowTrailingComma: true })
  if (!tree) {
    return text
  }
  const targets: Node[] = []
  let node = path ? findNodeAtLocation(tree, path) : undefined
  if (node) {
    for (let parent = container(node); parent && isFlexible(parent, text, layout); parent = container(parent)) {
      node = parent
    }
    targets.push(node)
  }
  if (changed && layout.style === "json") {
    collectFlexible(tree, text, layout, changed, targets)
  }
  // The outermost of nested values, from the end, so each replacement leaves the offsets before it as they were.
  const outermost = [...new Set(targets)]
    .filter((target) => !targets.some((other) => other !== target && contains(other, target)))
    .sort((left, right) => right.offset - left.offset)
  let result = text
  for (const target of outermost) {
    const source = text.slice(target.offset, target.offset + target.length)
    if (hasComment(source)) {
      continue
    }
    const printed = print(fromNode(target, text, layout), layout, unit, eol, positionOf(text, target))
    result = `${result.slice(0, target.offset)}${printed}${result.slice(target.offset + target.length)}`
  }
  return result
}

/** The topmost arrays and one-line objects that overlap `range`. */
function collectFlexible(
  node: Node,
  text: string,
  layout: JsonLayout,
  range: { start: number; end: number },
  found: Node[]
): void {
  if (node.offset >= range.end || node.offset + node.length <= range.start) {
    return
  }
  if ((node.type === "array" || node.type === "object") && node.parent && isFlexible(node, text, layout)) {
    found.push(node)
    return
  }
  for (const child of node.children ?? []) {
    collectFlexible(child, text, layout, range, found)
  }
}

function contains(outer: Node, inner: Node): boolean {
  return outer.offset <= inner.offset && inner.offset + inner.length <= outer.offset + outer.length
}

/** Prints `value` over the value at `path`, laid out for where it sits. Text without that path is returned as is. */
export function replaceJsonValue(
  text: string,
  path: (string | number)[],
  value: unknown,
  options: { layout: JsonLayout; unit: string; eol: string; objects?: "expanded" | "inline" }
): string {
  const tree = parseTree(text, [], { allowTrailingComma: true })
  const node = tree ? findNodeAtLocation(tree, path) : undefined
  if (!node) {
    return text
  }
  const printed = printJson(value, { ...options, ...positionOf(text, node) })
  return `${text.slice(0, node.offset)}${printed}${text.slice(node.offset + node.length)}`
}

function positionOf(text: string, node: Node): Position {
  const before = text.slice(text.lastIndexOf("\n", node.offset - 1) + 1, node.offset)
  return {
    column: width(before),
    indent: /^[\t ]*/.exec(before)?.[0] ?? "",
    trailing: /^[\t ]*,/.test(text.slice(node.offset + node.length)) ? 1 : 0
  }
}

/** The array or object that holds a value, skipping the property between them. */
function container(node: Node): Node | undefined {
  const parent = node.parent?.type === "property" ? node.parent.parent : node.parent
  return parent?.type === "array" || parent?.type === "object" ? parent : undefined
}

/** Arrays and one-line objects change layout with their contents. An object across lines keeps it. */
function isFlexible(node: Node, text: string, layout: JsonLayout): boolean {
  if (layout.style === "stringify") {
    return false
  }
  return node.type === "array" || !isExpanded(node, text)
}

function isExpanded(node: Node, text: string): boolean {
  const first = node.children?.[0]
  return first !== undefined && text.slice(node.offset + 1, first.offset).includes("\n")
}

// jsonc-parser's SyntaxKind is a const enum, which isolated modules can't read.
const lineComment = 12
const blockComment = 13
const end = 17

function hasComment(source: string): boolean {
  const scanner = createScanner(source, false)
  for (let token: number = scanner.scan(); token !== end; token = scanner.scan()) {
    if (token === lineComment || token === blockComment) {
      return true
    }
  }
  return false
}

function fromValue(value: unknown, inline: boolean): Layout {
  if (Array.isArray(value)) {
    return { kind: "array", items: value.map((item) => fromValue(item, inline)) }
  }
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value).filter(([, item]) => item !== undefined)
    return {
      kind: "object",
      entries: entries.map(([key, item]) => [JSON.stringify(key), fromValue(item, inline)]),
      expanded: !inline
    }
  }
  return { kind: "scalar", text: JSON.stringify(value) ?? "null", number: typeof value === "number" }
}

/** A parsed value, keeping its own text for scalars and keys, and whether each object is written across lines. */
function fromNode(node: Node, text: string, layout: JsonLayout): Layout {
  if (node.type === "array") {
    return { kind: "array", items: (node.children ?? []).map((child) => fromNode(child, text, layout)) }
  }
  if (node.type === "object") {
    const entries: [string, Layout][] = []
    for (const property of node.children ?? []) {
      const [key, value] = property.children ?? []
      if (key && value) {
        entries.push([text.slice(key.offset, key.offset + key.length), fromNode(value, text, layout)])
      }
    }
    return { kind: "object", entries, expanded: layout.style === "stringify" || isExpanded(node, text) }
  }
  return { kind: "scalar", text: text.slice(node.offset, node.offset + node.length), number: node.type === "number" }
}

function print(value: Layout, layout: JsonLayout, unit: string, eol: string, at: Position): string {
  if (value.kind === "scalar") {
    return value.text
  }
  const inner = `${at.indent}${unit}`
  if (value.kind === "object") {
    if (value.entries.length === 0) {
      return "{}"
    }
    const flat = flatText(value)
    if (flat !== undefined && fits(at, flat, layout)) {
      return flat
    }
    const lines = value.entries.map(
      ([key, item], index) =>
        `${inner}${key}: ${print(item, layout, unit, eol, {
          column: width(inner) + key.length + 2,
          indent: inner,
          trailing: index < value.entries.length - 1 ? 1 : 0
        })}`
    )
    return `{${eol}${lines.join(`,${eol}`)}${eol}${at.indent}}`
  }
  if (value.items.length === 0) {
    return "[]"
  }
  if (layout.style === "json" && !breaksAlways(value)) {
    const flat = flatText(value)
    if (flat !== undefined && fits(at, flat, layout)) {
      return flat
    }
    if (value.items.length > 1 && value.items.every((item) => item.kind === "scalar" && item.number)) {
      return `[${eol}${fill(value.items, inner, layout).join(eol)}${eol}${at.indent}]`
    }
  }
  const lines = value.items.map(
    (item, index) =>
      `${inner}${print(item, layout, unit, eol, {
        column: width(inner),
        indent: inner,
        trailing: index < value.items.length - 1 ? 1 : 0
      })}`
  )
  return `[${eol}${lines.join(`,${eol}`)}${eol}${at.indent}]`
}

/** Two or more objects, or two or more arrays, each with two or more entries, go one per line even when they'd fit. */
function breaksAlways(value: Extract<Layout, { kind: "array" }>): boolean {
  const [first] = value.items
  return (
    value.items.length > 1 &&
    first !== undefined &&
    value.items.every(
      (item) =>
        item.kind === first.kind &&
        ((item.kind === "array" && item.items.length > 1) || (item.kind === "object" && item.entries.length > 1))
    )
  )
}

/** One-line text, or `undefined` when an object in it is written across lines. */
function flatText(value: Layout): string | undefined {
  if (value.kind === "scalar") {
    return value.text
  }
  if (value.kind === "array") {
    const items = value.items.map(flatText)
    return items.every((item) => item !== undefined) ? `[${items.join(", ")}]` : undefined
  }
  if (value.entries.length === 0) {
    return "{}"
  }
  if (value.expanded) {
    return undefined
  }
  const entries = value.entries.map(([key, item]) => {
    const flat = flatText(item)
    return flat === undefined ? undefined : `${key}: ${flat}`
  })
  return entries.every((entry) => entry !== undefined) ? `{ ${entries.join(", ")} }` : undefined
}

/** Numbers packed onto lines that fit, each followed by a comma but the last. */
function fill(items: Layout[], inner: string, layout: JsonLayout): string[] {
  const lines: string[] = []
  let line = ""
  items.forEach((item, index) => {
    const piece = `${flatText(item) ?? ""}${index < items.length - 1 ? "," : ""}`
    if (line === "") {
      line = `${inner}${piece}`
    } else if (width(line) + 1 + piece.length <= layout.printWidth) {
      line = `${line} ${piece}`
    } else {
      lines.push(line)
      line = `${inner}${piece}`
    }
  })
  lines.push(line)
  return lines
}

function fits(at: Position, text: string, layout: JsonLayout): boolean {
  return !text.includes("\n") && at.column + text.length + at.trailing <= layout.printWidth
}

/** Display width, with a tab as two columns, as the formatters count it by default. */
function width(text: string): number {
  return text.length + (text.match(/\t/g)?.length ?? 0)
}
