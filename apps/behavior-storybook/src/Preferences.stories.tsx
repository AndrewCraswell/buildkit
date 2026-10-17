import type { Meta, StoryObj } from "@storybook/react-vite"
import { PreferencesDemo } from "./PreferencesDemo.js"
function PreferencesExample() {
  return (
    <main className="shadcn-demo">
      <PreferencesDemo />
    </main>
  )
}
const meta = {
  title: "React/react-preferences",
  component: PreferencesExample,
  parameters: { controls: { disable: true } }
} satisfies Meta<typeof PreferencesExample>
export default meta
export const Playground: StoryObj<typeof meta> = {}
