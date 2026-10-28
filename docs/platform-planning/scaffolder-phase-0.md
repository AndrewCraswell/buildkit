# Scaffolder phase 0: build the engine

Plan for phase 0 of the migration path in [scaffolder-research.md](scaffolder-research.md) §6.4: build
`@buildkitgg/scaffolder` in Buildkit, and port SpawnKit's engine tests as engine tests. Phase 1 then moves SpawnKit's
catalog onto the engine, and phase 2 builds Buildkit's catalog.

**Status (2026-10-28):** M1 to M4 are built on the `feat/scaffolder` branch (worktree
`D:\system\worktrees\buildkit\scaffolder`), not yet committed or merged. The package is still private. Every
`pnpm verify` step passes except the docs site build, which ran out of memory on the owner's machine with or without the
new pages (Windows error 1455); with `buildConcurrency: 4` it builds, scaffolder pages included. Where the build differs
from this plan:

- Code edits are a separate export, `@buildkitgg/scaffolder/edit/code`, so `edit` doesn't load oxc-parser.
- `pnpm test` also runs the temp-folder tests, so coverage counts apply. CI runs them again on Windows and macOS.
- `ResolveContext.provided()` returns `unknown`, so an add-on checks what a provider gives it instead of casting.
- The engine doesn't use `ts-pattern`.

## Done when

Phase 0 is milestones M1 to M3. It's done when:

- the package builds, type-checks, lints and passes `pnpm verify`, with coverage at or above its thresholds;
- a fixture catalog can `init` a project, `add` to it, `add --replace` within a slot, and `upgrade` it to a newer
  catalog version, all through the CLI builders, with `--dry-run --json` output that matches the envelope (research
  §4.5);
- the ported SpawnKit tests and the engine tests listed in research §4.3 pass;
- the package is still private (incubating).

M4 can run alongside phase 2.

## Package layout

- **Where:** `packages/tooling/scaffolder`, next to `dev-domains`, which is the other Node tool published as
  `@buildkitgg/*`.
- **What it is:** `@buildkitgg/scaffolder`, `private: true`, ESM, Node 24 or later. Like the rest of the repo, it builds
  with `tsc -p tsconfig.build.json` and tests with co-located Vitest.
- **Product file names are settings.** Buildkit uses `buildkit.jsonc` and `.buildkit/`. SpawnKit picks its own, so the
  engine never hard-codes either.

**Exports**, one entry file each (research §4.1):

| Export                           | Contents                                                                                                    | Runs in                 | Milestone                       |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------- |
| `@buildkitgg/scaffolder`         | Manifest types and `define*` helpers, resolver, planner on a virtual tree, ownership, merges, state schemas | Anywhere: no fs, no git | M1                              |
| `@buildkitgg/scaffolder/edit`    | Pure transforms: `json`, `lines`, `env` first; `yaml` and `code` later                                      | Anywhere                | M1, then M4                     |
| `@buildkitgg/scaffolder/node`    | Filesystem snapshot into the virtual tree, safe apply, apply lock, journal, backups, `recover`, path checks | Node                    | M1                              |
| `@buildkitgg/scaffolder/cli`     | `citty` command builders, the generated wizard and its flags, the JSON envelope, exit codes                 | Node                    | M1                              |
| `@buildkitgg/scaffolder/testing` | Fixture-catalog helpers for product catalogs' CI                                                            | Node                    | Phase 1, when SpawnKit needs it |

**Source folders**, one concern each and no barrel files:

```text
src/
  core.ts  edit.ts  node.ts  cli.ts   entry files, one per export
  manifest/   facet registry, defineAddon, defineTarget, Contribution and Migration types
  resolve/    phases: target and mode, options (zod), supports(), slots, requires, conflicts, after, decisions
  plan/       VirtualTree, plan(), operations, fingerprint, Envelope
  ownership/  the five classes, the write rule, normalization (line endings, BOM, final newline), hashing
  merge/      three-way JSON by key path (keyed and set arrays, append, the __proto__ guard), lines
  state/      config and lock schemas (zod), reading and writing them
  points/     M2: point kinds, ordering, entries, renderers
  upgrade/    M3: baselines, catalog versions, migrations
  node/       snapshot, apply, lock, journal, backup, recover, path checks
  cli/        citty builders, envelope printing, exit codes
```

