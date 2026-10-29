import { isAlias, isPair, isScalar, isSeq, parseDocument, visit } from "yaml"
import { formatPointer, isUnsafeKey } from "../plan/json.js"
import type { JsonParseResult, JsonPath } from "./json.js"

/**
 * YAML documents edited on the `yaml` Document API, which keeps comments and blank lines. It re-indents on output, so
 * callers only write when a value changes.
 */
export function parseYaml(text: string): JsonParseResult {
  if (text.trim() === "") {
    return { ok: true, value: undefined }
  }
  const document = parseDocument(text)
  const [first] = document.errors
  if (first) {
    return { ok: false, reason: "invalid", message: first.message }
  }
  // A key may be an alias, `*k: 1`, so resolve it before checking: toJS() would create an own `__proto__` from it.
  const keyText = (key: unknown): string | undefined => {
    const node = isAlias(key) ? key.resolve(document) : key
    return isScalar(node) ? String(node.value) : undefined
  }
  let unsafe: string | undefined
  visit(document, {
    Pair(_, pair, path) {
      const key = keyText(pair.key)
      if (key !== undefined && isUnsafeKey(key)) {
        const parents = path.flatMap((node) => {
          const parent = isPair(node) ? keyText(node.key) : undefined
          return parent === undefined ? [] : [parent]
        })
        unsafe = formatPointer([...parents, key])
        return visit.BREAK
      }
      return undefined
    }
  })
  if (unsafe) {
    return { ok: false, reason: "unsafe-key", pointer: unsafe }
  }
  const value: unknown = document.toJS()
  return { ok: true, value }
}

export function setYaml(text: string, path: JsonPath, value: unknown): string {
  const document = parseDocument(text)
  document.setIn(path, document.createNode(value))
  return document.toString()
}

export function removeYaml(text: string, path: JsonPath): string {
  const document = parseDocument(text)
  document.deleteIn(path)
  return document.toString()
}

export function insertYamlArrayItem(text: string, path: JsonPath, index: number, value: unknown): string {
  const document = parseDocument(text)
  const sequence = path.length === 0 ? document.contents : document.getIn(path, true)
  if (isSeq(sequence)) {
    sequence.items.splice(index, 0, document.createNode(value))
  } else {
    document.setIn(path, document.createNode([value]))
  }
  return document.toString()
}

export function replaceYamlArrayItem(text: string, path: JsonPath, index: number, value: unknown): string {
  const document = parseDocument(text)
  document.setIn([...path, index], document.createNode(value))
  return document.toString()
}
