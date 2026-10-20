import { TooltipProvider } from "@buildkitgg/shadcn-baseui-kit"
import { ExampleFrame } from "@repo/storybook-config/examples"
import { definePreview } from "@repo/storybook-config/preview"
import { StrictMode, useEffect, type ReactNode } from "react"
import { ErrorBoundary } from "react-error-boundary"
import "@buildkitgg/shadcn-baseui-kit/styles.css"
import "./preview.css"
function ThemeShell({ theme, children, storyId }: { theme: string; children: ReactNode; storyId: string }) {
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
    return () => document.documentElement.classList.remove("dark")
  }, [theme])
  return <div data-story={storyId}>{children}</div>
}
export default definePreview({
  globalTypes: {
    theme: {
      description: "Color theme",
      toolbar: { icon: "circlehollow", items: ["light", "dark"], dynamicTitle: true }
    }
  },
  initialGlobals: { theme: "light" },
  parameters: {
    layout: "fullscreen",
    options: { storySort: { method: "alphabetical" } },
    viewport: {
      options: {
        mobile: { name: "Mobile", styles: { width: "390px", height: "844px" } },
        desktop: { name: "Desktop", styles: { width: "1280px", height: "800px" } }
      }
    }
  },
  decorators: [
    (Story, context) => (
      <StrictMode>
        <ErrorBoundary key={context.id} fallback={<p role="alert">This example could not render.</p>}>
          <TooltipProvider>
            <ThemeShell theme={context.globals.theme} storyId={context.id}>
              <ExampleFrame
                group="shadcn / shadcn-baseui-kit"
                title={context.name}
                description={context.parameters.docs?.description?.story}
                catalog
              >
                <Story />
              </ExampleFrame>
            </ThemeShell>
          </TooltipProvider>
        </ErrorBoundary>
      </StrictMode>
    )
  ]
})
