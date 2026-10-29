import {
  applyEdits,
  createScanner,
  findNodeAtLocation,
  modify,
  parseTree,
  printParseErrorCode,
  type Edit,
  type FormattingOptions,
  type Node,
  type ParseError
} from "jsonc-parser"
import { formatPointer, isUnsafeKey } from "../plan/json.js"
import { defaultJsonLayout, printJson, relayoutJson, type JsonLayout } from "./layout.js"

export type JsonPath = (string | number)[]

export type JsonParseResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: "invalid"; message: string }
  | { ok: false; reason: "unsafe-key"; pointer: string }

/**
 * Parses JSON or JSONC by walking jsonc-parser's tree. A `__proto__`, `constructor` or `prototype` key anywhere is
 * refused: jsonc-parser 3.3.1's `parse()` would assign `__proto__` as the prototype. Empty text parses as `undefined`.
 */
export function parseJsonc(text: string): JsonParseResult {
  if (text.trim() === "") {
    return { ok: true, value: undefined }
  }
  const errors: ParseError[] = []
  const tree = parseTree(text, errors, { allowTrailingComma: true, disallowComments: false })
  const [first] = errors
  if (first || !tree) {
    return { ok: false, reason: "invalid", message: first ? describeError(text, first) : "The file isn't JSON." }
  }
  const unsafe = findUnsafeKey(tree, [])
  if (unsafe) {
    return { ok: false, reason: "unsafe-key", pointer: formatPointer(unsafe) }
  }
  return { ok: true, value: nodeValue(tree) }
}

function describeError(text: string, error: ParseError): string {
  const line = text.slice(0, error.offset).split("\n").length
  return `${printParseErrorCode(error.error)} on line ${line}`
}

function findUnsafeKey(node: Node, path: string[]): string[] | undefined {
  if (node.type === "object") {
    for (const property of node.children ?? []) {
      const [keyNode, valueNode] = property.children ?? []
      const key = typeof keyNode?.value === "string" ? keyNode.value : ""
      if (isUnsafeKey(key)) {
        return [...path, key]
      }
      const nested = valueNode ? findUnsafeKey(valueNode, [...path, key]) : undefined
      if (nested) {
        return nested
      }
    }
  }
  if (node.type === "array") {
    for (const [index, child] of (node.children ?? []).entries()) {
      const nested = findUnsafeKey(child, [...path, String(index)])
      if (nested) {
        return nested
      }
    }
  }
  return undefined
}

function nodeValue(node: Node): unknown {
  switch (node.type) {
    case "object": {
      const result: Record<string, unknown> = {}
      for (const property of node.children ?? []) {
        const [keyNode, valueNode] = property.children ?? []
        if (typeof keyNode?.value === "string" && valueNode) {
          result[keyNode.value] = nodeValue(valueNode)
        }
      }
      return result
    }
    case "array":
      return (node.children ?? []).map((child) => nodeValue(child))
    default:
      return node.value
  }
}

