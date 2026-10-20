import type { Meta, StoryObj } from "@storybook/react-vite"
import { PreferencesDemo } from "./PreferencesDemo.js"
const meta = {
  title: "React/react-preferences",
  component: PreferencesDemo,
  parameters: { controls: { disable: true } }
} satisfies Meta<typeof PreferencesDemo>
export default meta
type Story = StoryObj<typeof meta>
export const DefaultsAndReset: Story = {
  name: "Defaults and reset",
  args: { scenario: "defaults" },
  parameters: { docs: { description: { story: "Override an app default, then restore it with reset()." } } }
}
export const OptionalValues: Story = {
  name: "Optional values",
  args: { scenario: "optional" },
  parameters: {
    docs: { description: { story: "An unset preference remains undefined until the user supplies a value." } }
  }
}
export const LocalPersistence: Story = {
  name: "Local persistence",
  args: { scenario: "local" },
  parameters: {
    docs: {
      description: {
        story:
          "Change the page size and reload the story. The selection is saved locally and synchronized across same-origin tabs."
      }
    }
  }
}
export const SessionPersistence: Story = {
  name: "Session persistence",
  args: { scenario: "session" },
  parameters: {
    docs: {
      description: { story: "Save a selection for this browser tab. Other tabs keep their own session preferences." }
    }
  }
}
export const JsonImportExport: Story = {
  name: "JSON import and export",
  args: { scenario: "json" },
  parameters: {
    docs: { description: { story: "Import preference overrides from JSON or export the current values." } }
  }
}
