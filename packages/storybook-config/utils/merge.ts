/**
 * Deep-merges configuration objects so consumer config is *combined* with the
 * base rather than replacing it:
 * - Arrays are concatenated (base entries first, then the consumer's).
 * - Plain objects are merged recursively, key by key.
 * - Everything else (strings, numbers, RegExp, functions, ...) is overridden.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

export function deepMerge<T>(base: T, override: unknown): T {
  if (override === undefined) {
    return base
  }
  if (Array.isArray(base) && Array.isArray(override)) {
    return [...base, ...override] as T
  }
  if (isPlainObject(base) && isPlainObject(override)) {
    const result: Record<string, unknown> = { ...base }
    for (const key of Object.keys(override)) {
      result[key] = key in base ? deepMerge(base[key], override[key]) : override[key]
    }
    return result as T
  }
  return override as T
}
