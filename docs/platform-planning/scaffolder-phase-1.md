# Scaffolder phase 1: SpawnKit's catalog on the engine

Plan for phase 1 of the migration path in [scaffolder-research.md](scaffolder-research.md) §6.4: rewrite SpawnKit's
catalog as manifests on `@buildkitgg/scaffolder`, and switch the CLI and the dashboard to it together. Phase 0 is in
[scaffolder-phase-0.md](scaffolder-phase-0.md). Phase 2, Buildkit's own catalog, waits for a discussion with the owner.

**Status (2026-10-28):** planned. Work happens in `D:\system\worktrees\spawn\scaffolder-catalog` on
`feat/scaffolder-catalog`. The engine isn't on npm yet, so SpawnKit uses a packed tarball of it until the first publish.

## Done when

- Every option set plans; the matrix of every pair of answers, plus each kit, generates, type-checks and builds in
  catalog CI. PRs run a sample; a nightly job runs them all.
- `spawn init`, `spawn add`, `spawn add --replace` within a slot, and `spawn upgrade` from the previous catalog version
  pass through the CLI.
- The dashboard's composer, kit downloads, file preview and `/catalog/v1.json` read the same catalog as the CLI.
- `pnpm verify`, the template smoke test and the browser suites pass.
- No `.spawn/state.json`, `planAddition` or `extensions.ts` text patches are left.

## The catalog

`@spawn/templates` keeps its name and its display exports (hosting, listing, Colyseus services). Its generator becomes a
`CatalogManifest`:

| Engine concept | SpawnKit                                                                                                                                                                                       |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Target         | `spawnkit`, family `game`, with one mode per renderer: `pixi`, `phaser`, `babylon`, `three`                                                                                                    |
| Template       | One per renderer, each limited to its own mode, so the renderer can't change after `init`                                                                                                      |
| Slot           | `physics`, `ui`, `ecs`, `telemetry`. All optional; `ui` defaults to `html-ui`                                                                                                                  |
| Add-on         | `rapier2d`, `arcade`, `matter`, `havok`, `rapier3d`; `html-ui`, `pixi-ui`, `babylon-gui`; `bitecs`, `koota`; `platform-telemetry`, `sentry`; and the tools `vitest`, `playwright`, `storybook` |
| Preset         | The starter kits (`phaser-arcade`, `three-rapier`, …)                                                                                                                                          |
| Point          | `game.systems` (list), `game.simulation` (single), `phaser.config` (map)                                                                                                                       |

Add-on ids are scoped (`@spawnkit/rapier2d`). Their short names are the component ids the dashboard and docs already
use, so `--physics rapier2d` and `spawn add vitest` read the same as before. `supports()` replaces each option's
`renderers` list.

**`game.systems` replaces the `String.replace` patches in `extensions.ts`.** Each renderer's `src/main.ts` is a seed
that imports the generated `spawnkit/systems.ts`, starts every system with its renderer's context (the Pixi app, the
Phaser scene, the Babylon scene and ground, the Three scene), and runs them in its own loop:

```ts
export interface GameSystem {
  /** True while this system pauses the game, as a pause menu does. */
  isPaused?(): boolean
  /** Runs every frame. `paused` is true while any system pauses the game. */
  update?(frame: { delta: number; paused: boolean }): void
  dispose?(): void
}
```

- UI add-ons are systems that pause. Physics add-ons step and draw their demo body, and stop stepping while paused.
- Telemetry starts in its system's setup and tracks `game.started`.
- ECS add-ons fill `game.simulation`. Without one, `main.ts` uses the plain movement simulation in the base.
- Phaser's physics choice goes in `phaser.config`, which `main.ts` spreads into the game config.

**Files that depend on two choices** become contributions of one add-on that checks the other with `ctx.selected()`:
`hud.test.ts` (Storybook with Vitest), `physics.test.ts` (a physics add-on with Vitest), the browser tests (Vitest, per
UI and telemetry) and `e2e/game.spec.ts` (Playwright, per UI). Playwright's `tsconfig.json` and `.gitignore` edits, and
Storybook's `allowBuilds`, become `json`, `lines` and `yaml` contributions.

**Generated files and their classes:**

- `owned`: `spawnkit/systems.ts`, `spawnkit/config.ts`, `spawnkit/vite.ts`, `vendor/spawn-telemetry/**`.
- `seed`: `src/main.ts`, `src/simulation.ts`, `index.html`, `spawnkit.config.ts`, `vite.config.ts`, add-on sources such
  as `src/ui.ts` and `src/physics.ts`, and the config files of tools.
- `sample`: `README.md`, `AGENTS.md`, starter tests, `public/media/cover.svg`. Add-ons write their notes to `docs/*.md`
  samples, so the README never needs editing after `init`.
- `shared`: `package.json`, `tsconfig.json`, `game.config.json`, `.gitignore`, `pnpm-workspace.yaml`.

**Settings:** `defineSettings({ product: "spawn" })`, so the config is `spawn.jsonc` and the state folder stays
`.spawn/`. `.spawn/project.json`, which `spawn link` writes, is untouched.

## Engine changes this needs

Made on a branch of the engine after PR #43 merges, and released before SpawnKit's switch merges:

1. **Stored seed bases** (research §4.5). SpawnKit's catalog is bundled in its CLI and dashboard, not published, so an
   old catalog version can't be fetched. A `seedBases: "stored"` setting keeps each seed's generated text in the lock,
   and `upgrade` merges three-way against it. Buildkit keeps the default, regenerating the base.
2. Whatever else the port shows. The improvements step after phase 1 collects these.

## The CLI

`@spawnkit/cli` keeps its platform commands (`login`, `link`, `deploy`, …) and hands the project commands to the
engine's `runCli`: `init`, `add`, `config`, `upgrade`, `sync`, `check`, `status`, `explain`, `plan`, `catalog`, `schema`
and `recover`. The guided terminal flow becomes the generated wizard. `spawn addons` and `spawn templates` become
`spawn catalog`. The bundle stays one file; the engine's `/cli` entry doesn't load oxc-parser.

New flags follow the engine: `spawn init pixi my-game --physics rapier2d --ui pixi-ui --with vitest`. The dashboard and
agent docs generate them.

## The dashboard

- The composer and project creation build answers, and show the command from the plan's `argv`.
- Kit downloads and the file preview call the pure planner on an empty tree, so they produce what `spawn init` would.
- `/catalog/v1.json` becomes the engine's questionnaire (`catalog --json`) plus SpawnKit's display data.

## Tests

- `@spawn/templates`: `checkCatalog(catalog, { matrix: true })`; a plan per kit; per add-on assertions ported from
  `index.test.ts`, `extensions.test.ts` and `composition.test.ts`; `add`, `--replace` and `upgrade` through `runCli`.
- `scripts/smoke-templates.mjs` installs, type-checks, tests and builds generated games: each kit and a pairwise sample
  per PR, every combination nightly.
- The CLI and dashboard tests move to the new commands and flags.

## Order of work

1. Engine: stored seed bases, then a packed tarball for SpawnKit to use.
2. Catalog: target, slots, add-ons and presets, with the catalog tests.
3. CLI on `runCli`, and its tests.
4. Dashboard composer, downloads, preview and `/catalog/v1.json`.
5. Smoke matrix and browser suites; docs.
6. Swap the tarball for the published engine, then merge.
