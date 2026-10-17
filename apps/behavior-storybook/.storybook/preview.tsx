import { TooltipProvider } from "@buildkitgg/shadcn-baseui-kit"
import { definePreview } from "@repo/storybook-config/preview"
import { StrictMode } from "react"
import { ErrorBoundary } from "react-error-boundary"
import "@buildkitgg/shadcn-baseui-kit/styles.css"
import "../../../packages/shadcn-baseui-kit/.storybook/preview.css"
import "../src/styles.css"
export default definePreview({
  parameters: {
    layout: "padded",
    options: {
      storySort: {
        order: [
          "Getting started",
          ["Welcome", "Architecture"],
          "Core",
          ["*", ["Overview", "*"]],
          "React",
          ["*", ["Overview", "*"]],
          "shadcn",
          ["*", ["Overview", "*"]],
          "Fluent UI",
          ["*", ["Overview", "*"]]
        ],
        method: "alphabetical",
        includeNames: true
      }
    }
  },
  decorators: [
    (Story, context) => (
      <StrictMode>
        <ErrorBoundary key={context.id} fallback={<p role="alert">This example could not render.</p>}>
          <TooltipProvider>
            {context.parameters.buildkitCatalog ? (
              <div className="catalog-surface">
                <Story />
              </div>
            ) : (
              <Story />
            )}
          </TooltipProvider>
        </ErrorBoundary>
      </StrictMode>
    )
  ]
})
