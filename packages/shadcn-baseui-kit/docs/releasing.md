# Releases

[Documentation](README.md)

## First release

The initial version is `0.1.0`. Confirm npm scope access and publishing credentials before publishing. Never put
credentials in the repository or a release archive.

1. Sign in to npm and confirm publish access to `@buildkitgg` and availability of `@buildkitgg/shadcn-baseui-kit`.
2. Review the public root exports, peer dependency range, upstream inventory, and preserved MIT notice.
3. Run `pnpm verify` and `pnpm --filter @buildkitgg/shadcn-baseui-kit build-storybook`.
4. Run `pnpm --filter @buildkitgg/shadcn-baseui-kit pack`. Install that exact tarball into separate consumers. Check
   TypeScript resolution, Vite production output, Tailwind 4 coexistence, and a Next.js App Router production build.
   Confirm both CSS exports and the root client directive; inspect the archive for source maps, tests, previews, and
   editable TSX files. Do not substitute a workspace link for this check.
5. Remove `private`, date the changelog, and update the README release status. Review and commit the release changes
   through the normal hooks. Pack again and run `npm publish --dry-run` against the exact tarball to inspect metadata
   and file contents. A dry run does not confirm npm authorization.
6. Publish that reviewed tarball to npm with public access using the maintainer's authenticated release process.
   Publishing is a separate explicit action. Tag the released commit `shadcn-baseui-kit@0.1.0` after success.

Do not put tokens into repository files. Automated publication is not configured; configure npm trusted publishing
against an approved workflow before automating it. Keep verification and publication separate.

## Version policy

Use Beachball (`pnpm change`) for subsequent public package changes. Keep versions independent of the shadcn CLI and
record upstream changes in the changelog. During `0.x`, breaking API, token, or visual changes increment the minor
version; compatible fixes increment the patch. At `1.x`, breaking changes require a major version. Treat exported names,
prop contracts, CSS entry paths, theme tokens, and deliberate visual changes as part of the consumer contract.

Upstream updates are reviewed and released centrally. Pin the registry snapshot in `upstream.json`, compare dependency
and API changes, and regenerate against a staging directory. Preserve notices and document local adaptations. Consumer
installs must never fetch from the registry. Dependency ranges can resolve newer compatible releases, so review the
resolved dependency set for each package release.

Package checks focus on packaging and integration. Upstream owns its component behavior tests; this package retains its
existing smoke checks without duplicating the upstream test suite.
