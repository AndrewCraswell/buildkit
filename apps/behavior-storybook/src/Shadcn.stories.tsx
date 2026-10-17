import type { Meta, StoryObj } from "@storybook/react-vite"
import { ShadcnDemo } from "./ShadcnDemo.js"
const meta = { title: "Themes/shadcn-theme", component: ShadcnDemo } satisfies Meta<typeof ShadcnDemo>
export default meta
export const Appearance: StoryObj<typeof meta> = {}
