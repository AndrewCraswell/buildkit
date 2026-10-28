import { z } from "zod"

const targetRef = z.object({ id: z.string().min(1), mode: z.string().min(1) })

/** `buildkit.jsonc`: the inputs. You can edit it, and it merges like `package.json`. Unknown keys are kept. */
export const projectConfigSchema = z.looseObject({
  $schema: z.string().optional(),
  catalog: z.string().min(1),
  name: z.string().min(1),
  template: z.string().min(1),
  target: targetRef,
  /** Explicitly chosen add-ons and their options, keyed by id. Add-ons pulled in by `requires` aren't listed. */
  addons: z.record(z.string(), z.record(z.string(), z.unknown())),
  /** Questions answered "no": `slot:<id>` or an add-on id. */
  declined: z.array(z.string()).optional()
})
export type ProjectConfig = z.infer<typeof projectConfigSchema>

const provenance = z.enum(["introduced", "adopted"])

const keyState = z.object({ base: z.unknown(), provenance })
export type KeyState = z.infer<typeof keyState>

export const sharedFormats = ["json", "yaml", "lines", "env"] as const
export type SharedFormat = (typeof sharedFormats)[number]

const ownedEntry = z.object({
  class: z.literal("owned"),
  /** Hash of what the engine generated. */
  genHash: z.string(),
  /** Hash of what was on disk after the last apply. It differs from `genHash` when you kept your own version. */
  diskHash: z.string(),
  contributors: z.array(z.string())
})
const seedEntry = z.object({ class: z.literal("seed"), genHash: z.string(), diskHash: z.string() })
const sampleEntry = z.object({ class: z.literal("sample"), genHash: z.string() })
const sharedEntry = z.object({
  class: z.literal("shared"),
  format: z.enum(sharedFormats),
  /** Base value and provenance per key: a JSON pointer, an env name, or a line. */
  keys: z.record(z.string(), keyState),
  /** Items appended to arrays, keyed by pointer, then by item identity. */
  items: z.record(z.string(), z.record(z.string(), keyState)).optional()
})

export const lockFileEntrySchema = z.discriminatedUnion("class", [ownedEntry, seedEntry, sampleEntry, sharedEntry])
export type LockFileEntry = z.infer<typeof lockFileEntrySchema>
export type SharedLockEntry = z.infer<typeof sharedEntry>

export const lockSchemaVersion = 1

/** `.buildkit/lock.json`: derived state. It's rebuilt by `sync` and never edited by hand. */
export const lockSchema = z.object({
  schemaVersion: z.literal(lockSchemaVersion),
  engine: z.string(),
  catalog: z.object({ id: z.string(), version: z.string(), integrity: z.string().optional() }),
  /** The selection as applied, so the old baseline can be rendered. */
  project: z.object({ name: z.string(), template: z.string(), target: targetRef, declined: z.array(z.string()) }),
  addons: z.record(
    z.string(),
    z.object({
      version: z.string(),
      options: z.record(z.string(), z.unknown()),
      explicit: z.boolean(),
      /** Add-ons that pulled this one in through `requires`. */
      by: z.array(z.string())
    })
  ),
  files: z.record(z.string(), lockFileEntrySchema),
  /** Seed and sample files you deleted. They stay deleted. */
  deleted: z.array(z.string()),
  lastApply: z.object({ fingerprint: z.string() }).optional()
})
export type Lock = z.infer<typeof lockSchema>
