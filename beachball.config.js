// @ts-check

/**
 * Beachball manages versioning and changelogs for the workspace packages.
 * Contributors run `pnpm change` to add change files; publishing automation will be added before the first release.
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
