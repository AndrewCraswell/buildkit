import { webLightTheme, webDarkTheme } from "@fluentui/react-components"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { FluentDemo } from "./FluentDemo.js"
const meta = {
  title: "Themes/fluentui-theme",
  component: FluentDemo,
  parameters: { controls: { disable: true } }
} satisfies Meta<typeof FluentDemo>
export default meta
type Story = StoryObj<typeof meta>
export const System: Story = {}
export const DarkDefault: Story = { args: { defaultTheme: "dark" } }
export const CustomTokens: Story = {
  args: {
    lightTheme: { ...webLightTheme, colorBrandBackground: "#6d28d9", colorBrandBackgroundHover: "#5b21b6" },
    darkTheme: { ...webDarkTheme, colorBrandBackground: "#8b5cf6", colorBrandBackgroundHover: "#7c3aed" }
  }
}
export const LocalStorage: Story = { args: { storageKey: "buildkit-fluent-story", storage: "localStorage" } }
export const SessionStorage: Story = {
  args: { storageKey: "buildkit-fluent-session-story", storage: "sessionStorage" }
}
