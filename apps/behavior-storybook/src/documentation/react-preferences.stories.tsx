import type { Meta, StoryObj } from "@storybook/react-vite"
import { PackageOverview } from "./PackageOverview.js"
const meta = {
  title: "React/react-preferences",
  component: PackageOverview,
  args: { name: "react-preferences" },
  parameters: { layout: "fullscreen", controls: { disable: true } }
} satisfies Meta<typeof PackageOverview>
export default meta
export const Overview: StoryObj<typeof meta> = {}
