import { normalizeText } from "../ownership/text.js"

/** `.env`-style files: `NAME=value` lines, with `#` comments. Edits keep every other line as it is. */
export function readEnv(text: string | undefined): Map<string, string> {
  const result = new Map<string, string>()
  for (const line of envLines(text)) {
    const parsed = parseEnvLine(line)
    if (parsed) {
      result.set(parsed.name, parsed.value)
    }
  }
  return result
}

/** Sets a key's value. A new key goes at the end, after a `# description` comment when one is given. */
export function setEnvValue(text: string | undefined, name: string, value: string, description?: string): string {
  const lines = envLines(text)
  const index = lines.findIndex((line) => parseEnvLine(line)?.name === name)
  const rendered = `${name}=${formatEnvValue(name, value)}`
  if (index !== -1) {
    lines[index] = rendered
    return joinEnv(lines)
  }
  return joinEnv([...lines, ...(description ? [`# ${description}`] : []), rendered])
}

/** Removes a key's line, and the comment above it when it matches the description. */
export function removeEnvKey(text: string | undefined, name: string, description?: string): string {
  const lines = envLines(text)
  const index = lines.findIndex((line) => parseEnvLine(line)?.name === name)
  if (index === -1) {
    return joinEnv(lines)
  }
  const commentAbove = description !== undefined && lines[index - 1] === `# ${description}`
  lines.splice(commentAbove ? index - 1 : index, commentAbove ? 2 : 1)
  return joinEnv(lines)
}

function envLines(text: string | undefined): string[] {
  const normalized = text === undefined ? "" : normalizeText(text)
  return normalized === "" ? [] : normalized.slice(0, -1).split("\n")
}

function joinEnv(lines: readonly string[]): string {
  return lines.length === 0 ? "" : `${lines.join("\n")}\n`
}

function parseEnvLine(line: string): { name: string; value: string } | undefined {
  const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(line)
  const name = match?.[1]
  if (!name) {
    return undefined
  }
  const raw = (match[2] ?? "").trim()
  const quote = raw[0]
  const end = quote === "'" || quote === '"' || quote === "`" ? raw.indexOf(quote, 1) : -1
  if (end > 0) {
    const inner = raw.slice(1, end)
    // As in dotenv: double quotes expand \n and \r, and single quotes and backticks keep everything as written.
    return { name, value: quote === '"' ? inner.replaceAll("\\n", "\n").replaceAll("\\r", "\r") : inner }
  }
  // An unquoted value ends where a comment starts.
  const comment = raw.search(/\s#/)
  return { name, value: comment === -1 ? raw : raw.slice(0, comment).trimEnd() }
}

/** Quotes a value so dotenv and Node's `--env-file` read it back unchanged. None of the styles needs escapes. */
function formatEnvValue(name: string, value: string): string {
  if (!/[\s#"'`=\\]/.test(value)) {
    return value
  }
  if (!value.includes("'") && !value.includes("\n")) {
    return `'${value}'`
  }
  if (!value.includes('"') && !value.includes("\\")) {
    return `"${value.replaceAll("\n", "\\n")}"`
  }
  if (!value.includes("`") && !value.includes("\n")) {
    return `\`${value}\``
  }
  throw new Error(`${name}'s value can't be written to an env file: it has a line break and quotes or backslashes.`)
}
