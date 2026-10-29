import { defineSettings } from "@buildkitgg/scaffolder"

/**
 * Buildkit's file names: `buildkit.jsonc` holds your choices, `.buildkit/` holds the lock, and required secrets go in
 * `.env`. The catalog is published, so an upgrade renders the old baseline from the recorded catalog version.
 */
export const settings = defineSettings({ product: "buildkit" })
