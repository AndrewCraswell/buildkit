import type { Meta, StoryObj } from "@storybook/react-vite"
import { PackageOverview } from "./PackageOverview.js"
const meta = {
  title: "shadcn/shadcn-alerts-manager",
  parameters: { layout: "fullscreen", controls: { disable: true } }
} satisfies Meta
export default meta
export const Overview: StoryObj<typeof meta> = { render: () => <PackageOverview name="shadcn-alerts-manager" /> }
