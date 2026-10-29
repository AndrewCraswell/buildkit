import { z } from "zod"
import {
  defineAddon,
  defineCatalog,
  definePoint,
  defineSlot,
  defineTarget,
  defineTemplate
} from "../manifest/define.js"
import type { CatalogManifest, Contribution } from "../manifest/types.js"
import type { Answers } from "../manifest/types.js"
import { plan, type PlanInput } from "../plan/plan.js"
import { memoryTree } from "../plan/tree.js"
import type { Plan, PlanRequest } from "../plan/types.js"
import { defineSettings } from "../state/settings.js"

export const settings = defineSettings({ product: "fixture", schemaUrl: "https://example.test/fixture.json" })

const vitePlugins = definePoint({
  id: "vite.plugins",
  version: 1,
  kind: "list",
  file: "src/generated/fixture/config.ts",
  export: "vitePlugins",
  title: "Vite plugins"
})
const providers = definePoint({
  id: "app.providers",
  version: 1,
  kind: "nest",
  file: "src/generated/fixture/client.ts",
  export: "providers"
})
const envSchema = definePoint({
  id: "env.schema",
  version: 1,
  kind: "map",
  file: "src/generated/fixture/server.ts",
  export: "envSchema",
  payload: z.object({ type: z.string() })
})

const mainV1 = [
  'import { providers } from "./generated/fixture/client"',
  "",
  "export function start() {",
  "  return providers.framework.length",
  "}",
  ""
].join("\n")
const mainV2 = [
  'import { providers } from "./generated/fixture/client"',
  "",
  "export function start() {",
  "  return providers.framework.length",
  "}",
  "",
  "export const ready = true",
  ""
].join("\n")

/**
 * The fixture catalog: a base target with two modes; a template with a required add-on, an optional add-on, an
 * optional database slot with two choices and a default, and a required UI slot; and an add-on that requires another.
 * Version 2 changes the target's starter file, renames an option with a migration, and adds a codemod and an agent task.
 */
