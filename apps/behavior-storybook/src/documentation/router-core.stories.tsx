import type { Meta, StoryObj } from "@storybook/react-vite"
import { PackageOverview } from "./PackageOverview.js"
function OverviewPage() {
  return <PackageOverview name="router-core" />
}
const meta = { title: "Routing/Core", component: OverviewPage } satisfies Meta<typeof OverviewPage>
export default meta
export const Overview: StoryObj<typeof meta> = {}
