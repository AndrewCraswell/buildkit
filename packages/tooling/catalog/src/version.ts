import { readFileSync } from "node:fs"
import { z } from "zod"

/**
 * The catalog's version, read from its own package.json. The lock records it, and `buildkit catalog fetch` installs
 * this package at that version to render an old baseline, so the two must always match.
 */
export const catalogVersion = z
  .object({ version: z.string() })
  .parse(JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"))).version
