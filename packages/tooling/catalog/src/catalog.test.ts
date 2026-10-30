import { checkCatalog, describeCatalog, type Plan } from "@buildkitgg/scaffolder"
import { describe, expect, it } from "vite-plus/test"
import { catalog } from "./catalog.js"
import { settings } from "./settings.js"
import {
  addRequest,
  applied,
  initRequest,
  paths,
  planProject,
  previousCatalog,
  upgradedRouterLine,
  written
} from "./testing/plan.js"
import { catalogVersion } from "./version.js"
import { betterAppsVersion } from "./versions.js"

const generated = {
  config: "src/generated/buildkit/config.ts",
  client: "src/generated/buildkit/client.ts",
  server: "src/generated/buildkit/server.ts"
}

async function init(answers: Parameters<typeof initRequest>[0] = {}): Promise<Plan> {
  const planned = await planProject({}, initRequest(answers))
  expect(planned.error).toBeUndefined()
  expect(planned.decisions).toEqual([])
  expect(planned.status).toBe("planned")
  return planned
}

function packageJson(planned: Plan): { dependencies: Record<string, string>; devDependencies: Record<string, string> } {
  return JSON.parse(written(planned, "package.json"))
}

describe("the catalog", () => {
  it("plans every pair of answers for each template and mode, and the preset", () => {
    expect(checkCatalog(catalog, { matrix: true })).toEqual([])
  })

  it("is versioned by its own package.json and pins every package exactly", () => {
    expect(catalog.version).toBe(catalogVersion)
    expect(catalog.versions?.["@buildkitgg/cli"]).toBe(catalogVersion)
    const loose = Object.entries(catalog.versions ?? {}).filter(([, version]) => !/^\d+\.\d+\.\d+$/.test(version))
    expect(loose).toEqual([])
  })

  it("asks about the database, then sign-in, then localization", () => {
    const [template] = describeCatalog(catalog).templates
    expect(template?.template).toBe("app")
    const questions = template?.questionsByMode.ssr
    expect(questions?.slots.map((slot) => slot.slot)).toEqual(["database", "auth"])
    expect(questions?.optional.map((addon) => addon.id)).toEqual(["@buildkit/i18n"])
    expect(questions?.required.map((addon) => addon.id)).toEqual(["@buildkit/ci"])
  })
})

