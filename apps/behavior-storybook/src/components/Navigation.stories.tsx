import * as examples from "@catalog"
import type { Meta } from "@storybook/react-vite"
const meta = {
  title: "Components/shadcn-baseui-kit/Navigation",
  parameters: { controls: { disable: true }, buildkitCatalog: true }
} satisfies Meta
export default meta
export const Breadcrumb = examples.Breadcrumb
export const Command = examples.Command
export const DropdownMenu = examples.DropdownMenu
export const Menubar = examples.Menubar
export const NavigationMenu = examples.NavigationMenu
export const Pagination = examples.Pagination
export const Sidebar = examples.Sidebar
export const Tabs = examples.Tabs
