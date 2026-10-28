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
  // Better Apps platform packages share inferred types, so they release together at one version. Features don't join.
  groups: [
    {
      name: "better-apps-platform",
      include: ["packages/better-apps/better-apps", "packages/better-apps/cli", "packages/better-apps/drizzle"],
      disallowedChangeTypes: null
    }
  ],
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
