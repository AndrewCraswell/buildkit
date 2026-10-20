import type { Meta, StoryObj } from "@storybook/react-vite"
import { PackageOverview } from "./PackageOverview.js"
function OverviewPage() {
  return <PackageOverview name="tanstack-router" />
}
const meta = { title: "Routing/TanStack Router", component: OverviewPage } satisfies Meta<typeof OverviewPage>
export default meta
export const Overview: StoryObj<typeof meta> = {}
