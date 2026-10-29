import {
  applyEdits,
  modify,
  parseTree,
  printParseErrorCode,
  type FormattingOptions,
  type Node,
  type ParseError
} from "jsonc-parser"
import { formatPointer, isUnsafeKey } from "../plan/json.js"

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

/** Sets a value, creating missing parent objects. Comments and formatting elsewhere are kept. */
export function setJson(text: string, path: JsonPath, value: unknown): string {
  return applyEdits(text, modify(text, path, value, { formattingOptions: jsonFormatting(text) }))
}

export function removeJson(text: string, path: JsonPath): string {
  return applyEdits(text, modify(text, path, undefined, { formattingOptions: jsonFormatting(text) }))
}

export function insertJsonArrayItem(text: string, path: JsonPath, index: number, value: unknown): string {
  return applyEdits(
    text,
    modify(text, [...path, index], value, { formattingOptions: jsonFormatting(text), isArrayInsertion: true })
  )
}

export function replaceJsonArrayItem(text: string, path: JsonPath, index: number, value: unknown): string {
  return applyEdits(text, modify(text, [...path, index], value, { formattingOptions: jsonFormatting(text) }))
}

/** A new JSON file: two-space indentation and a final newline. */
export function stringifyJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}
