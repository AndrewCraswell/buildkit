import * as examples from "@catalog"
import type { Meta } from "@storybook/react-vite"
const meta = {
  title: "Components/shadcn-baseui-kit/Feedback",
  parameters: { controls: { disable: true }, buildkitCatalog: true }
} satisfies Meta
export default meta
export const Alert = examples.Alert
export const Empty = examples.Empty
export const Progress = examples.Progress
export const Skeleton = examples.Skeleton
export const Sonner = examples.Sonner
export const Spinner = examples.Spinner
export const Toast = examples.Toast
