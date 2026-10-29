import type { Contribution } from "@buildkitgg/scaffolder"
import { catalogVersion } from "./version.js"

/**
 * The Better Apps version the generated apps pin. Better Apps' platform packages release together at one version, and
 * none is published yet, so this is the first release they're planned to make. Apps that use them can't install until
 * it's on npm; each add-on that adds one says so in its plan.
 */
export const betterAppsVersion = "0.1.0"

/** Better Apps packages the catalog's add-ons use, and what each one is still waiting on. */
export const betterAppsPackages = {
  "@better-apps/sql": "the SQL capability (`defineDatabase`), which the Better Apps Features session is building",
  "@better-apps/better-auth": "the Better Auth identity adapter, in Better Apps PR #59",
  "@better-apps/tanstack-start": "the TanStack Start integration and its Vite plugin, in Better Apps PR #59",
  "@better-apps/cli": "the `better-apps deploy` command of Better Apps' deploy service"
} as const

export type BetterAppsPackage = keyof typeof betterAppsPackages

/** Pins for every package the generated apps depend on. Every version was on npm for at least a day on 2026-10-29. */
export const versions: Record<string, string> = {
  // The CLI and the catalog release together, so an app pins the CLI at the catalog's own version.
  "@buildkitgg/cli": catalogVersion,
  "@tanstack/react-router": "1.170.46",
  "@tanstack/react-start": "1.169.4",
  react: "19.3.1",
  "react-dom": "19.3.1",
  vite: "8.3.5",
  "@vitejs/plugin-react": "6.1.2",
  "oxc-transform-react": "0.155.0",
  typescript: "7.0.2",
  "@types/react": "19.3.0",
  "@types/react-dom": "19.3.0",
  "@types/node": "24.19.2",
  oxlint: "1.89.0",
  oxfmt: "0.74.0",
  "drizzle-orm": "0.45.4",
  "drizzle-kit": "0.31.11",
  "better-auth": "1.7.9",
  "@lingui/core": "6.10.1",
  "@lingui/react": "6.10.1",
  "@lingui/cli": "6.10.1",
  "@lingui/vite-plugin": "6.10.1",
  ...Object.fromEntries(Object.keys(betterAppsPackages).map((name) => [name, betterAppsVersion]))
}

/**
 * Adds a Better Apps package, with a notice that it isn't published yet. The notice goes away when the catalog that
 * pins a published version ships.
 */
export function betterAppsDependency(name: BetterAppsPackage, dev = false): Contribution[] {
  return [
    { kind: "dependency", name, version: betterAppsVersion, ...(dev ? { dev: true } : {}) },
    {
      kind: "notice",
      code: "unpublished-package",
      text: `${name}@${betterAppsVersion} isn't on npm yet: it waits on ${betterAppsPackages[name]}. pnpm install fails until it's published.`
    }
  ]
}
