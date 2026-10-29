import { normalizeText } from "../ownership/text.js"

/** Line-list files such as `.gitignore`: one entry per line, compared without surrounding whitespace. */
export function readLines(text: string | undefined): string[] {
  if (text === undefined) {
    return []
  }
  const normalized = normalizeText(text)
  return normalized === "" ? [] : normalized.slice(0, -1).split("\n")
}

export function hasLine(text: string | undefined, line: string): boolean {
  return readLines(text).some((existing) => existing.trim() === line.trim())
}

/** Appends lines that aren't already present, in order. */
export function appendLines(text: string | undefined, lines: readonly string[]): string {
  const existing = readLines(text)
  const present = new Set(existing.map((line) => line.trim()))
  const added = lines.filter((line) => {
    const key = line.trim()
    if (present.has(key)) {
      return false
    }
    present.add(key)
    return true
  })
  return joinLines([...existing, ...added])
}

export function removeLines(text: string | undefined, lines: readonly string[]): string {
  const removed = new Set(lines.map((line) => line.trim()))
  return joinLines(readLines(text).filter((line) => !removed.has(line.trim())))
}

function joinLines(lines: readonly string[]): string {
  return lines.length === 0 ? "" : `${lines.join("\n")}\n`
}

const secretLikePatterns = [/^\.env/, /\*\.pem$/, /\*\.key$/, /^\.dev\.vars/]

/** Ignore patterns that keep secrets out of git. Removing one always asks. */
export function isSecretLikePattern(line: string): boolean {
  const trimmed = line.trim().replace(/^\//, "")
  return secretLikePatterns.some((pattern) => pattern.test(trimmed))
}
