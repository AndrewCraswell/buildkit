// Better Apps' own code. Upstream encodes JSON and lists as text for every database without native JSON or arrays, so a
// Drizzle column that encodes them itself, such as the JSON-mode text columns `better-apps generate` writes for SQLite
// and D1, stored a JSON string of the JSON. Here the Drizzle column decides.

/**
 * Whether a Drizzle column converts values to and from JSON itself: json and jsonb, SQLite text and blob in JSON mode,
 * and Postgres arrays. Drizzle 0.x names those data types `"json"` and `"array"`.
 */
function encodesJson(column: unknown): boolean {
  const dataType = (column as { dataType?: unknown } | undefined)?.dataType
  return dataType === "json" || dataType === "array"
}

/** Encodes an object or list as JSON text for a column that stores plain text. Other values are unchanged. */
export function toDriverJson(value: unknown, column: unknown): unknown {
  return value !== null && typeof value === "object" && !encodesJson(column) ? JSON.stringify(value) : value
}

/**
 * Parses JSON text read from a column that stores plain text. MySQL's json column only encodes: mysql2 parses it on
 * read, but other drivers return the text, so its strings are parsed too. A string that isn't JSON is returned as is.
 */
export function fromDriverJson(value: unknown, column: unknown): unknown {
  const columnType = (column as { columnType?: unknown } | undefined)?.columnType
  if (typeof value !== "string" || (encodesJson(column) && columnType !== "MySqlJson")) {
    return value
  }
  try {
    return JSON.parse(value) as unknown
  } catch {
    return value
  }
}
