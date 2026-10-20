import { webLightTheme, webDarkTheme } from "@fluentui/react-components"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { FluentDemo } from "./FluentDemo.js"
const meta = {
  title: "Fluent UI/fluentui-theme",
  component: FluentDemo,
  parameters: { controls: { disable: true } }
} satisfies Meta<typeof FluentDemo>
export default meta
type Story = StoryObj<typeof meta>
export const System: Story = {
  parameters: { docs: { description: { story: "Follow the device theme or select an appearance explicitly." } } }
}
export const DarkDefault: Story = {
  name: "Dark default",
  args: { defaultTheme: "dark" },
  parameters: { docs: { description: { story: "Use dark mode as the app default. Reset restores that default." } } }
}
export const CustomTokens: Story = {
  name: "Custom tokens",
  parameters: { docs: { description: { story: "Supply application-specific light and dark Fluent theme tokens." } } },
  args: {
    lightTheme: { ...webLightTheme, colorBrandBackground: "#6d28d9", colorBrandBackgroundHover: "#5b21b6" },
    darkTheme: { ...webDarkTheme, colorBrandBackground: "#8b5cf6", colorBrandBackgroundHover: "#7c3aed" }
  }
}
export const LocalStorage: Story = {
  name: "Local storage",
  args: { storageKey: "buildkit-fluent-story", storage: "localStorage" },
  parameters: { docs: { description: { story: "Persist appearance across reloads and same-origin browser tabs." } } }
}
export const SessionStorage: Story = {
  name: "Session storage",
  parameters: { docs: { description: { story: "Keep the selected appearance for this browser tab’s session." } } },
  args: { storageKey: "buildkit-fluent-session-story", storage: "sessionStorage" }
}

export const PortaledContent: Story = {
  name: "Portaled content",
  args: { showPortal: true },
  parameters: {
    docs: { description: { story: "The Fluent provider applies the selected theme to portaled dialogs." } }
  }
}
