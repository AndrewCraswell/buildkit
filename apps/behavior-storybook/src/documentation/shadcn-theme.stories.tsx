import type { Meta, StoryObj } from "@storybook/react-vite"
import { PackageOverview } from "./PackageOverview.js"
const meta = {
  title: "Themes/shadcn-theme",
  component: PackageOverview,
  args: { name: "shadcn-theme" },
  parameters: { layout: "fullscreen", controls: { disable: true } }
} satisfies Meta<typeof PackageOverview>
export default meta
export const Overview: StoryObj<typeof meta> = {}
