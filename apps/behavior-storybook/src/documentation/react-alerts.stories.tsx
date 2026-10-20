import type { Meta, StoryObj } from "@storybook/react-vite"
import { Code } from "./Documentation.js"
import { PackageOverview } from "./PackageOverview.js"
const meta = {
  title: "React/react-alerts",
  parameters: { layout: "fullscreen", controls: { disable: true } }
} satisfies Meta
export default meta
export const Overview: StoryObj<typeof meta> = {
  render: () => (
    <PackageOverview name="react-alerts">
      <h2>Register an application renderer</h2>
      <p>
        The adapter supplies an Alert component. Your application chooses the components, styling, icons, and layout.
        The renderer receives the alert entry, a dismiss function, and an accessible dismissal label.
      </p>
      <Code>
        {
          'import { createAlertManager, AlertRegion, type AlertRendererProps } from "@buildkitgg/react-alerts"\n\nfunction AppAlert({ entry, dismiss, dismissLabel }: AlertRendererProps) {\n  return (\n    <YourAlert intent={entry.intent} title={entry.title} body={entry.body}\n      action={entry.action} dismissLabel={dismissLabel}\n      onDismiss={entry.dismissible ? dismiss : undefined} />\n  )\n}\n\nexport const alerts = createAlertManager({ adapter: { Alert: AppAlert } })\n// Mount where inline alerts should appear:\n<AlertRegion manager={alerts} region="account" />\n\nconst notice = alerts.warning({ id: "billing", title: "Update payment method" }, "account")\nnotice.update({ title: "Payment method updated", intent: "success" })\nnotice.dismiss()'
        }
      </Code>
      <p>
        Call dismiss() rather than entry.onDismiss directly: the manager removes the entry and invokes its callback.
        Mount one AlertRegion per manager and region. Commands also work outside React components.
      </p>
      <h2>UI integration</h2>
      <p>
        Use your application’s installed components and CSS, including local shadcn components. Fluent’s packaged
        adapter supplies its standard MessageBar composition and needs an existing FluentProvider. An adapter is
        registered once on createAlertManager; no primitive selector is required.
      </p>
    </PackageOverview>
  )
}
