import * as examples from "@catalog"
import type { Meta } from "@storybook/react-vite"
const meta = {
  title: "Components/shadcn-baseui-kit/Actions",
  parameters: { controls: { disable: true }, buildkitCatalog: true }
} satisfies Meta
export default meta
export const Button = examples.Button
export const ButtonGroup = examples.ButtonGroup
export const Toggle = examples.Toggle
export const ToggleGroup = examples.ToggleGroup
