import { defineAddon, type Contribution } from "@buildkitgg/scaffolder"
import { z } from "zod"
import { dependency, file, fromTemplate, jsonItems } from "../files.js"
import { ciStep } from "./ci.js"

// Tags become file names in src/locales, so they're limited to letters, digits and hyphens.
const localeTag = z.string().regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/, "Use a language tag such as en, fr or pt-BR.")

const options = z.object({
  sourceLocale: localeTag.default("en").describe("The locale your messages are written in"),
  locales: z.array(localeTag).min(1).default(["en"]).describe("Locales the app is translated into"),
  detection: z
    .array(z.enum(["url", "cookie", "header"]))
    .default(["url", "cookie", "header"])
    .describe(
      "Where a visitor's locale comes from, in order: the URL prefix, the locale cookie, the browser's languages"
    ),
  localizedUrls: z.boolean().default(true).describe("Put the locale in URLs, such as /fr/about")
})

type I18nOptions = z.infer<typeof options>

/** Every locale, the source locale first, each once. */
function allLocales(options: I18nOptions): string[] {
  return [...new Set([options.sourceLocale, ...options.locales])]
}

/** A string array as the formatter prints it: `["en", "fr"]`. */
function stringArray(values: readonly string[]): string {
  return `[${values.map((value) => JSON.stringify(value)).join(", ")}]`
}

/** The add-on's options, in the one file Lingui's config and the app read them from. */
function localesModule(options: I18nOptions): string {
  return [
    "// Buildkit writes these values from the i18n options. Change them with",
    "// `pnpm buildkit config set i18n.locales=en,fr`, or edit them here.",
    "",
    "/** The locale your messages are written in. */",
    `export const sourceLocale = ${JSON.stringify(options.sourceLocale)}`,
    "",
    "/** Every locale the app is translated into, the source locale included. */",
    `export const locales = ${stringArray(allLocales(options))} as const`,
    "",
    "export type Locale = (typeof locales)[number]",
    "",
    "/** Where a visitor's locale comes from, in order: the URL prefix, the locale cookie, the browser's languages. */",
    `export const detection = ${stringArray(options.detection)} as const`,
    "",
    "/** Whether URLs carry the locale, such as /fr/about. The source locale's URLs have no prefix. */",
    `export const localizedUrls = ${JSON.stringify(options.localizedUrls)}`,
    "",
    "/** The cookie that remembers a visitor's choice of locale. */",
    'export const localeCookie = "locale"',
    ""
  ].join("\n")
}

/** An empty catalog, as `lingui extract` writes one. */
function emptyCatalog(locale: string): string {
  return [
    'msgid ""',
    'msgstr ""',
    '"MIME-Version: 1.0\\n"',
    '"Content-Type: text/plain; charset=utf-8\\n"',
    '"Content-Transfer-Encoding: 8bit\\n"',
    '"X-Generator: @lingui/cli\\n"',
    `"Language: ${locale}\\n"`,
    ""
  ].join("\n")
}

/**
 * Lingui localization, written into the app as code you own. On a server-rendered app, request middleware detects each
 * request's locale and makes its own instance; in a single-page app, the browser detects it before the first render.
 */
export const i18n = defineAddon({
  id: "@buildkit/i18n",
  version: "1.0.0",
  title: "Localization",
  description: "Lingui, wired into the app as code you own: locale detection, catalogs and localized URLs.",
  provides: { i18n: { library: "lingui" } },
  after: ["@buildkit/ci"],
  options,
  ask: ["locales"],
  supports: ({ target }) =>
    target.family === "tanstack-start" ? true : "The wiring is written as TanStack Start app code.",
  contribute(ctx): Contribution[] {
    const { options, target } = ctx
    const common = (path: string) => fromTemplate("i18n/common", path)
    const contributions: Contribution[] = [
      dependency(ctx, "@lingui/core"),
      dependency(ctx, "@lingui/react"),
      dependency(ctx, "@lingui/cli", true),
      dependency(ctx, "@lingui/vite-plugin", true),
      { kind: "script", name: "i18n:extract", command: "lingui extract --clean" },
      { kind: "script", name: "i18n:check", command: "lingui check sync && lingui check missing" },
      jsonItems("tsconfig.json", "/include", ["lingui.config.ts"]),
      file("src/i18n/locales.ts", localesModule(options)),
      common("lingui.config.ts"),
      common("src/i18n/match.ts"),
      common("src/i18n/instance.ts"),
      common("src/i18n/provider.tsx"),
      ...allLocales(options).map((locale) => file(`src/locales/${locale}.po`, emptyCatalog(locale), "sample")),
      {
        kind: "entry",
        point: "vite.plugins",
        id: "lingui",
        order: { band: "pre" },
        value: { call: { module: "@lingui/vite-plugin", export: "lingui", args: [{ macroTransform: true }] } }
      },
      // Wrap renders Lingui's provider, and on a server-rendered app the router carries the locale to the browser.
      {
        kind: "entry",
        point: "router.wrappers",
        id: "lingui",
        value: { ref: { module: "./src/i18n/router.tsx", export: "withI18n" } }
      },
      {
        kind: "entry",
        point: "html.attributes",
        id: "lang-dir",
        value: { ref: { module: "./src/i18n/provider.tsx", export: "useLocaleAttributes" } }
      }
    ]
    switch (target.renderModel) {
      case "ssr-loader":
        contributions.push(
          fromTemplate("i18n/ssr", "src/i18n/router.tsx"),
          fromTemplate("i18n/ssr", "src/i18n/server.ts"),
          {
            kind: "entry",
            point: "server.requestMiddleware",
            id: "locale",
            value: { ref: { module: "./src/i18n/server.ts", export: "localeMiddleware" } }
          }
        )
        break
      case "spa":
        contributions.push(
          fromTemplate("i18n/spa", "src/i18n/router.tsx"),
          fromTemplate("i18n/spa", "src/i18n/browser.ts"),
          {
            kind: "entry",
            point: "app.bootstrap",
            id: "locale",
            value: { ref: { module: "./src/i18n/browser.ts", export: "bootstrapLocale" } }
          }
        )
        break
      default:
        throw new Error(`Localization has no wiring for the ${target.renderModel} render model.`)
    }
    if (options.localizedUrls) {
      if (target.has("router-rewrite")) {
        contributions.push(common("src/i18n/rewrite.ts"), {
          kind: "entry",
          point: "router.rewrite",
          id: "locale",
          value: { ref: { module: "./src/i18n/rewrite.ts", export: "localeRewrite" } }
        })
      } else {
        ctx.ignored("localizedUrls", "This target's router has no URL rewrite.")
      }
    }
    if (ctx.selected("@buildkit/ci")) {
      contributions.push(ciStep({ id: "translations", name: "Check translations", run: "pnpm i18n:check" }))
    }
    return contributions
  },
  nextSteps: () => [
    "Wrap text in <Trans> or t`…` from useLingui() (import them from @lingui/react/macro), then run pnpm i18n:extract."
  ]
})
