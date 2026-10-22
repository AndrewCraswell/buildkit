import type { Meta, StoryObj } from "@storybook/react-vite"
import { ConfigurationNotes } from "./ConfigurationNotes.js"
import { PackageOverview } from "./PackageOverview.js"
function OverviewPage() {
  return (
    <PackageOverview name="configuration-core">
      <ConfigurationNotes />
    </PackageOverview>
  )
}
const meta = { title: "Core/configuration-core", component: OverviewPage } satisfies Meta<typeof OverviewPage>
export default meta
export const Overview: StoryObj<typeof meta> = {}
