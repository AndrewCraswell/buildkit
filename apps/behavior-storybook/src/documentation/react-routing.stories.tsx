import type { Meta, StoryObj } from "@storybook/react-vite"
import { PackageOverview } from "./PackageOverview.js"
function OverviewPage() {
  return <PackageOverview name="react-routing" />
}
const meta = { title: "Routing/React bindings", component: OverviewPage } satisfies Meta<typeof OverviewPage>
export default meta
export const Overview: StoryObj<typeof meta> = {}