describe("the TanStack Start target", () => {
  it("writes Start's CSRF check first in src/start.ts, then the request middleware point", async () => {
    const start = written(await init(), "src/start.ts")
    const csrf = start.indexOf('createCsrfMiddleware({ filter: ({ handlerType }) => handlerType === "serverFn" })')
    expect(csrf).toBeGreaterThan(-1)
    expect(start.indexOf("...requestMiddleware.pre")).toBeGreaterThan(csrf)
  })

  it("puts the framework band of vite.plugins before tanstackStart()", async () => {
    for (const mode of ["ssr", "spa"]) {
      const config = written(await init({ mode }), "vite.config.ts")
      const framework = config.indexOf("...vitePlugins.framework")
      expect(framework).toBeGreaterThan(config.indexOf("...vitePlugins.pre"))
      expect(config.indexOf("tanstackStart(")).toBeGreaterThan(framework)
      expect(config.indexOf("...vitePlugins.post")).toBeGreaterThan(config.indexOf("react({ compiler: true })"))
    }
  })

  it("prerenders the SPA shell at /index.html", async () => {
    expect(written(await init({ mode: "spa" }), "vite.config.ts")).toContain(
      'spa: { enabled: true, prerender: { outputPath: "/index.html" } }'
    )
    expect(written(await init({ mode: "ssr" }), "vite.config.ts")).not.toContain("spa:")
  })

  it("wires every point at init, so adding an add-on only changes generated files", async () => {
    const planned = await init()
    expect(written(planned, generated.config)).toContain("export const vitePlugins = {")
    expect(written(planned, generated.server)).toContain("export const requestMiddleware = {")
    const client = written(planned, generated.client)
    for (const name of ["appProviders", "appBootstrap", "routerWrappers", "routerRewrite", "htmlAttributes"]) {
      expect(client).toContain(`export const ${name} =`)
    }
    expect(written(planned, "src/router.tsx")).toContain("rewrite: routerRewrite")
    expect(written(planned, "src/routes/__root.tsx")).toContain("htmlAttributes ?? useDefaultHtmlAttributes")
    expect(written(planned, "src/client.tsx")).toContain("...appBootstrap.pre")
  })

  it("names no cloud and writes no cloud config", async () => {
    for (const planned of [await init(), await init({ mode: "spa" })]) {
      expect(paths(planned).filter((path) => /wrangler|cloudflare/i.test(path))).toEqual([])
      const naming = planned.operations.filter((operation) =>
        /wrangler|cloudflare|\bD1\b/i.test(operation.content ?? "")
      )
      expect(naming.map((operation) => operation.path)).toEqual([])
    }
  })

  it("pins the CLI so pnpm buildkit runs the version that made the app", async () => {
    const { dependencies, devDependencies } = packageJson(await init())
    expect(devDependencies["@buildkitgg/cli"]).toBe(catalogVersion)
    expect(dependencies["@tanstack/react-start"]).toBe(catalog.versions?.["@tanstack/react-start"])
  })

  it("runs Buildkit's checks in CI, and formats every file but the generated ones", async () => {
    const planned = await init({ optional: ["@buildkit/i18n"] })
    const workflow = written(planned, ".github/workflows/ci.yml")
    for (const run of ["pnpm buildkit check", "pnpm lint", "pnpm format:check", "pnpm build", "pnpm typecheck"]) {
      expect(workflow).toContain(`run: ${run}`)
    }
    const formatter = JSON.parse(written(planned, ".oxfmtrc.json"))
    expect(formatter.printWidth).toBe(settings.printWidth)
    expect(formatter.ignorePatterns).toEqual(
      expect.arrayContaining(["src/generated/buildkit/**", "src/routeTree.gen.ts"])
    )
    expect(formatter.ignorePatterns).not.toEqual(expect.arrayContaining(["buildkit.jsonc"]))
    expect(formatter.ignorePatterns).not.toEqual(expect.arrayContaining(["package.json"]))
    expect(formatter.ignorePatterns).not.toEqual(expect.arrayContaining(["tsconfig.json"]))
    // The engine lays these out as the formatter does: short lists on one line, package.json as JSON.stringify writes it.
    expect(written(planned, "tsconfig.json")).toContain('"include": ["src", "vite.config.ts", "lingui.config.ts"]')
    expect(written(planned, "buildkit.jsonc")).toContain('"declined": ["slot:auth", "slot:database"]')
    expect(written(planned, "package.json")).toBe(
      `${JSON.stringify(JSON.parse(written(planned, "package.json")), null, 2)}\n`
    )
  })
})

describe("the SQL database add-on", () => {
  it("declares the main database with Better Apps' SQL capability, queried with Drizzle", async () => {
    const planned = await init({ slots: { database: "@buildkit/sql" } })
    const db = written(planned, "src/db/db.server.ts")
    expect(db).toContain('defineDatabase("main", { dialect: "sqlite", migrations: "./migrations/main" })')
    expect(db).toContain("export const db = drizzle(main, { schema })")
    expect(written(planned, "drizzle.config.ts")).toContain('out: "./migrations/main"')
    const { dependencies, devDependencies } = packageJson(planned)
    expect(dependencies["@better-apps/sql"]).toBe(betterAppsVersion)
    expect(dependencies["drizzle-orm"]).toBe(catalog.versions?.["drizzle-orm"])
    expect(devDependencies["drizzle-kit"]).toBe(catalog.versions?.["drizzle-kit"])
    expect(planned.notices.map((notice) => notice.code)).toContain("unpublished-package")
    expect(JSON.stringify(planned.notices)).toContain("@better-apps/sql@0.1.0 isn't on npm yet")
  })
})

describe("the Better Auth add-on", () => {
  it("needs the database slot", async () => {
    const planned = await planProject({}, initRequest({ slots: { auth: "@buildkit/better-auth" } }))
    expect(planned.status).toBe("needs-decision")
    expect(planned.decisions[0]?.id).toBe("slot:database")
    expect(planned.decisions[0]?.choices.map((choice) => choice.id)).toContain("@buildkit/sql")
  })

  it("signs in with Better Auth in the app's database, read through Better Apps' identity", async () => {
    const planned = await init({ slots: { database: "@buildkit/sql", auth: "@buildkit/better-auth" } })
    expect(written(planned, "src/auth/auth.server.ts")).toContain(
      'drizzleAdapter(db, { provider: "sqlite", schema: authSchema })'
    )
    expect(written(planned, "src/auth/identity.server.ts")).toContain("betterAuthIdentity(auth)")
    expect(written(planned, "src/auth/viewer.functions.ts")).toContain("identity.getActor(getRequest())")
    expect(written(planned, "src/routes/api/auth/$.ts")).toContain("auth.handler(request)")
    expect(written(planned, "src/db/auth-schema.ts")).toContain("export const session = sqliteTable(")
    expect(planned.operations.find((operation) => operation.path === "src/routes/sign-in.tsx")?.class).toBe("sample")
    expect(planned.env).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "BETTER_AUTH_SECRET", secret: true, required: true })])
    )
    expect(written(planned, ".env.example")).toContain("BETTER_AUTH_SECRET=")
    expect(packageJson(planned).dependencies["@better-apps/better-auth"]).toBe(betterAppsVersion)
    expect(planned.commands.map((command) => command.run)).toContain("pnpm db:generate")
  })
})

