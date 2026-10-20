import { z } from "zod"

const label = z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/, "Use a lowercase DNS label")
const domain = z
  .string()
  .max(190)
  .refine(
    (value) => value.split(".").every((part) => label.safeParse(part).success),
    "Use a lowercase domain without a protocol or port"
  )
const argument = z
  .string()
  .min(1)
  .refine((value) => !value.includes("\0"), "NUL is not allowed")
const command = z.array(argument).min(1)
const routePath = z
  .string()
  .regex(/^\/(?!\/)/, "Use an absolute path starting with one slash")
  .refine(
    (value) => !/[?#\\%]/.test(value) && !value.split("/").some((part) => part === "." || part === ".."),
    "Use a plain path without query, encoding, or traversal"
  )
const environment = z.record(
  z
    .string()
    .regex(/^[A-Za-z_][A-Za-z0-9_]*$/)
    .refine((key) => !/^(PORT|HOST|PORTLESS.*|BUILDKIT_.*)$/.test(key), "Runtime-owned variable"),
  z.string()
)

export const endpointSchema = z
  .strictObject({
    kind: z.enum(["app", "storybook", "e2e"]).default("app"),
    cwd: z.string().default("."),
    name: z.string().default("{project}-{worktree}-{service}"),
    primaryName: z.string().default("{project}-{service}"),
    command: command.optional(),
    script: argument.optional(),
    framework: z.enum(["next", "vite", "storybook", "custom"]).default("custom"),
    env: environment.default({}),
    auth: z.array(routePath).default([]),
    tunnel: z
      .strictObject({
        command,
        paths: z.array(routePath).min(1),
        publicUrl: z
          .url()
          .refine(
            (value) =>
              new URL(value).protocol === "https:" &&
              new URL(value).pathname === "/" &&
              !new URL(value).search &&
              !new URL(value).username &&
              !new URL(value).password &&
              !new URL(value).hash,
            "Use an HTTPS origin"
          )
          .optional()
      })
      .optional()
  })
  .refine((value) => Boolean(value.command) !== Boolean(value.script), "Set exactly one of command or script")

export const configSchema = z
  .strictObject({
    $schema: z.string().optional(),
    project: label,
    domain: domain.default("localhost"),
    proxy: z
      .strictObject({
        domains: z.array(domain).min(1).optional(),
        port: z.number().int().min(1).max(65535).default(443),
        https: z.boolean().default(true),
        syncHosts: z.boolean().default(true)
      })
      .default({ port: 443, https: true, syncHosts: true }),
    packageManager: z.enum(["npm", "pnpm", "yarn", "bun"]).default("npm"),
    endpoints: z
      .record(label, endpointSchema)
      .refine((value) => Object.keys(value).length > 0, "Configure at least one endpoint")
  })
  .refine(
    (value) => !value.proxy.domains || value.proxy.domains.includes(value.domain),
    "proxy.domains must include domain"
  )

export type DevDomainsConfig = z.input<typeof configSchema>
export type ResolvedConfig = z.output<typeof configSchema>
export type Endpoint = ResolvedConfig["endpoints"][string]

/** Typed authoring helper. Runtime loading uses the same schema. */
export function defineConfig(config: DevDomainsConfig): DevDomainsConfig {
  configSchema.parse(config)
  return config
}
