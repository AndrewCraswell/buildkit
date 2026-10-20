import type { Meta, StoryObj } from "@storybook/react-vite"
import { ShadcnDemo } from "./ShadcnDemo.js"
const meta = {
  title: "shadcn/shadcn-theme",
  component: ShadcnDemo,
  parameters: { controls: { disable: true } }
} satisfies Meta<typeof ShadcnDemo>
export default meta
type Story = StoryObj<typeof meta>
export const Appearance: Story = {
  parameters: {
    docs: { description: { story: "Select light, dark, or the device theme. Reset restores the application default." } }
  }
}
export const DarkDefault: Story = {
  name: "Dark default",
  args: { defaultTheme: "dark" },
  parameters: {
    docs: { description: { story: "Start in dark mode while allowing the user to override the default." } }
  }
}
export const PersistentSelection: Story = {
  name: "Persistent selection",
  args: { storageKey: "buildkit-shadcn-appearance" },
  parameters: {
    docs: { description: { story: "Save the selected appearance locally. Reload the story to restore the selection." } }
  }
}
export const PortaledContent: Story = {
  name: "Portaled content",
  args: { showPortal: true },
  parameters: {
    docs: { description: { story: "Apply the same appearance to content rendered outside the page’s component tree." } }
  }
}