describe("the localization add-on", () => {
  const options = { "@buildkit/i18n": { locales: ["en", "fr"] } }

  it("detects the locale per request in middleware on a server-rendered app", async () => {
    const planned = await init({ optional: ["@buildkit/i18n"], options })
    expect(written(planned, "src/i18n/locales.ts")).toContain('export const locales = ["en", "fr"] as const')
    expect(written(planned, "src/i18n/server.ts")).toContain('createMiddleware({ type: "request" })')
    expect(written(planned, generated.server)).toContain('"@buildkit/i18n/locale": localeMiddleware')
    expect(written(planned, generated.client)).toContain("export const routerRewrite = localeRewrite")
    expect(written(planned, generated.client)).toContain("export const htmlAttributes = useLocaleAttributes")
    expect(written(planned, generated.config)).toContain('lingui({"macroTransform":true})')
    expect(written(planned, generated.config)).toContain('pre: [vitePluginsById["@buildkit/i18n/lingui"]]')
    expect(paths(planned)).toEqual(expect.arrayContaining(["src/locales/en.po", "src/locales/fr.po"]))
    expect(paths(planned)).not.toContain("src/i18n/browser.ts")
    const steps = [...written(planned, ".github/workflows/ci.yml").matchAll(/- id: (\S+)/g)].map((found) => found[1])
    expect(steps.slice(steps.indexOf("format"))).toEqual(["format", "translations", "build", "typecheck"])
  })

  it("detects the locale in the browser before the first render on a single-page app", async () => {
    const planned = await init({ mode: "spa", optional: ["@buildkit/i18n"], options })
    expect(written(planned, generated.client)).toContain('"@buildkit/i18n/locale": bootstrapLocale')
    expect(written(planned, generated.server)).not.toContain("localeMiddleware")
    expect(written(planned, "src/i18n/router.tsx")).toContain("browserI18n")
    expect(paths(planned)).not.toContain("src/i18n/server.ts")
  })

  it("imports app modules without their extensions, so the app type-checks without allowImportingTsExtensions", async () => {
    for (const mode of ["ssr", "spa"]) {
      const planned = await init({ mode, optional: ["@buildkit/i18n"], options })
      const imports = [generated.client, generated.server, "vite.config.ts", "lingui.config.ts"].flatMap((path) =>
        [...written(planned, path).matchAll(/from "(\.{1,2}\/[^"]+)"/g)].map((found) => found[1])
      )
      expect(imports).toContain("../../i18n/router")
      expect(imports.filter((specifier) => /\.tsx?$/.test(specifier ?? ""))).toEqual([])
      expect(JSON.parse(written(planned, "tsconfig.json")).compilerOptions).not.toHaveProperty(
        "allowImportingTsExtensions"
      )
    }
  })

  it("leaves URLs alone without localizedUrls, and refuses locale tags that aren't safe file names", async () => {
    const plain = await init({ optional: ["@buildkit/i18n"], options: { "@buildkit/i18n": { localizedUrls: false } } })
    expect(paths(plain)).not.toContain("src/i18n/rewrite.ts")
    expect(written(plain, generated.client)).toContain("export const routerRewrite = undefined")
    const unsafe = await planProject(
      {},
      initRequest({ optional: ["@buildkit/i18n"], options: { "@buildkit/i18n": { locales: ["../x"] } } })
    )
    expect(unsafe.error?.code).toBe("E_INVALID_OPTIONS")
    // A localized URL has to set the locale, so URL detection can't be left out while URLs are localized.
    const ignored = await planProject(
      {},
      initRequest({ optional: ["@buildkit/i18n"], options: { "@buildkit/i18n": { detection: ["cookie"] } } })
    )
    expect(ignored.error).toMatchObject({ code: "E_INVALID_OPTIONS", message: expect.stringContaining('"url"') })
    const cookieOnly = await init({
      optional: ["@buildkit/i18n"],
      options: { "@buildkit/i18n": { detection: ["cookie"], localizedUrls: false } }
    })
    expect(cookieOnly.status).toBe("planned")
  })

  it("activates the locale a client-side navigation lands on, in both render models", async () => {
    for (const mode of ["ssr", "spa"]) {
      const planned = await init({ mode, optional: ["@buildkit/i18n"] })
      expect(paths(planned)).toContain("src/i18n/navigation.ts")
      expect(written(planned, "src/i18n/router.tsx")).toContain("followLocale(router, i18n)")
      // The source locale's messages come with the app's code, for when another locale's catalog doesn't load, and
      // every other catalog is its own chunk.
      const catalogs = written(planned, "src/i18n/catalogs.ts")
      expect(catalogs).toContain('import { messages as sourceMessages } from "../locales/en.po"')
      expect(catalogs).toContain('import.meta.glob<{ messages: Messages }>(["../locales/*.po", "!../locales/en.po"])')
      expect(paths(planned)).toContain("src/i18n/po.d.ts")
    }
  })

  it("adds to an app later without touching its starter files", async () => {
    const project = applied({}, await init())
    const edited = { ...project, "src/router.tsx": `${project["src/router.tsx"]}\n// mine\n` }
    const planned = await planProject(edited, addRequest(["i18n"]))
    expect(planned.status).toBe("planned")
    const changed = planned.operations.filter(
      (operation) => operation.class === "seed" && operation.action !== "create"
    )
    expect(changed).toEqual([])
    expect(written(planned, generated.client)).toContain("withI18n")
  })
})

