// Generated from the upstream style catalog.
import type { Meta, StoryObj } from "@storybook/react-vite"
import { PackageOverview } from "./PackageOverview.js"
const meta = {
  title: "shadcn/Styles",
  component: PackageOverview,
  args: { name: "shadcn-baseui-nova" },
  parameters: { buildkitDocumentation: true, layout: "fullscreen", controls: { disable: true } }
} satisfies Meta<typeof PackageOverview>
export default meta
type Story = StoryObj<typeof meta>
export const Luma: Story = { args: { name: "shadcn-baseui-luma" } }
export const Lyra: Story = { args: { name: "shadcn-baseui-lyra" } }
export const Maia: Story = { args: { name: "shadcn-baseui-maia" } }
export const Mira: Story = { args: { name: "shadcn-baseui-mira" } }
export const Nova: Story = { args: { name: "shadcn-baseui-nova" } }
export const Rhea: Story = { args: { name: "shadcn-baseui-rhea" } }
export const Sera: Story = { args: { name: "shadcn-baseui-sera" } }
export const Vega: Story = { args: { name: "shadcn-baseui-vega" } }
