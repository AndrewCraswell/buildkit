import type { Meta, StoryObj } from "@storybook/react-vite"
import { ShadcnDemo } from "./ShadcnDemo.js"
const meta = { title: "shadcn/shadcn-theme", component: ShadcnDemo } satisfies Meta<typeof ShadcnDemo>
export default meta
export const Appearance: StoryObj<typeof meta> = {}
