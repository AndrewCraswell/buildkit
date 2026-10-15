import { definePreview as defineStorybookPreview } from "@storybook/react-vite"
import { deepMerge } from "./utils/merge.js"

/** Preview annotations accepted by consumers (Storybook injects `addons`). */
type PreviewOverrides = Partial<Omit<Parameters<typeof defineStorybookPreview<[]>>[0], "addons">>

/** Shared Storybook base preview annotations for the monorepo. */
export const basePreview: PreviewOverrides = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    }
  }
}

/**
 * Builds a Storybook `preview` by combining the shared base with an app's
 * overrides (e.g. `decorators` concatenated, `parameters` merged deeply), then
 * running it through Storybook's own `definePreview` so the React renderer
 * (`renderToCanvas`) is wired in.
 *
 * ```ts
 * import { definePreview } from "@repo/storybook-config/preview";
 *
 * export default definePreview({ decorators: [withTheme] });
 * ```
 */
export function definePreview(overrides: PreviewOverrides = {}) {
  return defineStorybookPreview({ addons: [], ...deepMerge(basePreview, overrides) })
}

export default definePreview()
