import { defineCatalog, definePreset, defineSlot, defineTemplate } from "@buildkitgg/scaffolder"
import { betterAppsDeploy } from "./addons/better-apps-deploy.js"
import { betterAuth } from "./addons/better-auth.js"
import { ci } from "./addons/ci.js"
import { i18n } from "./addons/i18n.js"
import { sql } from "./addons/sql.js"
import { tanstackStart } from "./target.js"
import { catalogVersion } from "./version.js"
import { versions } from "./versions.js"

/**
 * Buildkit's catalog: what `buildkit create` can make, and what `buildkit add` can add. The database and sign-in slots
 * default to "no" while the Better Apps packages they use are unpublished, so a new app installs from npm today.
 */
export const catalog = defineCatalog({
  id: "@buildkitgg/catalog",
  version: catalogVersion,
  facets: ["react", "vite", "ssr", "spa", "request-middleware", "root-loader", "router-rewrite", "server-functions"],
  versions,
  targets: [tanstackStart],
  slots: [
    defineSlot({ id: "database", title: "Database", question: "Add a database?", choose: "Which database?" }),
    defineSlot({ id: "auth", title: "Sign-in", question: "Add sign-in?", choose: "Which sign-in?" })
  ],
  templates: [
    defineTemplate({
      id: "app",
      title: "App",
      description: "A React app on TanStack Start, server-rendered or as a single-page app.",
      target: "tanstack-start",
      required: ["@buildkit/ci"],
      optional: { "@buildkit/i18n": { default: false } },
      slots: { database: { required: false }, auth: { required: false } }
    })
  ],
  addons: [ci, sql, betterAuth, i18n, betterAppsDeploy],
  presets: [
    definePreset({
      id: "saas",
      title: "Server-rendered app with a database, sign-in and localization",
      answers: {
        template: "app",
        mode: "ssr",
        slots: { database: "@buildkit/sql", auth: "@buildkit/better-auth" },
        optional: ["@buildkit/i18n"]
      }
    })
  ]
})