export function fixtureCatalog(version: 1 | 2 = 1): CatalogManifest {
  const web = defineTarget({
    id: "web",
    title: "Web app",
    description: "A Vite web app",
    family: "vite-react",
    modes: [
      { id: "ssr", title: "Server-rendered", renderModel: "ssr-loader", facets: ["vite", "ssr", "react"] },
      { id: "spa", title: "Single-page", renderModel: "spa", facets: ["vite", "spa", "react"] }
    ],
    points: [vitePlugins, providers, envSchema],
    base(ctx) {
      const contributions: Contribution[] = [
        { kind: "json", path: "package.json", pointer: "/name", op: "set", value: ctx.project.name },
        { kind: "json", path: "package.json", pointer: "/private", op: "set", value: true },
        { kind: "json", path: "package.json", pointer: "/type", op: "set", value: "module" },
        { kind: "dependency", name: "react", version: ctx.version("react") },
        { kind: "dependency", name: "vite", version: ctx.version("vite"), dev: true },
        { kind: "script", name: "dev", command: "vite" },
        {
          kind: "json",
          path: "tsconfig.json",
          pointer: "/compilerOptions",
          op: "merge",
          value: { strict: true, module: "ESNext" }
        },
        { kind: "json", path: "tsconfig.json", pointer: "/include", op: "append", value: ["src"] },
        { kind: "file", path: "src/main.ts", content: version === 1 ? mainV1 : mainV2, ownership: "seed" },
        {
          kind: "file",
          path: "vite.config.ts",
          content:
            'import { vitePlugins } from "./src/generated/fixture/config"\n\nexport default { plugins: [...vitePlugins.pre, ...vitePlugins.framework, ...vitePlugins.post] }\n',
          ownership: "seed"
        },
        {
          kind: "file",
          path: "AGENTS.md",
          content: `# ${ctx.project.name}\n\nRead the README first.\n`,
          ownership: "sample"
        },
        { kind: "lines", path: ".gitignore", lines: ["node_modules", "dist", ".env"] },
        { kind: "command", run: "pnpm install", when: "after-apply", why: "Installs the new dependencies." }
      ]
      if (ctx.target.has("ssr")) {
        contributions.push({
          kind: "file",
          path: "src/server.ts",
          content: "export const server = true\n",
          ownership: "owned"
        })
      }
      return contributions
    },
    adopt(tree) {
      const existing = tree.read("README.md")
      if (existing !== undefined && !existing.includes("Managed by fixture")) {
        tree.write("README.md", `${existing.trimEnd()}\n\nManaged by fixture.\n`)
      }
    }
  })
  const lintOptions =
    version === 1
      ? z.object({ strict: z.boolean().default(true) })
      : z.object({ level: z.enum(["recommended", "strict"]).default("strict") })
  const lint = defineAddon({
    id: "@fixture/lint",
    version: version === 1 ? "1.0.0" : "1.1.0",
    title: "Lint",
    description: "oxlint with the house rules",
    options: lintOptions,
    contribute: (ctx) => [
      { kind: "dependency", name: "oxlint", version: ctx.version("oxlint"), dev: true },
      { kind: "script", name: "lint", command: "oxlint" },
      { kind: "file", path: ".oxlintrc.json", content: `${JSON.stringify(ctx.options, null, 2)}\n`, ownership: "owned" }
    ],
    migrations:
      version === 1
        ? []
        : [
            {
              version: "1.1.0",
              kind: "options",
              description: "Replaces strict with level.",
              options: (old) => ({ level: old.strict === false ? "recommended" : "strict" })
            },
            {
              version: "1.1.0",
              kind: "codemod",
              description: "Renames the lint script in your own scripts file.",
              run(tree) {
                const text = tree.read("scripts/ci.sh")
                if (text !== undefined) {
                  tree.write("scripts/ci.sh", text.replaceAll("npm run lint", "pnpm lint"))
                }
              }
            },
            {
              version: "1.1.0",
              kind: "agent",
              description: "Review lint suppressions.",
              prompt: "Remove suppressions the new rules make unnecessary."
            }
          ]
  })
  const sqlite = defineAddon({
    id: "@fixture/db-sqlite",
    version: "1.0.0",
    title: "SQLite",
    description: "A local SQLite database",
    slot: "database",
    provides: { database: { dialect: "sqlite" } },
    contribute: (ctx) => [
      { kind: "dependency", name: "drizzle-orm", version: ctx.version("drizzle-orm") },
      {
        kind: "env",
        name: "DATABASE_URL",
        scope: "server",
        secret: false,
        required: true,
        description: "Database file",
        example: "file:local.db"
      },
      { kind: "file", path: "src/db/schema.ts", content: "export const tables = {}\n", ownership: "seed" },
      { kind: "entry", point: "env.schema", id: "DATABASE_URL", value: { value: { type: "string" } } }
    ]
  })
  const postgres = defineAddon({
    id: "@fixture/db-postgres",
    version: "1.0.0",
    title: "Postgres",
    description: "A hosted Postgres database",
    slot: "database",
    provides: { database: { dialect: "postgres" } },
    supports: (ctx) => (ctx.target.has("ssr") ? true : "Postgres needs a server."),
    contribute: (ctx) => [
      { kind: "dependency", name: "drizzle-orm", version: ctx.version("drizzle-orm") },
      { kind: "dependency", name: "pg", version: ctx.version("pg") },
      {
        kind: "env",
        name: "DATABASE_URL",
        scope: "server",
        secret: true,
        required: true,
        description: "Connection string"
      },
      {
        kind: "file",
        path: "src/db/schema.ts",
        content: "export const tables = { dialect: 'postgres' }\n",
        ownership: "seed"
      }
    ]
  })
  const uiBasic = defineAddon({
    id: "@fixture/ui-basic",
    version: "1.0.0",
    title: "Basic UI",
    description: "Plain components",
    slot: "ui",
    contribute: () => [
      {
        kind: "entry",
        point: "app.providers",
        id: "theme",
        value: { ref: { module: "@fixture/ui-basic", export: "ThemeProvider" } }
      }
    ]
  })
  const uiFancy = defineAddon({
    id: "@fixture/ui-fancy",
    version: "1.0.0",
    title: "Fancy UI",
    description: "Animated components",
    slot: "ui",
    options: z.object({ theme: z.enum(["light", "dark"]).default("light").describe("Theme") }),
    ask: ["theme"],
    contribute: (ctx) => [
      {
        kind: "entry",
        point: "app.providers",
        id: "theme",
        value: { call: { module: "@fixture/ui-fancy", export: "createTheme", args: [ctx.options.theme] } }
      }
    ]
  })
  const i18n = defineAddon({
    id: "@fixture/i18n",
    version: "1.0.0",
    title: "Localization",
    description: "Lingui message catalogs",
    provides: { i18n: { library: "lingui" } },
    options: z.object({ locales: z.array(z.string()).default(["en"]).describe("Locales") }),
    ask: ["locales"],
    contribute: (ctx) => [
      { kind: "dependency", name: "@lingui/core", version: ctx.version("@lingui/core") },
      {
        kind: "entry",
        point: "vite.plugins",
        id: "lingui",
        value: { call: { module: "@lingui/vite-plugin", export: "lingui" } },
        order: { band: "framework" }
      },
      {
        kind: "entry",
        point: "app.providers",
        id: "i18n",
        value: { ref: { module: "./src/i18n/setup", export: "I18nProvider" } }
      },
      {
        kind: "file",
        path: "src/i18n/setup.ts",
        content: `export const locales = ${JSON.stringify(ctx.options.locales)}\n`,
        ownership: "seed"
      },
      { kind: "json", path: "tsconfig.json", pointer: "/include", op: "append", value: "locales" }
    ]
  })
  const storybook = defineAddon({
    id: "@fixture/storybook",
    version: "1.0.0",
    title: "Storybook",
    description: "Component workshop",
    contribute: (ctx) => [
      { kind: "dependency", name: "storybook", version: ctx.version("storybook"), dev: true },
      { kind: "script", name: "storybook", command: "storybook dev" },
      { kind: "lines", path: ".gitignore", lines: ["storybook-static"] }
    ]
  })
  const sessions = defineAddon({
    id: "@fixture/sessions",
    version: "1.0.0",
    title: "Sessions",
    description: "Cookie sessions",
    contribute: () => [
      { kind: "file", path: "src/sessions.ts", content: "export const sessions = true\n", ownership: "owned" }
    ]
  })
  const auth = defineAddon({
    id: "@fixture/auth",
    version: "1.0.0",
    title: "Auth",
    description: "Sign-in",
    requires: ["@fixture/sessions", "slot:database"],
    after: ["@fixture/i18n"],
    contribute: (ctx) => [
      {
        kind: "file",
        path: "src/auth.ts",
        content: `export const dialect = ${JSON.stringify(ctx.provided("database"))}\n`,
        ownership: "seed"
      }
    ]
  })
  const sentry = defineAddon({
    id: "@fixture/sentry",
    version: "1.0.0",
    title: "Sentry",
    description: "Error reporting",
    contribute: () => [
      {
        kind: "env",
        name: "SENTRY_DSN",
        scope: "server",
        secret: true,
        required: true,
        description: "Your Sentry DSN"
      },
      { kind: "notice", code: "sentry", text: "Errors are sent to Sentry." }
    ]
  })
  return defineCatalog({
    id: "@fixture/catalog",
    version: version === 1 ? "1.0.0" : "2.0.0",
    facets: ["vite", "ssr", "spa", "react"],
    versions: {
      react: "19.3.1",
      vite: "8.0.0",
      oxlint: "1.72.0",
      "drizzle-orm": "0.45.4",
      pg: "8.16.0",
      "@lingui/core": "6.10.1",
      storybook: "10.1.0"
    },
    targets: [web],
    slots: [
      defineSlot({ id: "database", title: "Database", question: "Add a database?", choose: "Which database?" }),
      defineSlot({ id: "ui", title: "UI kit", question: "Add a UI kit?", choose: "Which UI kit?" })
    ],
    templates: [
      defineTemplate({
        id: "app",
        title: "App",
        description: "A web app",
        target: "web",
        required: ["@fixture/lint"],
        optional: {
          "@fixture/i18n": { default: false },
          "@fixture/storybook": { default: true },
          "@fixture/sentry": { default: false }
        },
        slots: {
          database: { required: false, default: "@fixture/db-sqlite" },
          ui: { required: true, default: "@fixture/ui-basic" }
        }
      }),
      defineTemplate({
        id: "bare",
        title: "Bare",
        description: "The smallest app",
        target: "web",
        modes: ["ssr"],
        slots: { ui: { required: true } }
      })
    ],
    addons: [lint, sqlite, postgres, uiBasic, uiFancy, i18n, storybook, sessions, auth, sentry],
    presets: [
      {
        id: "saas",
        title: "SaaS",
        answers: {
          template: "app",
          mode: "ssr",
          slots: { database: "@fixture/db-postgres" },
          optional: ["@fixture/i18n"]
        }
      }
    ]
  })
}

