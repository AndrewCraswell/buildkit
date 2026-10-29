import type { Meta, StoryObj } from "@storybook/react-vite"
import { Documentation } from "./Documentation.js"
import { PackageOverview } from "./PackageOverview.js"

function OverviewPage() {
  return <PackageOverview name="catalog" />
}
const meta = { title: "Tooling/catalog", parameters: { buildkitDocumentation: true } } satisfies Meta
export default meta
export const Overview: StoryObj<typeof meta> = { render: () => <OverviewPage /> }
const addons = [
  ["ci", "Always included", "A GitHub Actions workflow: buildkit check, lint, format, build and type-check"],
  ["sql", "Add a database?", "The main database with Drizzle, its schema and migrations"],
  ["better-auth", "Add sign-in?", "Better Auth on the main database, its routes and a sign-in page"],
  ["i18n", "Optional add-on", "Lingui catalogs, localized URLs and the html lang and dir attributes"],
  ["better-apps-deploy", "buildkit add only", "The Better Apps Vite plugin and a staging deploy workflow"]
] as const
export const TheAppTemplate: StoryObj<typeof meta> = {
  name: "The app template",
  render: () => (
    <Documentation
      title="What buildkit init asks"
      summary="The app template is a React app on TanStack Start, in ssr or spa mode."
    >
      <h2>Questions and add-ons</h2>
      <div className="bk-table">
        <table>
          <thead>
            <tr>
              <th>Add-on</th>
              <th>Offered as</th>
              <th>What it writes</th>
            </tr>
          </thead>
          <tbody>
            {addons.map(([name, offered, writes]) => (
              <tr key={name}>
                <td>
                  <code>{name}</code>
                </td>
                <td>{offered}</td>
                <td>{writes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Both questions default to no, and sign-in needs a database. The <code>saas</code> preset answers ssr with a
        database, sign-in and localization.
      </p>
      <h2>No cloud in the app</h2>
      <p>
        Apps have no Wrangler config, bindings or cloud names. Starter files import generated glue from{" "}
        <code>src/generated/buildkit/</code> once, so adding an add-on only changes generated files. The database,
        sign-in and deploy add-ons use Better Apps packages that aren’t on npm yet.
      </p>
      <a href="https://github.com/AndrewCraswell/buildkit/tree/main/packages/tooling/catalog#readme">
        Extension points and starter files ↗
      </a>
    </Documentation>
  )
}
