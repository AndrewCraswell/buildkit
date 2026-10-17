export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

export function assertKey(key: string) {
  if (key === "__proto__" || key === "constructor" || key === "prototype") {
    throw new TypeError(`Unsafe preference key: ${key}`)
  }
}

/** Validate before serialization so JSON.stringify cannot silently lose data. */
export function copyJson(value: unknown, ancestors = new Set<object>()): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (typeof value !== "object" || value === null) {
    throw new TypeError("Preferences must contain JSON-compatible values")
  }
  if (ancestors.has(value)) {
    throw new TypeError("Circular preference value")
  }
  ancestors.add(value)
  try {
    if (Array.isArray(value)) {
      const result: JsonValue[] = []
      for (const item of value) {
        result.push(copyJson(item, ancestors))
      }
      Object.freeze(result)
      return result
    }
    const prototype: unknown = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("Preferences require plain JSON objects")
    }
    if (Object.getOwnPropertySymbols(value).length) {
      throw new TypeError("Symbol keys are not supported")
    }
    const result: Record<string, JsonValue> = {}
    for (const [key, item] of Object.entries(value)) {
      assertKey(key)
      result[key] = copyJson(item, ancestors)
    }
    Object.freeze(result)
    return result
  } finally {
    ancestors.delete(value)
  }
}

export function copyObject(value: unknown): Record<string, JsonValue> {
  const copy = copyJson(value)
  if (copy === null || typeof copy !== "object" || Array.isArray(copy)) {
    throw new TypeError("Preferences JSON must be an object")
  }
  return copy
}

export function matchesDefault(value: JsonValue, fallback: JsonValue) {
  if (fallback === null) {
    return true
  } // A null default cannot reveal the intended type.
  if (value === null) {
    return false
  }
  if (Array.isArray(fallback)) {
    return Array.isArray(value)
  }
  if (Array.isArray(value)) {
    return false
  }
  return typeof value === typeof fallback
}
