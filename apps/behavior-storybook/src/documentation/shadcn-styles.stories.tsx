import type { Meta, StoryObj } from "@storybook/react-vite"
import { Code, Documentation } from "./Documentation.js"
const meta = {
  title: "shadcn/Style selection",
  parameters: { layout: "fullscreen", controls: { disable: true } }
} satisfies Meta
export default meta

export const Overview: StoryObj<typeof meta> = {
  render: () => (
    <Documentation
      title="Select a component style"
      summary="Install one style. Keep the same imports in your app and Buildkit managers."
    >
      <p>
        For individual component usage, see the <a href="https://ui.shadcn.com/docs/components">shadcn documentation</a>
        .
      </p>
      <h2>Install</h2>
      <Code>{`pnpm add @buildkitgg/shadcn-baseui-kit@npm:@buildkitgg/shadcn-baseui-vega`}</Code>
      <h2>Use the shared package name</h2>
      <Code>{`import { Button } from "@buildkitgg/shadcn-baseui-kit"
import "@buildkitgg/shadcn-baseui-kit/styles.css"
import { createModalManager } from "@buildkitgg/shadcn-modals-manager"

export const modals = createModalManager()`}</Code>
      <p>
        The managers resolve the installed application kit through a peer dependency. They need no style prop or
        renderer adapter.
      </p>
      <h2>Read the package defaults</h2>
      <Code>{`import { readFile } from "node:fs/promises"
const url = import.meta.resolve("@buildkitgg/shadcn-baseui-kit/tokens.json")
const tokens = JSON.parse(await readFile(new URL(url), "utf8"))`}</Code>
      <p>
        Tokens are generated from upstream palette data and CSS mappings. They describe package defaults, not app CSS
        overrides. Component layout differences remain in the generated component code.
      </p>
      <h2>Change the style</h2>
      <p>
        Replace the dependency alias with another generated Base UI style. Imports stay unchanged. This selects a style
        for the build; light/dark mode and brand colors can still change through CSS variables.
      </p>
    </Documentation>
  )
}
