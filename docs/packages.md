# Package lifecycle

Public libraries use `@buildkitgg/*`; shared configuration uses private `@repo/*` packages. Apps remain private. Every
package owns its README, indexed docs, explicit exports, types, build, and relevant tests. Keep Node and browser entry
points separate. React libraries declare React as a peer dependency. Choose source distribution explicitly for shadcn
components.

Packages stay private during incubation. Before publishing, confirm npm scope ownership, review public APIs and MIT
notices, verify the packed artifact in a separate consumer, and configure release credentials. Beachball records
independent package version changes; [GitHub release workflows](releases.md) prepare and publish reviewed releases.
Remove `private` only when ready for release.

Run `pnpm verify` before committing. CI runs full verification on Linux, and dev-domains, scaffolder and `buildkit` CLI
integration tests on Linux, Windows, and macOS. It also generates Buildkit apps and installs, builds and type-checks
them (`pnpm --filter @buildkitgg/cli test:smoke`). UI changes require browser acceptance.
