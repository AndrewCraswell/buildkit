# Package lifecycle

Public libraries use `@buildkit/*`; shared configuration uses private `@repo/*` packages. Apps remain private. Every
package owns its README, indexed docs, explicit exports, types, build, and relevant tests. Keep Node and browser entry
points separate. React libraries declare React as a peer dependency. Choose source distribution explicitly for shadcn
components.

Packages stay private during incubation. Before publishing, confirm npm scope ownership, review public APIs and MIT
notices, verify the packed artifact in a separate consumer, and configure release credentials. Beachball records
independent package version changes; no automatic publishing is configured. Remove `private` only when ready for
release.

Run `pnpm verify` before committing. CI repeats verification on Windows and Linux. UI changes require browser
acceptance.
