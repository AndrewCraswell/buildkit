import type { Meta, StoryObj } from "@storybook/react-vite"
import { Documentation, Code } from "./Documentation.js"
import { PackageOverview } from "./PackageOverview.js"

function OverviewPage() {
  return <PackageOverview name="cli" />
}
const meta = { title: "Tooling/cli", parameters: { buildkitDocumentation: true } } satisfies Meta
export default meta
export const Overview: StoryObj<typeof meta> = { render: () => <OverviewPage /> }
export const CreateAnApp: StoryObj<typeof meta> = {
  name: "Create an app",
  render: () => (
    <Documentation
      title="Create a Buildkit app"
      summary="In a terminal, the CLI shows the plan and asks before it writes. --yes or a reviewed --plan applies without asking; other runs without a terminal write nothing."
    >
      <h2>Answer the questions</h2>
      <Code>{"npx @buildkitgg/cli init app my-app"}</Code>
      <p>
        The CLI asks for the mode, a database, sign-in and localization, shows the plan, and asks once before it writes
        anything.
      </p>
      <h2>Or pass the answers as flags</h2>
      <Code>
        {
          "npx @buildkitgg/cli init app my-app --mode ssr --with i18n --set i18n.locales=en,fr --yes\nnpx @buildkitgg/cli init app my-app --preset saas --yes"
        }
      </Code>
      <p>
        <code>--yes</code> accepts every default but never makes a decision for you. <code>--json</code> prints one JSON
        envelope without prompting.
      </p>
      <h2>Change the app later</h2>
      <Code>{"pnpm buildkit add database\npnpm buildkit config set i18n.locales=en,fr,de\npnpm buildkit upgrade"}</Code>
      <p>
        New apps pin the CLI as a dev dependency. To upgrade, install the newer CLI with{" "}
        <code>pnpm add -D @buildkitgg/cli@latest</code>, then run <code>upgrade</code>, which merges template fixes into
        your code.
      </p>
      <a href="https://github.com/AndrewCraswell/buildkit/tree/main/packages/tooling/cli#readme">Full command list ↗</a>
    </Documentation>
  )
}