The core, `edit` and `points` folders must not import `node:*`, because SpawnKit bundles the engine into its dashboard
Worker. A lint rule (`no-restricted-imports` on those folders) enforces that.

## Milestones

### M1: plan and apply (the first milestone)

The smallest slice that proves the engine end to end: SpawnKit's current abilities, rebuilt on the new contracts.

- **Manifests:** `defineAddon`, `defineTarget`, `defineTemplate`, `defineSlot` and `definePreset`, with the contribution
  kinds `dependency`, `script`, `env`, `file`, `json`, `lines`, `command` and `notice` (research §4.6). `entry` waits
  for M2.
- **Resolver:** the template's answers become a selection (required add-ons, slot answers, optional add-ons, then
  `requires`), plus target and mode, options validated with zod, `supports()`, `slot`, `requires`, `conflicts` and
  `after`. Problems come back as structured `needs-decision` choices, never as thrown errors.
- **Planner:** a pure `plan()` on a virtual tree. It returns operations, decisions and conflicts, plus a fingerprint.
- **Ownership:** all five classes, the one write rule, normalization before hashing, and the transitions in research
  §4.3. Seeds are created once; merging them on later changes is M3.
- **Merges:** JSON and JSONC by key path, with keyed and set arrays, `append`, provenance per key (`introduced` or
  `adopted`), and the `__proto__` guard. Also ordered lines for `.gitignore` and by-key for `.env.example`.
- **State:** the config (`buildkit.jsonc`) and the lock (`.buildkit/lock.json`), validated with zod. The lock is written
  last.
- **Apply (`/node`):**
  - snapshot the project into the tree;
  - refuse symlinks, hard links and paths outside the project;
  - create files exclusively;
  - write through a temp file, then rename, with retries on Windows;
  - hold `.buildkit/apply.lock` (pid, host, time) while applying;
  - keep a journal, and back up overwritten files under `.buildkit/backup/<fingerprint>/`;
  - `recover` rolls back an interrupted apply.
- **Wizard (`/cli`):** generated from the catalog, with no per-add-on CLI code (research §4.11):
  - the template, and the mode;
  - each slot: yes or no for optional slots, then which one;
  - the optional add-ons in one multi-select;
  - the options each chosen add-on lists in `ask`;
  - required secrets, masked;
  - a summary with the required add-ons and anything `requires` pulled in, then one confirmation.

  The same answers come from flags (`--<slot>`, `--no-<slot>`, `--with`, `--without`, `--set`, `--preset`), and
  `catalog --json` describes the whole questionnaire.

- **CLI (`/cli`):** builders for `init`, `add` (with `--replace`), `catalog` and `recover`. Every command takes
  `--dry-run`, `--json`, `--out`, `--plan` and `--yes`, and returns the envelope and exit codes from research §4.5.
  `apply` re-plans from the plan's request and compares fingerprints. A cancelled prompt exits 130, as SpawnKit's does;
  research §4.5's exit-code table has no code for it yet.
- **Not in M1:** extension points, text merges, upgrades and migrations, YAML, code edits, catalog fetching.

**M1 is done when** a fixture catalog can do the following. The catalog has a base target and one template with a
required add-on, an optional add-on, an optional database slot (two choices and a default), a required slot, and an
add-on that requires another. It can:

- `init` a project in a temp folder;
- `add` an add-on, with a `package.json` the user has edited;
- `add --replace` within a slot;
- re-apply the same plan as a no-op;
- reach the same plan fingerprint through scripted wizard answers and through the equivalent flags.

The ported tests for those paths, and the research §4.3 engine tests that M1 covers, must pass.

### M2: extension points

- `definePoint`, the six kinds, ordering bands with `before` and `after`, and typed entries (`ref`, `call`, `value`).
- The TypeScript renderer, and generated files with a header naming their contributors.
- `if-present` contributions, override exports by band and id, and wiring every point at `init`.

This unblocks phase 1: SpawnKit's `game.systems` point replaces its text patches.

### M3: upgrade

- Three-way text merges for seeds (research §3.3).
- Catalog versions, the `catalog-mismatch` decision, and baselines regenerated and checked against `genHash`.
- Migrations: codemods, package bumps, option rewrites, and agent tasks.
- The `upgrade`, `sync` and `check` commands.
- Resolving conflicts by re-planning (`--resolve`), and plan artifacts with a patch per path.

