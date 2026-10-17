// @ts-check

/**
 * Beachball manages versioning and changelogs for the workspace packages.
 * Contributors run `pnpm change`; GitHub prepares release PRs and publishes reviewed versions.
 *
 * @type {import("beachball").BeachballConfig}
 */
module.exports = {
  branch: "origin/main",
  access: "public",
  ignorePatterns: [
    "**/*.test.{ts,tsx}",
    "**/*.stories.tsx",
    "**/.storybook/**",
    "**/tests/**",
    "**/*.md",
    "**/tsconfig*.json",
    "**/.oxlintrc.json"
  ]
}