/** Indentation and line endings of an existing document, so edits match it. */
export function jsonFormatting(text: string | undefined): FormattingOptions {
  const eol = text?.includes("\r\n") ? "\r\n" : "\n"
  const indented = text?.split(/\r?\n/).find((line) => /^[\t ]+["}\]]/.test(line))
  if (indented?.startsWith("\t")) {
    return { insertSpaces: false, tabSize: 1, eol }
  }
  const spaces = indented ? (/^ +/.exec(indented)?.[0].length ?? 2) : 2
  return { insertSpaces: true, tabSize: spaces, eol }
}

/** One level of the document's indentation. */
function indentUnit(formatting: FormattingOptions): string {
  return formatting.insertSpaces === false ? "\t" : " ".repeat(formatting.tabSize ?? 2)
}

/** Applies an edit, then lays out the value at `relayoutAt` and what around it the edit can change. */
function edit(
  text: string,
  path: JsonPath,
  value: unknown,
  relayoutAt: JsonPath,
  layout: JsonLayout,
  isArrayInsertion = false
): string {
  const formattingOptions = jsonFormatting(text)
  const edits = modify(text, path, value, { formattingOptions, isArrayInsertion })
  return relayoutJson(
    applyEdits(text, edits),
    relayoutAt,
    layout,
    indentUnit(formattingOptions),
    formattingOptions.eol ?? "\n",
    rewritten(edits)
  )
}

/** The range of the edited text that `edits` wrote. */
function rewritten(edits: Edit[]): { start: number; end: number } | undefined {
  let shift = 0
  let range: { start: number; end: number } | undefined
  for (const edit of [...edits].sort((left, right) => left.offset - right.offset)) {
    const start = edit.offset + shift
    const end = start + edit.content.length
    range = { start: Math.min(range?.start ?? start, start), end: Math.max(range?.end ?? end, end) }
    shift += edit.content.length - edit.length
  }
  return range
}

/**
 * Sets a value, creating missing parent objects. Comments and formatting elsewhere are kept, and the value is laid out
 * as the project's formatter prints it (see `JsonLayout`).
 */
export function setJson(text: string, path: JsonPath, value: unknown, layout = defaultJsonLayout): string {
  return edit(text, path, value, path, layout)
}

/**
 * Removes a value. An item is cut from the array by its own text, since jsonc-parser's removal of a last item assumes
 * the array is across lines, and the array is laid out again, so a list that now fits goes on one line. An object left
 * empty becomes `{}`.
 */
export function removeJson(text: string, path: JsonPath, layout = defaultJsonLayout): string {
  const parentPath = path.slice(0, -1)
  const last = path.at(-1)
  const formatting = jsonFormatting(text)
  const unit = indentUnit(formatting)
  const eol = formatting.eol ?? "\n"
  const tree = parseTree(text, [], { allowTrailingComma: true })
  const parent = tree ? findNodeAtLocation(tree, parentPath) : undefined
  if (typeof last === "number" && parent?.type === "array") {
    const items = parent.children ?? []
    const item = items[last]
    if (!item) {
      return text
    }
    let cut = text
    for (const [start, end] of itemRanges(text, parent, last).sort((left, right) => right[0] - left[0])) {
      cut = `${cut.slice(0, start)}${cut.slice(end)}`
    }
    return relayoutJson(cut, parentPath, layout, unit, eol)
  }
  const edits = modify(text, path, undefined, { formattingOptions: formatting })
  const removed = relayoutJson(applyEdits(text, edits), undefined, layout, unit, eol, rewritten(edits))
  const removedTree = parseTree(removed, [], { allowTrailingComma: true })
  const object = removedTree ? findNodeAtLocation(removedTree, parentPath) : undefined
  if (object?.type === "object" && (object.children ?? []).length === 0 && object.length > 2) {
    const inside = removed.slice(object.offset + 1, object.offset + object.length - 1)
    if (inside.trim() === "") {
      return `${removed.slice(0, object.offset)}{}${removed.slice(object.offset + object.length)}`
    }
  }
  return removed
}

// jsonc-parser's SyntaxKind is a const enum, which isolated modules can't read.
const commaToken = 5
const skippedTokens = new Set([12, 13, 14, 15])

/** The offset of the comma after `offset`, past whitespace and comments, or -1 when something else comes first. */
function commaAfter(text: string, offset: number): number {
  const scanner = createScanner(text, false)
  scanner.setPosition(offset)
  for (let token: number = scanner.scan(); skippedTokens.has(token) || token === commaToken; token = scanner.scan()) {
    if (token === commaToken) {
      return scanner.getTokenOffset()
    }
  }
  return -1
}

/** The end of the whitespace from `offset`, or its start when `back`. */
function pastWhitespace(text: string, offset: number, back = false): number {
  let at = offset
  while (back ? /\s/.test(text[at - 1] ?? "") : /\s/.test(text[at] ?? "")) {
    at += back ? -1 : 1
  }
  return at
}

/**
 * The ranges to cut to remove an item: the item and one comma beside it, with the whitespace between them. Comments
 * between items stay, so no comment is lost, and jsonc-parser's assumption that the array is across lines doesn't
 * apply.
 */
function itemRanges(text: string, array: Node, index: number): [number, number][] {
  const items = array.children ?? []
  const item = items[index]
  if (!item) {
    return []
  }
  const end = item.offset + item.length
  const after = commaAfter(text, end)
  const previous = items[index - 1]
  if (items[index + 1] && after !== -1) {
    return [
      [item.offset, end],
      [after, pastWhitespace(text, after + 1)]
    ]
  }
  const ranges: [number, number][] = [[pastWhitespace(text, item.offset, true), end]]
  if (after !== -1) {
    ranges.push([after, after + 1])
  }
  const before = previous ? commaAfter(text, previous.offset + previous.length) : -1
  if (before !== -1) {
    ranges.push([before, before + 1])
  }
  return ranges
}

export function insertJsonArrayItem(
  text: string,
  path: JsonPath,
  index: number,
  value: unknown,
  layout = defaultJsonLayout
): string {
  return edit(text, [...path, index], value, path, layout, true)
}

export function replaceJsonArrayItem(
  text: string,
  path: JsonPath,
  index: number,
  value: unknown,
  layout = defaultJsonLayout
): string {
  return edit(text, [...path, index], value, path, layout)
}

/** A new JSON file: two-space indentation, laid out as the project's formatter prints it, and a final newline. */
export function stringifyJson(value: unknown, layout = defaultJsonLayout): string {
  return `${printJson(value, { layout })}\n`
}
