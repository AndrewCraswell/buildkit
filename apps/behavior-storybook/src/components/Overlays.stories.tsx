import * as examples from "@catalog"
import type { Meta } from "@storybook/react-vite"
const meta = {
  title: "shadcn/shadcn-baseui-kit/Overlays",
  parameters: { controls: { disable: true }, buildkitCatalog: true }
} satisfies Meta
export default meta
export const AlertDialog = examples.AlertDialog
export const ContextMenu = examples.ContextMenu
export const Dialog = examples.Dialog
export const Drawer = examples.Drawer
export const HoverCard = examples.HoverCard
export const Popover = examples.Popover
export const Sheet = examples.Sheet
export const Tooltip = examples.Tooltip