describe("the Better Apps deploys add-on", () => {
  it("wires the Better Apps Vite plugin before Start and deploys staging with better-apps deploy", async () => {
    const project = applied({}, await init({ slots: { database: "@buildkit/sql" } }))
    const planned = await planProject(project, addRequest(["better-apps-deploy"]))
    expect(planned.status).toBe("planned")
    const config = written(planned, generated.config)
    expect(config).toContain('import { betterApps } from "@better-apps/tanstack-start/vite"')
    expect(config).toContain('framework: [vitePluginsById["@buildkit/better-apps-deploy/better-apps"]]')
    const deploy = written(planned, ".github/workflows/deploy.yml")
    expect(deploy).toContain("run: pnpm exec better-apps deploy --env staging")
    // A commit deploys once CI passed on it, and the job checks out that commit.
    expect(deploy).toContain("workflow_run:")
    expect(deploy).toContain("github.event.workflow_run.conclusion == 'success'")
    expect(deploy).toContain("ref: ${{ github.event.workflow_run.head_sha }}")
    expect(deploy).not.toContain("push:")
    // The deploy slot is the job's, so a skipped run never takes a place in its queue, and a commit main has moved past
    // deploys nothing.
    expect(deploy).not.toMatch(/^concurrency:/m)
    expect(deploy).toMatch(/^ {4}concurrency:/m)
    expect(deploy).toContain('gh api "repos/$GITHUB_REPOSITORY/commits/main"')
    expect(deploy.match(/if: steps\.newest\.outputs\.newest == 'true'/g)).toHaveLength(5)
    // Every passing run waits its turn, so an older commit's can't replace the newest's.
    expect(deploy).toContain("queue: max")
    const environments = written(planned, "better-apps.environments.jsonc")
    expect(environments).toContain('"sql": "per-pr"')
    expect(environments).not.toMatch(/cloudflare|wrangler/i)
  })
})

describe("upgrade", () => {
  it("merges a template fix into a starter file you edited, from the recorded catalog version", async () => {
    const previous = previousCatalog()
    const project = applied({}, await planProject({}, initRequest(), { catalog: previous }))
    expect(project["src/router.tsx"]).not.toContain(upgradedRouterLine)
    const router = project["src/router.tsx"] ?? ""
    const edited = {
      ...project,
      "src/router.tsx": router.replace("export function getRouter() {", "// Mine.\nexport function getRouter() {")
    }
    const planned = await planProject(
      edited,
      { intent: { command: "upgrade" } },
      {
        catalogs: (version) => (version === previous.version ? previous : undefined)
      }
    )
    expect(planned.status).toBe("planned")
    expect(planned.baseline?.source).toBe("cache")
    expect(planned.upgrade?.catalog).toEqual({ from: previous.version, to: catalog.version })
    const merged = written(planned, "src/router.tsx")
    expect(merged).toContain("// Mine.")
    expect(merged).toContain(upgradedRouterLine)
    expect(planned.merged.map((entry) => entry.path)).toContain("src/router.tsx")
  })
})
