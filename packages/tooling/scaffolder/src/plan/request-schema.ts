import { z } from "zod"
import type { PlanRequest } from "./types.js"

const options = z.record(z.string(), z.record(z.string(), z.unknown()))

const answers = z.object({
  template: z.string(),
  mode: z.string().optional(),
  name: z.string().optional(),
  slots: z.record(z.string(), z.string().nullable()).optional(),
  optional: z.array(z.string()).optional(),
  options: options.optional(),
  adopt: z.boolean().optional()
})

const intent = z.discriminatedUnion("command", [
  z.object({ command: z.literal("init"), answers }),
  z.object({ command: z.literal("add"), addons: z.array(z.string()), replace: z.array(z.string()), options }),
  z.object({ command: z.literal("config"), options, addons: z.array(z.string()).optional() }),
  z.object({ command: z.literal("upgrade"), addons: z.array(z.string()).optional() }),
  z.object({ command: z.literal("sync"), addons: z.array(z.string()).optional() })
])

/** Validates a request from an untrusted source, such as a plan file or the dashboard. */
export const planRequestSchema: z.ZodType<PlanRequest> = z.object({
  intent,
  resolve: z
    .record(z.string(), z.union([z.enum(["keep-current", "take-incoming"]), z.object({ content: z.string() })]))
    .optional(),
  conflictStyle: z.enum(["stop", "markers"]).optional(),
  catalogVersion: z.string().optional()
})
