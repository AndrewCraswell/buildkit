import { defineSettings } from "@buildkitgg/scaffolder"

/** The line width of the generated app's formatter. The engine lays out the JSON it writes to fit it. */
export const printWidth = 120

/**
 * Buildkit's file names: `buildkit.jsonc` holds your choices, `.buildkit/` holds the lock, and required secrets go in
 * `.env`. The catalog is published, so an upgrade renders the old baseline from the recorded catalog version.
 */
export const settings = defineSettings({ product: "buildkit", printWidth })
