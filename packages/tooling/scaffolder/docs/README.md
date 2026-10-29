# Architecture and contribution guide

The [package README](../README.md) is the user-facing contract. The design and its decisions are in the Buildkit
planning docs (`scaffolder-research.md` and `scaffolder-phase-0.md`).

| Module          | Responsibility                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------ |
| `src/manifest`  | Manifest types, `define*` helpers and catalog lookups, including short add-on names              |
| `src/resolve`   | Answers to a selection, `requires`, slots, conflicts, ordering, options, `supports()`, questions |
| `src/plan`      | The pure `plan()`, rendering contributions, decisions, argv, the envelope, fingerprints          |
| `src/ownership` | The write rule per file class, and text normalization and hashing                                |
| `src/merge`     | Three-way merges: shared files by key, and seeds by line                                         |
| `src/points`    | Extension points: ordering, entries and the TypeScript renderer                                  |
| `src/state`     | Config and lock schemas, reading them, and writing the config without losing comments            |
| `src/upgrade`   | Semantic versions and migrations                                                                 |
| `src/edit`      | Pure text transforms. `code.ts` is the oxc codemods, exported separately                         |
| `src/node`      | The disk snapshot, apply with its lock, journal and backups, `recover`, artifacts, catalog cache |
| `src/cli`       | Command handlers, the generated wizard, flag parsing and readable output                         |
| `src/testing`   | The fixture catalog and a scripted prompter, used by the tests and not built                     |

## Rules that keep it safe

- **The core never touches the disk.** Everything outside `src/node` and `src/cli` runs in Workers and browsers; a lint
  rule refuses `node:*` imports there. The planner reads through a synchronous `VirtualTree`, and every read goes into
  the fingerprint.
- **Expected problems are data.** The planner returns decisions, conflicts and errors in the plan. It throws `PlanError`
  internally and `plan()` catches it.
- **Every decision choice is a complete request.** Applying it plans without asking again, and the envelope adds the
  equivalent argv.
- **Apply re-plans.** A reviewed plan is untrusted: `applyReviewed` plans its request again and applies only on the same
  fingerprint. `applyPlan` then checks each file against the plan before writing, journals every step, backs up what it
  replaces, and writes the lock last.
- **Nothing is sorted by locale.** Keys and paths sort by code unit, so plans are identical on every machine.

## Tests

`pnpm test` runs everything, including the temp-folder tests in `*.integration.test.ts`. CI also runs those on Windows
and macOS with `pnpm --filter @buildkitgg/scaffolder test:integration`, because apply retries renames on Windows and
case-insensitive file systems change the path checks.

Most tests use the fixture catalog in `src/testing/fixture.ts`: a target with two modes, a template with a required
add-on, optional add-ons, an optional database slot with a default and a required UI slot, an add-on that requires
another, and a version 2 with migrations for upgrade tests.
