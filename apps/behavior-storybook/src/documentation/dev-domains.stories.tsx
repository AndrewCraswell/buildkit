import type { Meta, StoryObj } from "@storybook/react-vite"
import { Documentation, Code } from "./Documentation.js"
import { PackageOverview } from "./PackageOverview.js"

function OverviewPage() {
  return <PackageOverview name="dev-domains" />
}
const meta = { title: "Tooling/dev-domains", parameters: { buildkitDocumentation: true } } satisfies Meta
export default meta
export const Overview: StoryObj<typeof meta> = { render: () => <OverviewPage /> }
export const Setup: StoryObj<typeof meta> = {
  render: () => (
    <Documentation
      title="A stable URL for each local server"
      summary="Run these commands in your project’s terminal. No servers are started by this documentation."
    >
      <h2>Install and inspect</h2>
      <Code>
        {
          "npm install --save-dev @buildkitgg/dev-domains\n\nnpx @buildkitgg/dev-domains detect\nnpx @buildkitgg/dev-domains urls"
        }
      </Code>
      <p>
        Detection finds supported development scripts and tool configurations. Inspect the proposed URLs before starting
        a server.
      </p>
      <h2>Prepare HTTPS and start a server</h2>
      <Code>{"npx @buildkitgg/dev-domains setup\nnpx @buildkitgg/dev-domains run app"}</Code>
      <p>
        Use the endpoint name printed by detection. Setup can ask for local certificate or hosts-file permission. On
        Windows, Portless also needs OpenSSL on PATH.
      </p>
      <h2>Save your choices</h2>
      <Code>{"npx @buildkitgg/dev-domains init"}</Code>
      <p>
        The guided setup lets you select endpoints and saves configuration after review. Existing configuration is never
        overwritten.
      </p>
      <a href="https://github.com/AndrewCraswell/buildkit/tree/main/packages/tooling/dev-domains#command-reference">
        Full command reference ↗
      </a>
    </Documentation>
  )
}
export const WorktreeUrls: StoryObj<typeof meta> = {
  name: "Worktree URLs",
  render: () => (
    <Documentation
      title="Predictable URLs across worktrees"
      summary="The checkout directory determines the worktree name. Switching branches does not change the address."
    >
      <h2>Example: a single Vite app named shop</h2>
      <div className="bk-table">
        <table>
          <thead>
            <tr>
              <th>Checkout</th>
              <th>Local URL</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Primary checkout</td>
              <td>
                <code>https://shop.localhost</code>
              </td>
            </tr>
            <tr>
              <td>Worktree: fix-login</td>
              <td>
                <code>https://shop-fix-login.localhost</code>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>These are illustrative addresses. Open the actual URL printed by the CLI for your project.</p>
      <h2>Choose explicit endpoints when needed</h2>
      <Code>
        {
          'import { defineConfig } from "@buildkitgg/dev-domains"\n\nexport default defineConfig({\n  project: "shop",\n  endpoints: {\n    web: { cwd: "apps/web", script: "dev", framework: "vite" },\n    docs: { cwd: "apps/docs", script: "storybook", framework: "storybook" }\n  }\n})'
        }
      </Code>
      <p>
        Configuration belongs in <code>dev-domains.config.ts</code> at the checkout root. Separate domains and ports do
        not isolate databases, credentials, or other application resources.
      </p>
    </Documentation>
  )
}
export const Playwright: StoryObj<typeof meta> = {
  render: () => (
    <Documentation
      title="A dedicated Playwright server"
      summary="Keep the test server separate from the server you use for development."
    >
      <h2>Configure an E2E endpoint</h2>
      <Code>
        {
          'import { defineConfig } from "@buildkitgg/dev-domains"\n\nexport default defineConfig({\n  project: "shop",\n  endpoints: {\n    e2e: { kind: "e2e", cwd: "apps/web", script: "dev", framework: "vite" }\n  }\n})'
        }
      </Code>
      <h2>Use it from playwright.config.ts</h2>
      <Code>
        {
          'import { defineConfig } from "@playwright/test"\nimport { playwrightServer } from "@buildkitgg/dev-domains/playwright"\n\nexport default defineConfig({\n  ...await playwrightServer("e2e")\n})'
        }
      </Code>
      <p>
        The helper supplies <code>baseURL</code> and Playwright’s <code>webServer</code> configuration. It does not
        reuse an existing server. Run Playwright from the checkout root, or pass the root as the second argument.
      </p>
    </Documentation>
  )
}