### M4: the rest of v1 (alongside phase 2)

- `config`, `status`, `explain`, `plan show`, `catalog fetch` and `schema`.
- YAML edits for CI workflows.
- Code edits with oxc-parser and magic-string, for adopting existing projects.
- Catalog fetching, caching and integrity checks.

## New dependencies (approved 2026-10-28)

The repo rule is that a library not already in [the tech stack](../tech-stack.md) needs a human decision. The owner
approved all of these on 2026-10-28. Add each one to `docs/tech-stack.md` in the change that first uses it. The engine
also uses `zod`, `citty` and `@clack/prompts` (prompts on a TTY), which are already in the stack.

| Library                       | For                                                                                          | Needed in | Notes                                                                                                                 |
| ----------------------------- | -------------------------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------- |
| `jsonc-parser` 3.3.1          | Reading and editing `buildkit.jsonc`, `tsconfig.json` and other JSONC while keeping comments | M1        | Needs a wrapper: 3.3.1's `parse()` treats a `__proto__` key as the prototype. 4.0.0-next is ESM-only and not `latest` |
| `diff` (jsdiff) 9.0           | Line counts in the envelope, and patches in plan artifacts                                   | M1        |                                                                                                                       |
| `node-diff3` 3.2.1            | Three-way merges for text seeds                                                              | M3        | Low traffic; keep `git merge-file` as an optional backend                                                             |
| `yaml` 2.9.1                  | CI workflow edits                                                                            | M4        | Re-indents on output, so write only when a value changes                                                              |
| `oxc-parser` + `magic-string` | Code edits when adopting a project                                                           | M4        | Oxc has no codemod API, so we write small helpers                                                                     |

## Repo conventions to follow

- **TypeScript:** no `any`, avoid `as`, `noUncheckedIndexedAccess`, and the catalog's TypeScript 7.
- **Tests:** co-located `*.test.ts` run the pure core on in-memory trees. Apply tests that touch a real temp folder are
  `*.integration.test.ts`, with their own Vitest config like dev-domains'. CI runs them on Linux, Windows and macOS,
  because apply has Windows-specific rename retries. That's a new job in `.github/workflows/ci.yml`.
- **Coverage:** the core packages' thresholds (85% lines, statements and functions; 75% branches), excluding the CLI
  `bin` entry.
- **Repo tooling:**
  - a `knip` entry for each export;
  - an API report through `pnpm api:update`;
  - a README, and a docs page in the packages index;
  - `pnpm verify` before every commit.

## Tests to port from SpawnKit

Inventory of `D:\spawn` on 2026-10-28. `D:\spawn` has uncommitted edits in these files, so the line numbers are against
its working tree, not HEAD (`d6be66f`), and may shift.

**What's there:**

- 217 test cases once `it.each` is expanded:
  - 103 touch the engine;
  - 34 test SpawnKit's catalog content;
  - 80 are platform-only (auth, linking, deploys, listings, media).
- Of the 103 engine cases, only 5 port as-is. The rest assert against SpawnKit's real catalog, so they're rewritten
  against a small fixture catalog: a base target, two add-ons sharing a slot, and one that requires another.
- The 40-case `supports()` matrix in `extensions.test.ts` boils down to 2 engine tests. The full matrix moves to
  SpawnKit's catalog CI in phase 1.

That leaves about 60 distinct engine tests. SpawnKit's pure tests already pass the project to the planner as an
in-memory record (`templates/src/composition.test.ts:11`), and the engine keeps that pattern.

### M1: resolver

