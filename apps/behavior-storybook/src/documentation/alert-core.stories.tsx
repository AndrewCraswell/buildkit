import type { Meta, StoryObj } from "@storybook/react-vite"
import { PackageOverview } from "./PackageOverview.js"
const meta = {
  title: "Core/alert-core",
  parameters: { layout: "fullscreen", controls: { disable: true } }
} satisfies Meta
export default meta
export const Overview: StoryObj<typeof meta> = {
  render: () => (
    <PackageOverview name="alert-core">
      {" "}
      <h2>Choose by lifetime</h2>
      <table>
        <thead>
          <tr>
            <th>Need</th>
            <th>Use</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>A warning that remains until resolved</td>
            <td>Buildkit alert manager and an inline AlertRegion</td>
          </tr>
          <tr>
            <td>A short confirmation after an action</td>
            <td>Fluent useToastController, Base UI Toast, or Sonner</td>
          </tr>
          <tr>
            <td>A decision that blocks a workflow</td>
            <td>Buildkit modal manager</td>
          </tr>
        </tbody>
      </table>
      <h2>What Buildkit adds</h2>
      <p>
        Alert core owns independent regions, ID replacement, handles, updates, dismissal callbacks, and immutable
        snapshots. React adds subscriptions and rendering. UI adapters supply MessageBar or Alert components. Both
        adapters export the same manager and region API.
      </p>
      <p>
        Toast engines already manage queues, timing, interactions, and announcements. A second queue would duplicate
        their state. There is no toast-core or toast-manager package. The component kit already exports SonnerToaster.
      </p>
      <h2>Upstream references</h2>
      <ul>
        <li>
          <a href="https://ui.shadcn.com/docs/components/base/toast">shadcn Base UI Toast</a>
        </li>
        <li>
          <a href="https://ui.shadcn.com/docs/components/radix/sonner">shadcn Sonner</a>
        </li>
        <li>
          <a href="https://base-ui.com/react/components/toast">Base UI external manager</a>
        </li>
        <li>
          <a href="https://github.com/microsoft/fluentui/blob/master/packages/react-components/react-toast/library/src/state/useToastController.ts">
            Fluent toast controller
          </a>
        </li>
      </ul>
    </PackageOverview>
  )
}
