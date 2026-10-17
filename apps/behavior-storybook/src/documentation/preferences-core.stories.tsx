import type { Meta, StoryObj } from "@storybook/react-vite"
import { PackageOverview } from "./PackageOverview.js"
const meta = {
  title: "Core/preferences-core",
  component: PackageOverview,
  args: { name: "preferences-core" },
  parameters: { layout: "fullscreen", controls: { disable: true } }
} satisfies Meta<typeof PackageOverview>
export default meta
export const Overview: StoryObj<typeof meta> = {}