Paths are under `D:\spawn\packages\`.

| Engine test                                                                                       | From SpawnKit                                                                    | Port                |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------- |
| Unknown add-ons and `requires` cycles are rejected                                                | `templates/src/index.test.ts:16`                                                 | As-is               |
| `requires` resolves each add-on once, before its dependents                                       | `templates/src/index.test.ts:6`                                                  | Rewrite             |
| Conflicts, and one add-on per slot                                                                | `templates/src/index.test.ts:13`                                                 | Rewrite             |
| Required add-ons are pulled in and reported as `{ id, by }`                                       | `templates/src/composition.test.ts:18`                                           | Rewrite             |
| Re-adding an installed add-on is `unchanged`                                                      | `templates/src/composition.test.ts:27`                                           | Rewrite             |
| Every `needs-decision` choice carries a complete request that resolves without asking again       | `templates/src/composition.test.ts:34`, `:41`                                    | Rewrite             |
| Filling an empty slot is not a replace decision                                                   | `templates/src/composition.test.ts:50`                                           | Rewrite             |
| `--replace` is validated: unknown add-ons get suggestions, and the target can't change            | `templates/src/composition.test.ts:55`, `:64`; `cli/src/composition.test.ts:136` | Rewrite             |
| Alternatives offered in a decision are filtered by `supports()`                                   | `cli/src/composition.test.ts:136`                                                | Rewrite             |
| `supports()` returning `true` allows; a string gives `E_UNSUPPORTED`                              | `templates/src/extensions.test.ts:19`–`:28`                                      | Rewrite, as 2 tests |
| Invalid options give `E_INVALID_OPTIONS`, including unsafe project names                          | `templates/src/index.test.ts:60`                                                 | Rewrite             |
| The config round-trips: selections written to `buildkit.jsonc` resolve back to the same selection | `templates/src/composition.test.ts:69`                                           | Rewrite             |

### M1: planner, ownership and JSON merges

| Engine test                                                                                        | From SpawnKit                                                             | Port                                                                             |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| The same request gives the same plan, serialized form and fingerprint                              | `templates/src/index.test.ts:67`                                          | As-is, extended                                                                  |
| `sample` files: your edits and deletions persist                                                   | `templates/src/composition.test.ts:6`                                     | Rewrite                                                                          |
| Orphans: an unedited one is deleted, an edited one is a conflict, an introduced package is removed | `templates/src/composition.test.ts:82`; `cli/src/composition.test.ts:147` | Rewrite, adding the "blocks edited removals" half that `:147`'s title promises   |
| A new path that already exists is a conflict (create only if absent)                               | `cli/src/add.test.ts:49`                                                  | Rewrite                                                                          |
| JSON merges by key, keeping your own fields; re-applying is a no-op                                | `cli/src/add.test.ts:20`                                                  | Rewrite                                                                          |
| A key both sides changed is a conflict, and nothing is written                                     | `cli/src/add.test.ts:37`                                                  | Rewrite; its edited-README half moves to M3, where a non-overlapping edit merges |
| Replacing within a slot removes the introduced dependency, adds the new one and keeps your script  | `cli/src/composition.test.ts:83`                                          | Rewrite                                                                          |
| Any conflict blocks the whole apply                                                                | `cli/src/composition.test.ts:108`                                         | Rewrite                                                                          |
| An unsupported lock `schemaVersion` is refused                                                     | `cli/src/add.test.ts:54`                                                  | Rewrite                                                                          |
| The plan equals what's applied, because `apply` re-plans from the plan's request                   | `cli/src/cli.test.ts:103`                                                 | Rewrite                                                                          |
| `.env` appears in plans as hashes only, and the lock holds no secrets                              | Replaces `cli/src/composition.test.ts:157`, which tests Sentry            | New, generic                                                                     |

### M1: apply and CLI

| Engine test                                                                 | From SpawnKit                                                   | Port    |
| --------------------------------------------------------------------------- | --------------------------------------------------------------- | ------- |
| A path that escapes the project is refused before anything is written       | `cli/src/cli.test.ts:55`                                        | As-is   |
| A failed write removes only what this run created                           | `cli/src/cli.test.ts:83`                                        | As-is   |
| `init` explains a missing destination parent                                | `cli/src/cli.test.ts:120`                                       | As-is   |
| `init` refuses a non-empty destination, and `--dry-run` runs the same check | `cli/src/cli.test.ts:48`, `:114`                                | Rewrite |
| A change made during review fails apply with `E_DRIFT` and exit 4           | `cli/src/composition.test.ts:118`                               | Rewrite |
| `--dry-run` writes nothing; `init` applies and reports `applied`            | `cli/src/cli.test.ts:35`, `:40`                                 | Rewrite |
| Repeated and comma-separated add-on arguments parse                         | `cli/src/composition.test.ts:31`                                | Rewrite |
| `--yes` never makes a decision, and `--json` never prompts (exit 1)         | `cli/src/composition.test.ts:44`; `cli/src/terminal.test.ts:70` | Rewrite |
| One confirmation shows the full plan before any write, and defaults to no   | `cli/src/composition.test.ts:57`; `cli/src/terminal.test.ts:83` | Rewrite |
| Cancelling a choice or the confirmation writes nothing and exits 130        | `cli/src/composition.test.ts:72`; `cli/src/terminal.test.ts:63` | Rewrite |
| Usage errors exit 2 and write nothing                                       | `cli/src/cli.test.ts:89`                                        | Rewrite |
| A failure never reports success                                             | `cli/src/terminal.test.ts:77`                                   | Rewrite |

### M1: new tests for gaps in SpawnKit

SpawnKit has no tests for most of apply's safety features, so these are written fresh:

- **Apply lock:** a stale lock is detected from its pid, host and time. SpawnKit's `add.lock` holds none of these, so
  after a crash every run fails with a raw `EEXIST`.
- **Journal and `recover`:** an interrupted apply rolls back. Test each rollback branch: restoring our own write,
  skipping an unchanged file, reporting a file someone else changed, and removing directories we created. SpawnKit keeps
  a journal, but nothing reads it.
- **Writes:** every write goes through a temp file and a rename, and the lock file is written last.
- **Path checks:** absolute paths, backslashes and the empty path are refused, and so are:
  - symlinked segments, hard links and non-file targets;
  - Windows cross-drive paths;
  - case collisions and Windows reserved names.

  Legitimate names like `..foo` are allowed. SpawnKit's strictest checker, `validateSourcePath` (`cli/src/source.ts:16`,
  tested at `cli/src/platform.test.ts:128`), already handles most of these and is the model.

- **The `__proto__` guard:** an unsafe key in a JSON file is an error naming the file. SpawnKit throws inside its merge,
  then catches that and reports a generic conflict instead.
- **Two add-ons, one key:** contributing different values to the same key is a plan error that names both add-ons.
- **Other three-way cases:**
  - a file you deleted that the engine wants to update or delete;
  - a dependency you moved to another section;
  - a JSON file you made invalid.
- **Normalization:** a CRLF checkout, a BOM or a missing final newline doesn't turn a file into a conflict. SpawnKit
  compares exact strings.
- **Fingerprints:** drift during planning and during apply, and approving a reviewed plan in a later process with
  `--plan`.
- **Exit 3 for conflicts:** SpawnKit uses exit 1 for errors, decisions and conflicts alike, and never asserts its
  conflict exit code.
- **Templates and the wizard.** SpawnKit's wizard is hand-written: `cli/src/terminal.ts` filters add-on ids inline and
  hard-codes the Storybook question. So these are rewrites against the generated wizard:
  - required add-ons are installed without a question, and their options are never asked;
  - an optional slot asks yes or no first; a required slot asks only which one;
  - a slot's choices are filtered by `supports()`, and a slot with one fitting choice isn't asked (rewrites
    `cli/src/terminal.test.ts:44`);
  - `--yes` takes every default, and a required slot with no default and more than one choice is `needs-decision`;
  - a preset's answers skip their questions;
  - wizard answers and the equivalent flags give the same fingerprint;
  - a required secret is asked with a masked prompt, never appears in the summary, plan or lock, and cancelling there
    writes nothing (rewrites `cli/src/terminal.test.ts:99` and `:119`, which test the Sentry DSN);
  - `catalog --json` describes the same questions the wizard asks.
- **The rest of M1's scope:**
  - keyed and set arrays;
  - provenance (`adopted` or `introduced`);
  - the `.gitignore` line rules;
  - the five engine tests in research §4.3.

### Not ported

- **Catalog content (34 cases):** golden templates, telemetry, Sentry, Storybook, Playwright and the browser tools.
  These become SpawnKit's catalog CI in phase 1, along with the `supports()` matrix.
- **Platform (80 cases):** auth, project linking, deploys, listings and media. These stay in SpawnKit.

## Risks

- **Seed regeneration may not be deterministic** across engine versions (research §7.1). M3 finds out. If the
  cross-version golden tests prove brittle, Buildkit stores seed copies in the lock, as SpawnKit will.
- **Point kinds** (research §7.2): test the six kinds against the first ten add-ons before freezing them. That's part of
  M2.
- **Two consumers from day one.** SpawnKit's CLI and dashboard Worker bundle the engine, so pin it exactly and publish
  canaries (research §6.4).
