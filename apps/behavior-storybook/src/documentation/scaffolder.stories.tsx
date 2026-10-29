import type { Meta, StoryObj } from "@storybook/react-vite"
import { Documentation, Code } from "./Documentation.js"
import { PackageOverview } from "./PackageOverview.js"

function OverviewPage() {
  return <PackageOverview name="scaffolder" />
}
const meta = { title: "Tooling/scaffolder", parameters: { buildkitDocumentation: true } } satisfies Meta
export default meta
export const Overview: StoryObj<typeof meta> = { render: () => <OverviewPage /> }
export const WritingACatalog: StoryObj<typeof meta> = {
  name: "Writing a catalog",
  render: () => (
    <Documentation
      title="Describe what projects can be made of"
      summary="A catalog lists targets, templates, slots and add-ons. The CLI's questions are generated from it."
    >
      <h2>An add-on returns data</h2>
      <Code>
        {
          'import { defineAddon } from "@buildkitgg/scaffolder"\nimport { z } from "zod"\n\nexport const i18n = defineAddon({\n  id: "@acme/i18n",\n  version: "1.0.0",\n  title: "Localization",\n  description: "Lingui message catalogs",\n  options: z.object({ locales: z.array(z.string()).default(["en"]) }),\n  ask: ["locales"],\n  contribute: (ctx) => [\n    { kind: "dependency", name: "@lingui/core", version: ctx.version("@lingui/core") },\n    {\n      kind: "file",\n      path: "src/i18n/setup.ts",\n      content: `export const locales = ${JSON.stringify(ctx.options.locales)}\\n`,\n      ownership: "seed"\n    }\n  ]\n})'
        }
      </Code>
      <p>
        Contributions are dependencies, scripts, environment variables, files, entries in extension points, JSON and
        YAML edits, line lists, listed commands and notices. The engine applies them; add-ons never touch the disk.
      </p>
      <h2>A template picks the add-ons</h2>
      <Code>
        {
          'import { defineTemplate } from "@buildkitgg/scaffolder"\n\nexport const app = defineTemplate({\n  id: "app",\n  title: "App",\n  description: "A web app",\n  target: "web",\n  required: ["@acme/lint"],\n  optional: { "@acme/i18n": { default: false } },\n  slots: { database: { required: false, default: "@acme/db-sqlite" } }\n})'
        }
      </Code>
      <p>
        Required add-ons are never asked about. Optional add-ons share one multi-select, and each slot is a one-of
        question, such as the database. Every question also has a flag, so the same answers work without a terminal.
      </p>
      <h2>Check it in CI</h2>
      <Code>
        {
          'import catalog from "@acme/catalog"\nimport { checkCatalog } from "@buildkitgg/scaffolder"\n\nconst problems = checkCatalog(catalog, { matrix: true })\nif (problems.length > 0) {\n  throw new Error(problems.join("\\n"))\n}'
        }
      </Code>
      <p>
        The check returns a list of problems and doesn’t fail by itself, so throw when the list isn’t empty. It reports
        broken references and slot defaults that aren’t the slot’s add-ons. Once those checks pass, it plans every pair
        of answers. These examples describe code to run in Node; nothing here writes files.
      </p>
      <a href="https://github.com/AndrewCraswell/buildkit/tree/main/packages/tooling/scaffolder#readme">
        Full guide: commands, file ownership, upgrades and template packages ↗
      </a>
    </Documentation>
  )
}
