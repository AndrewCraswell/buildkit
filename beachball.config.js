// @ts-check
const { writeFileSync } = require("node:fs")
const { join } = require("node:path")

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
      include: [
        "packages/better-apps/better-apps",
        "packages/better-apps/cli",
        "packages/better-apps/drizzle",
        "packages/better-apps/testing",
        "packages/better-apps/react"
      ],
      disallowedChangeTypes: null
    }
  ],
  hooks: {
    // The scaffolder records its own version in every project's lock, so its source copy follows each bump. The
    // constant is widened to string so its public API report doesn't change with each release.
    postbump(packagePath, name, version) {
      if (name === "@buildkitgg/scaffolder") {
        const comment = "/** The engine's version, recorded in every lock. A test keeps it equal to package.json. */"
        writeFileSync(
          join(packagePath, "src/version.ts"),
          `${comment}\nexport const engineVersion = ${JSON.stringify(version)} as string\n`
        )
      }
    }
  },
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
