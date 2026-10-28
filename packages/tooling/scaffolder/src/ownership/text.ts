/** Text normalization and hashing. Hashes and merges ignore line endings, a BOM and the final newline. */

const bom = "﻿"

export interface TextStyle {
  eol: "\n" | "\r\n"
  bom: boolean
}

/** Strips a BOM, converts line endings to LF, and ends non-empty text with exactly one newline. */
export function normalizeText(text: string): string {
  const withoutBom = text.startsWith(bom) ? text.slice(bom.length) : text
  const trimmed = withoutBom.replace(/\r\n?/g, "\n").replace(/\n+$/, "")
  return trimmed === "" ? "" : `${trimmed}\n`
}

/** The line endings and BOM of an existing file, so writes keep them. New files use LF without a BOM. */
export function textStyle(existing: string | undefined): TextStyle {
  if (existing === undefined) {
    return { eol: "\n", bom: false }
  }
  return { eol: existing.includes("\r\n") ? "\r\n" : "\n", bom: existing.startsWith(bom) }
}

export function applyStyle(normalized: string, style: TextStyle): string {
  const withEol = style.eol === "\r\n" ? normalized.replaceAll("\n", "\r\n") : normalized
  return style.bom ? `${bom}${withEol}` : withEol
}

/** SHA-256 of the normalized text, as hex. Uses Web Crypto, so it runs in Node, Workers and browsers. */
export async function hashText(text: string): Promise<string> {
  return sha256(normalizeText(text))
}

export async function sha256(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

export function countLines(text: string): number {
  const normalized = normalizeText(text)
  return normalized === "" ? 0 : normalized.split("\n").length - 1
}

const markerPattern = /^(?:<{7}|={7}|>{7})(?: |$)/m

/** True when the text holds git-style conflict markers. */
export function hasConflictMarkers(text: string): boolean {
  return markerPattern.test(normalizeText(text))
}