/** Applies a planned plan to an in-memory record, the way `applyPlan` does on disk. */
export function applyInMemory(files: Record<string, string>, planned: Plan): Record<string, string> {
  const next = { ...files }
  for (const operation of planned.operations) {
    if (operation.action === "delete") {
      delete next[operation.path]
    } else if (operation.content !== undefined) {
      next[operation.path] = operation.content
    }
  }
  return next
}

export function initRequest(answers: Partial<Answers> = {}): PlanRequest {
  return { intent: { command: "init", answers: { template: "app", mode: "ssr", name: "demo", ...answers } } }
}

export function addRequest(
  addons: string[],
  replace: string[] = [],
  options: Record<string, Record<string, unknown>> = {}
): PlanRequest {
  return { intent: { command: "add", addons, replace, options } }
}

/** Plans against an in-memory project with the fixture settings. */
export function planFixture(
  files: Record<string, string>,
  request: PlanRequest,
  extra: Partial<PlanInput> = {}
): Promise<Plan> {
  return plan({ catalog: fixtureCatalog(), settings, tree: memoryTree(files), request, ...extra })
}

/** Plans and applies, failing the test when the plan isn't applicable. */
export async function applyFixture(
  files: Record<string, string>,
  request: PlanRequest,
  extra: Partial<PlanInput> = {}
): Promise<Record<string, string>> {
  const planned = await planFixture(files, request, extra)
  if (planned.status !== "planned" && planned.status !== "unchanged") {
    throw new Error(
      `Expected a plan, got ${planned.status}: ${JSON.stringify(planned.error ?? planned.decisions ?? planned.conflicts)}`
    )
  }
  return applyInMemory(files, planned)
}
