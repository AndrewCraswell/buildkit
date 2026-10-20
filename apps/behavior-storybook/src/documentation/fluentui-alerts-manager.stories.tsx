import type { Meta, StoryObj } from "@storybook/react-vite"
import { PackageOverview } from "./PackageOverview.js"
const meta = {
  title: "Fluent UI/fluentui-alerts-manager",
  parameters: { layout: "fullscreen", controls: { disable: true } }
} satisfies Meta
export default meta
export const Overview: StoryObj<typeof meta> = {
  render: () => (
    <PackageOverview name="fluentui-alerts-manager">
      {" "}
      <h2>Migration from the original message-bar package</h2>
      <p>
        Create an instance instead of importing a singleton. Alerts have no timeoutMs; use native toasts for timed
        messages. Replacing an ID invalidates old handles. Flush and dispose clear silently; dismiss and dismissAll
        invoke callbacks. Payloads should be treated as immutable.
      </p>
    </PackageOverview>
  )
}
