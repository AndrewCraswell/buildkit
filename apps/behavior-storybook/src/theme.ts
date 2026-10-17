import { createShadcnTheme } from "@buildkitgg/shadcn-theme"

export const theme = createShadcnTheme({ storageKey: "buildkit-theme-preview" })

// Ordinary application code can update the same store React subscribes to.
export function resetTheme() {
  theme.reset()
}
