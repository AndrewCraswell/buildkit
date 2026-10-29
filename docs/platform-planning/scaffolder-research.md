# Scaffolder research: `@buildkitgg/scaffolder`

Research and a proposed design for the shared scaffolder engine that Buildkit and SpawnKit both use. How apps get their
cloud resources and deploy is in [better-apps-deploy.md](better-apps-deploy.md).

**Status (2026-10-28):**

- Nothing is built yet.
- The owner decisions below are settled. The rest is proposed, and becomes the plan when it moves into
  [build-plans.md](build-plans.md) § "Scaffolder".

**Verification marks:**

- No mark: checked against source code, official docs or the npm registry.
- **[3p]:** found only in third-party coverage.
- **[U]:** not verified, or an inference. Check it before relying on it.

Working notes with full detail and a URL for each claim are in the side-session notes folder:

- `research-engines-a.md` and `research-engines-b.md`: the engine research.
- `judge-report.md` and `judge-raw.json`: the review of the first draft.
- `verification-2026-10-28.md`: the check of the unverified items.
- `vp-create.md`: the evaluation of `vp create` as an entry point.

## Decisions so far

| #          | Decision (2026-10-28)                                                                                                                                                  | What changes                                                                                                                       |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| D1         | **No backwards compatibility for SpawnKit.** It has never been released, so state formats, generated games and catalog URLs can change freely                          | There is no state conversion, no byte-identical migration phase and no fixture games. SpawnKit moves straight onto the engine (§6) |
| D4         | **No `@buildkitgg/i18n` package.** Localization is Lingui only. The localization add-on writes its wiring into the app as code you own, and `upgrade` keeps it current | §4.7 and §3.2. The per-request rule ships as the `i18n` rule set in `@buildkitgg/oxlint-config`                                    |
| D2, D3, D5 | **Deploys.** Moved to [better-apps-deploy.md](better-apps-deploy.md), which also holds D6                                                                              | §5                                                                                                                                 |

## Review

A seven-judge panel reviewed the first draft, and a skeptic checked its 35 serious findings: 31 held up. This revision
folds in all 13 must-fix items, apart from two that owner decisions removed: converting SpawnKit's state (D1) and "build
once, promote" (D3). The strongest medium findings are folded in too. Detail is in `judge-report.md`.

## Summary

- **No existing tool does what we need.**
  - Only Copier upgrades projects with a real three-way merge, and only Projen owns generated files.
  - TanStack CLI overwrites edited files whole when it adds an add-on, and Better-T-Stack overwrites without asking.
  - sv, Astro and nuxi patch live files but keep no record of the edits.
  - The engine combines Projen's ownership, Copier's three-way upgrade, Nx's virtual tree and versioned migrations, and
    SpawnKit's review-then-apply safety.
- **Keep SpawnKit's core and generalize it.** SpawnKit already plans whole projects, keeps an ownership record and does
  a three-way add with JSON merged by key. It also has fingerprinted review and a lock, a recovery journal and path
  checks. The engine adds:
  - options per add-on;
  - declarative composition;
  - extension points;
  - merging for text files;
  - upgrades;
  - a state file small enough to commit.
- **Safety comes from one rule:** the engine creates a file only if it doesn't exist, and changes or deletes one only if
  it is byte-for-byte what the engine last wrote, after normalizing line endings. Anything else becomes a decision for
  you.
- **Extension points: adopt them.** Any contributor can define one, entries are typed data, and the generated files hold
  glue only. Users override entries in their own files instead of editing generated ones.
- **Framework adapters: adopt them, honestly.** Add-ons branch on registered facets with exhaustive matching. Runtime
  packages need an integration module for each framework family, and add-ons that write app code (localization) need a
  template set for each. So swapping frameworks means a new adapter **plus** new integration modules and templates, not
  only an adapter.
- **Project state** is split into `buildkit.jsonc` (inputs you can edit; merges like `package.json`) and
  `.buildkit/lock.json` (derived, regenerable with `buildkit sync`).
- **Entry point:** `buildkit init`. Making `vp create @buildkitgg` (Vite+) an entry point is deferred. If it comes back,
  it is a thin front door that hands off to `init` (§4.10).
- **Deployment:** the design is in [better-apps-deploy.md](better-apps-deploy.md). The scaffolder adds capability
  packages and their declarations as app code, wires the Better Apps Vite plugin and CI, and picks no host and writes no
  cloud config (§5).

---

## 1. Engine comparison

### 1.1 Scaffolders and generators

| Engine                                    | Model                                                                                                             | Add-ons and composition                                                                                                                                              | Edits to existing projects                                                                                                                                                                                                                      | Updates and upgrades                                                                                                                                                                                                   | Framework coupling                                         | License    | Maintenance (2026-10)                 |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------- | ------------------------------------- |
| **SpawnKit** (`D:\spawn`, ours)           | `createProjectPlan(options)` computes every file in TS. Modules are `{files, deps, scripts, requires, conflicts}` | `requires`, `conflicts`, and categories that allow one choice each. The resolver returns structured choices (`needs-decision`). Add-ons have no options of their own | `spawn add`: three-way merge of old plan, new plan and current files. JSON is merged by key, and other edited files are reported as conflicts. Approval is fingerprinted, with a lock and a recovery journal                                    | None. It regenerates the baseline and requires it to equal the stored copies byte for byte, so any template change blocks `add`                                                                                        | Browser games only, though the engine code is generic      | private    | Active                                |
| **TanStack CLI** (`@tanstack/cli` 0.72.0) | Framework folder of EJS base templates. An add-on is an `info.json` plus `assets/`                                | `dependsOn`, `exclusive` groups, `phase`, `type`, `priority`, `modes`. Options are `select` only. The documented `conflicts` field is not in the schema              | `tanstack add` needs `.cta.json` and a clean git tree. It regenerates the app and **overwrites changed files whole** after one prompt; only `package.json` and `.env*` are merged. When adding, the exclusive-group check runs only for rsbuild | None                                                                                                                                                                                                                   | Generic engine; the add-ons are TanStack-specific          | MIT        | Very active                           |
| **Better-T-Stack** (3.49.0)               | Closed zod enums per dimension. Handlebars templates go into a virtual FS, then ts-morph processors run           | Compatibility lives in imperative TS tables shared with the web builder                                                                                              | `add` handles add-ons only, with **unconditional overwrite**. `--dryRun` reports only a file count                                                                                                                                              | None. `bts.jsonc` records the choices                                                                                                                                                                                  | Multi-framework, closed matrix                             | MIT        | Very active                           |
| **create-t3-app** (7.40.0)                | One installer per package, copying `with-x-y.tsx` file variants                                                   | Hard-coded exits on bad combinations                                                                                                                                 | Not supported                                                                                                                                                                                                                                   | None                                                                                                                                                                                                                   | Next.js                                                    | MIT        | Maintenance mode                      |
| **Projen** (0.104.17)                     | `.projenrc.ts` components write files from code                                                                   | Code composition; `addOverride`, `patch`                                                                                                                             | Owned files are read-only, carry a marker, and are listed in `.projen/files.json`; orphans are deleted. `SampleFile` is write-once                                                                                                              | Re-synth. Owned files always win; nothing is merged                                                                                                                                                                    | Language-neutral                                           | Apache-2.0 | Very active                           |
| **Copier** (9.19.1) / **Cruft** (2.16.0)  | Jinja templates in git, answers in `.copier-answers.yml`                                                          | Several templates through separate answers files                                                                                                                     | Renders into the project; `_skip_if_exists`                                                                                                                                                                                                     | **Reference update:** render the old version, diff the user's changes, render the new version, re-apply with `git apply --reject`, then run `git merge-file` on the rejected files. `_migrations` run by version range | None (Python, needs git)                                   | MIT        | Copier active; Cruft dormant          |
| **Nx** (24.0.2)                           | Generators are code on a virtual `Tree`; EJS `generateFiles`                                                      | Generators compose; `nx add` runs `init`                                                                                                                             | Through `Tree` with `--dry-run`. `updateJson` **drops JSONC comments**                                                                                                                                                                          | `nx migrate` runs version-keyed migrations and `packageJsonUpdates`, with agent-run migrations since 2026. `nx sync:check` fails CI when derived files drift                                                           | Generic                                                    | MIT        | Very active                           |
| **Angular schematics** (22.2.4)           | `Tree`, `Rule`, `mergeWith(MergeStrategy)`                                                                        | Collections, `ng add`                                                                                                                                                | Virtual tree                                                                                                                                                                                                                                    | `ng update` migrations                                                                                                                                                                                                 | Angular                                                    | MIT        | Active                                |
| **sv** (1.1.1)                            | `defineAddon({options, setup, run})` with AST transforms (`sv-utils`)                                             | `dependsOn`, `runsAfter`, `unsupported()`, typed options with `condition`                                                                                            | Patches live files in place; idempotency is the add-on author's job                                                                                                                                                                             | None for add-ons                                                                                                                                                                                                       | Svelte                                                     | MIT        | Active                                |
| **astro add** (7.4.2)                     | Integrations are npm packages; magicast edits `astro.config`                                                      | Peer dependencies                                                                                                                                                    | Shows a word diff and confirms before writing                                                                                                                                                                                                   | `@astrojs/upgrade` bumps versions [U]                                                                                                                                                                                  | Astro                                                      | MIT        | Active                                |
| **nuxt module add** (4.0.1)               | Modules from the Nuxt registry                                                                                    | `moduleDependencies`                                                                                                                                                 | Uses oxc to find the `modules` array and splices it in place                                                                                                                                                                                    | `onInstall` / `onUpgrade` hooks, with versions in `.nuxtrc`                                                                                                                                                            | Nuxt                                                       | MIT        | Active                                |
| **shadcn** (4.23.0)                       | `registry-item.json`: files with `target`, deps, `registryDependencies`, `cssVars`, `css`, `envVars`              | Registry dependencies; namespaced, URL and GitHub registries                                                                                                         | `add --dry-run/--diff/--view`. Changed files trigger an overwrite prompt that defaults to No. CSS and `.env` are patched                                                                                                                        | None tracked                                                                                                                                                                                                           | React-centric; `registry:file`/`registry:item` are neutral | MIT        | Very active                           |
| **Yeoman** (10.2.1)                       | Run-loop generators, mem-fs, EJS                                                                                  | `composeWith`                                                                                                                                                        | Two-way prompt `Ynaxdh`; `.yo-resolve`                                                                                                                                                                                                          | None                                                                                                                                                                                                                   | Generic                                                    | BSD-2      | Active                                |
| **Hygen** (6.2.11) / **Plop** (4.0.5)     | EJS / Handlebars                                                                                                  | None                                                                                                                                                                 | Line injection with `skip_if`; regex `modify`                                                                                                                                                                                                   | None                                                                                                                                                                                                                   | Generic                                                    | MIT        | Hygen unmaintained; Plop low activity |

### 1.2 File-editing and merge libraries

| Library                                                   | What it does                                    | Keeps formatting       | Fit                                                                                                                                                                                                                                                   |
| --------------------------------------------------------- | ----------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **oxc-parser + magic-string**                             | ESTree AST with byte spans; edits by span       | Fully                  | **Code edits.** Same toolchain as oxlint and oxfmt, with a WASM build. Oxc has no codemod API (issue #22055 was closed as not planned on 2026-05-01), so we write small helpers                                                                       |
| **ast-grep** (`@ast-grep/napi` and `@ast-grep/wasm` 0.51) | tree-sitter patterns, `replace` / `commitEdits` | Fully                  | Good for pattern-based migrations                                                                                                                                                                                                                     |
| **magicast** (0.5.5)                                      | recast+Babel proxy                              | Good                   | 0.x, with experimental helpers. Don't build on it                                                                                                                                                                                                     |
| **ts-morph** (28.0)                                       | TS compiler API                                 | Reprints touched nodes | Heavy, and its TypeScript 7 future is unclear [U]. Avoid                                                                                                                                                                                              |
| **jsonc-parser** (3.3.1 latest; 4.0.0-next.2 is ESM-only) | `modify` + `applyEdits`                         | Mostly                 | **JSON/JSONC, wrapped:** 3.3.1's `parse()` assigns a `__proto__` key as the prototype (fixed upstream in PR #140, unreleased on `latest`). Removing a property also drops the comment beside it. Walk `parseTree` nodes for merging and for the guard |
| **node-diff3** (3.2.1)                                    | diff3 with conflict markers                     | n/a                    | **Text three-way merge**, pure JS. Pass `stringSeparator: /\r?\n/`                                                                                                                                                                                    |
| **`git merge-file`**                                      | The same, through git                           | n/a                    | Optional backend; the core never requires git                                                                                                                                                                                                         |
| **jsdiff** (`diff` 9.0)                                   | Diffs and patches; merge was removed in 8.0     | n/a                    | Showing diffs in plans                                                                                                                                                                                                                                |

### 1.3 Templating file contents

| Option                                                               | Type-checked | Used by                                    | Verdict              |
| -------------------------------------------------------------------- | ------------ | ------------------------------------------ | -------------------- |
| EJS / Eta / Handlebars / Jinja                                       | No           | TanStack, Nx, Plop, Better-T-Stack, Copier | Avoid                |
| Plain TS functions                                                   | Inputs only  | SpawnKit, Projen, sv                       | Small variable files |
| Real files with no placeholders, plus extension points for variation | Yes          | sv templates, shadcn registry              | **Default**          |

---

## 2. Patterns worth adopting

| Pattern                                                                                         | Source                                                               | How we use it                                                                            |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Whole-project plan as a pure function on a virtual tree                                         | SpawnKit; Nx and Angular `Tree`                                      | `plan()` runs without fs or git: in the CLI, the dashboard and the Workers control plane |
| Fingerprinted review; apply only if nothing changed                                             | SpawnKit                                                             | `apply` re-plans and compares fingerprints                                               |
| Lock, recovery journal, rollback, exclusive create, refusing symlinks and hard links            | SpawnKit `add.ts`, `scaffold.ts`                                     | Engine apply, hardened further (§4.5)                                                    |
| Structured decisions instead of errors                                                          | SpawnKit `ResolutionIssue`                                           | Choices are structured requests, not argv strings                                        |
| "`--yes` never picks replacements or overwrites edits"                                          | SpawnKit CLI                                                         | Engine rule                                                                              |
| Exclusive groups                                                                                | TanStack `exclusive`; SpawnKit categories                            | `slot`                                                                                   |
| `dependsOn`, `runsAfter`, `unsupported(reason)`, typed options                                  | sv                                                                   | `requires`, `after`, `supports()`, Zod options exported as JSON Schema                   |
| Named integration slots                                                                         | TanStack integrations                                                | Extension points rendered into generated files                                           |
| Owned files with a marker, `linguist-generated`, a manifest, treating the manifest as untrusted | Projen                                                               | The lock and the `check` command. Orphans are deleted only when unchanged (§4.3)         |
| Write-once sample files                                                                         | Projen `SampleFile`; Copier `_skip_if_exists`                        | The `sample` class                                                                       |
| Upgrade = render old + render new + three-way merge; user deletions persist                     | Copier                                                               | `add`, `config` and `upgrade` share one path                                             |
| Version-range migrations; agent-run migrations                                                  | Copier `_migrations`; Nx 2026                                        | Per-add-on `migrations`                                                                  |
| Derived files checked in CI                                                                     | Nx `sync:check`                                                      | `buildkit check`                                                                         |
| Keyed array merges                                                                              | Kubernetes strategic merge patch [U: well known, not rechecked]      | CI steps by `id`                                                                         |
| Config file plus regenerable lock                                                               | `package.json` + lockfile; Better-T-Stack `bts.jsonc` with `$schema` | `buildkit.jsonc` + `.buildkit/lock.json`                                                 |
| JSON in, JSON out, schema dump; MCP optional                                                    | Better-T-Stack; TanStack (replaced MCP with `--json` + skills)       | One JSON envelope, `schema --json`; skills call the CLI                                  |
| Pure transforms kept separate from I/O                                                          | sv / sv-utils                                                        | `@buildkitgg/scaffolder/edit`                                                            |
| Generate and test every supported combination                                                   | sv `createSetupTest`; SpawnKit smoke tests                           | Catalog CI                                                                               |
| Plan to a file, apply that file                                                                 | Terraform `plan -out` [U]                                            | `plan --out` → `apply --plan`                                                            |

**Avoid:**

- Whole-file overwrite on add (TanStack).
- Unconditional writes (Better-T-Stack).
- Combinatorial variant files (create-t3-app).
- Two-way conflict prompts with no base (Yeoman).
- Hard-coded add-on checks inside base templates.
- Anchor-text `String.replace` patches that silently do nothing when the anchor is missing (SpawnKit `extensions.ts`).

---

## 3. The ideas on the table, evaluated

### 3.1 Extension points

These are owned generated files that the user's config imports. **Verdict: adopt them, under six rules:**

1. **Glue only.** A generated file holds imports, arrays and literals. Logic lives in packages or in starter files.
2. **Typed points, typed entries.**
   - Each point has a **kind**:
     - `list`: Vite plugins.
     - `nest`: providers.
     - `wrap`: `next.config` wrappers.
     - `map`: env schema.
     - `single`: router rewrite.
     - `chain`: middleware.
   - Each point has a payload schema.
   - Entries are **data**, not code strings: `{ ref }`, `{ call: { module, export, args } }` or `{ value }`. Each
     renderer prints them in its own language: TS, TSX, YAML or HTML.
   - Points can have instances, for example `ci.steps@ci.yml#verify`.
   - Point contracts are versioned (`app.providers@2`), so adapters can shim old entries.
3. **Ordered.** Entries have an id (prefixed with the add-on id), a band (`pre | framework | post`) and optional
   `before`/`after`. Rendering is deterministic, and a cycle is a plan error.
4. **Override instead of edit.** A generated file exports its entries by band and by id. The user's file interleaves
   them or replaces one:

   ```ts
   plugins: [...bk.pre, myPlugin(), ...bk.framework, ...bk.post]
   // or: withOverrides(bk.vitePlugins, { "i18n/lingui": lingui({ ... }) })
   ```

   `check` notices overrides, and `upgrade` warns when an overridden entry changes. An `eject` command is deferred.

5. **Wired at init.**
   - Each target wires every point it supports when the project is created, even if the generated file starts empty. So
     `add` never edits your files.
   - The `wire` contribution kind is dropped from v1. Adopting an existing project reuses the target's wiring codemods
     once.
6. **Any contributor can define a point.**
   - Targets and add-ons can both declare points with `definePoint`. Example: the database add-on owns `db.schema`,
     which auth, uploads and jobs contribute to.
   - The point's owner renders it.
   - A contribution to an absent point is either `when: "if-present"` (skipped, and the skip is recorded) or required (a
     plan error).
   - Point ids are checked against a registry when the catalog builds.

**Generated layout:** about three files, split by runtime boundary, in one folder whose name says "generated":
`src/generated/buildkit/{config,client,server}.ts`. Each file has a header listing the add-ons that contributed and the
command that changes it.

**Considered and rejected:** runtime composition through a single Vite plugin with virtual modules. Agents can't see
what it does, it excludes Next.js, and it is harder to debug.

### 3.2 Framework adapters

**Adopt them.** Real differences still have to be handled honestly: locale detection is a request-time design on SSR and
a browser design on an SPA. So:

- **Facets come from a registry**, for example `react`, `vite`, `ssr`, `spa`, `request-middleware`, `root-loader`,
  `router-rewrite`, `server-functions`, `rsc`, `browser-game`. `has()` throws on an unknown facet in catalog CI.
- **Add-ons branch with exhaustive matching:** `match(target.renderModel, { "ssr-loader", spa, rsc })`. A missing case
  is a type error, not a silent fall-through.
- **Ignored options warn.** If an option doesn't apply to the target, for example cookie detection on an SPA, the plan
  carries an `option-ignored` notice.
- **Framework-specific code comes in one of two forms:**
  - **A runtime package with an integration module per framework family.** For example, a Better Apps feature would ship
    a TanStack Start integration [U: package names not settled]. Add-ons resolve the module with
    `ctx.runtimeModule({ "tanstack-start": "…" })`, and a missing family is a plan error.
  - **App code the add-on writes** from a template set per family and mode. Localization works this way (§4.7): there is
    no runtime package, and `supports()` refuses a family the add-on has no templates for.
- **The honest cost of swapping frameworks** is a new adapter, plus a new integration module for each runtime package,
  plus a new template set for each add-on that writes app code. It is not one adapter.

### 3.3 Line-based three-way merge for text files

**Adopt it for `seed` files**, using node-diff3 with a line separator, under these rules:

- **Normalize first** (§4.3): line endings, BOM and the final newline. The engine never runs the project's formatter on
  generated output, and catalog files ship already formatted.
- **Default: report and write nothing.** You resolve conflicts by **re-planning**:

  ```text
  plan --from plan.json --resolve <id>=keep-current|take-incoming|file:<path> --out plan2.json
  ```

  This produces a new reviewed plan with a new fingerprint. `apply` accepts only plans whose status is `planned` or
  `unchanged`.

- **Conflict markers are opt-in and only in text seeds.** `--conflict=markers` never writes markers into JSON or YAML.
  `check` fails while markers remain.
- **Auto-merged hunks are listed separately** in the plan, and a post-apply verify (typecheck) reports failures against
  the plan.
- **Never merge at the AST level.**

---

## 4. Recommended architecture

### 4.1 Packages

| Package                       | Contents                                                                                                      | Runs in                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `@buildkitgg/scaffolder`      | Types and `define*` helpers, resolver, planner on a virtual tree, merge, migrations, config/lock/plan schemas | Anywhere: no `fs`, no git |
| `@buildkitgg/scaffolder/edit` | Pure transforms: `json`, `yaml`, `lines`, `env`, `code` (oxc + magic-string)                                  | Anywhere                  |
| `@buildkitgg/scaffolder/node` | Filesystem snapshot, safe apply, optional `git merge-file`, catalog fetch and cache                           | Node                      |
| `@buildkitgg/scaffolder/cli`  | citty command builders and the JSON envelope                                                                  | Node                      |
| Product catalogs              | Buildkit: `@buildkitgg/catalog` + the `buildkit` CLI. SpawnKit: `@spawn/templates` + the `spawn` CLI          | Product repos             |

### 4.2 Core concepts

| Concept          | What it is                                                                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Catalog**      | A product's versioned package of targets, templates, slots, add-ons, points and presets. It has no hosts: deploys belong to the deploy service (§5)                            |
| **Target**       | Framework + mode, e.g. `tanstack-start/ssr`, `tanstack-start/spa`, `nextjs/app`, `spawnkit/pixi`. It provides base files, facets, wiring, and renderers for the points it owns |
| **Template**     | What `init` offers first. It names a target, and says which add-ons are required (never asked about), which are optional, and which slot questions to ask (§4.11)              |
| **Slot**         | A one-of choice such as the database. A template makes it optional ("Add a database?") or required                                                                             |
| **Preset**       | Saved answers for a template. The wizard asks only what's left                                                                                                                 |
| **Add-on**       | A manifest (§4.6)                                                                                                                                                              |
| **Point**        | A typed extension point, defined by any contributor (§3.1)                                                                                                                     |
| **Contribution** | Data-only output of `contribute()`                                                                                                                                             |
| **Plan**         | Serializable operations, decisions and conflicts, with a fingerprint                                                                                                           |
| **Config**       | `buildkit.jsonc`: the inputs (target, add-ons, options)                                                                                                                        |
| **Lock**         | `.buildkit/lock.json`: derived state (versions, integrity, hashes, shared-key base values and provenance, user deletions)                                                      |
| **Migration**    | A versioned codemod, package bump, option rewrite or agent task                                                                                                                |

### 4.3 File ownership

**The rule, for every class:**

1. Create a path only if it is absent.
2. Overwrite or delete only when the file on disk, after normalizing, hashes to the value the engine recorded when it
   last wrote it.
3. Anything else is a decision, and `--yes` can't make it.
4. Take orphan candidates from the regenerated _old_ baseline, filtered by that hash match, never from the lock's path
   list alone.

**Normalization:**

- Hashes and merges ignore line endings, BOM and the final newline. Files are written back in their existing line
  endings.
- Targets contribute `.gitattributes` (`* text=auto eol=lf`, plus `linguist-generated` for generated paths).
- Generated paths go into the oxfmt and oxlint ignore lists.
- A golden test checks that init, then running the formatter, then `check` still passes.

**Classes** (user-facing labels in brackets):

| Class                          | Examples                                                                                | Engine may                                    | On upgrade or add                                                                                                                                                                   |
| ------------------------------ | --------------------------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `owned` [generated]            | `src/generated/buildkit/*`, assembled CI workflows                                      | Rewrite only under the rule above             | Regenerated. If you edited one: a decision (keep yours, take ours, or move the edit into an override)                                                                               |
| `seed` [starter, merged]       | Routes, `vite.config.ts` as created by the target, the localization wiring (§4.7)       | Create once                                   | Three-way text merge                                                                                                                                                                |
| `sample` [starter, write-once] | `AGENTS.md`, example pages                                                              | Create once                                   | Never touched again; your deletion persists                                                                                                                                         |
| `shared` [config, by key]      | `package.json`, `tsconfig.json`, `.env.example`, `.gitignore`                           | Edit only the keys or lines it **introduced** | Three-way per key. Keys or lines you already had are recorded as **adopted** and never removed. Removing a secret-like `.gitignore` pattern (`.env*`, `*.pem`, `*.key`) always asks |
| `user` [yours]                 | Everything else, including tool-generated files (`routeTree.gen.ts`, compiled catalogs) | Nothing                                       | Never merged. Tool-generated files list their regenerate command in the plan                                                                                                        |

**Transitions:**

- Deleting a `seed` or `sample` file is recorded in the lock and persists.
- Deleting an `owned` file is a decision: recreate it, or disable the entry. It is never silently recreated.
- Any change of class is a decision unless the file is unchanged since the engine wrote it.

**Engine tests:**

- A new owned path already exists (an adopted repo, then `add ci`).
- An upgrade renames an edited owned file.
- You delete an owned file.
- An orphan has edits.
- A `.gitignore` line was already there before the engine added it.

### 4.4 Merge rules

| File kind           | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                         | Library                                       |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| JSON / JSONC        | Three-way per key path. Arrays are ordered and atomic unless the catalog declares a path as **keyed** (strategic merge: CI steps by `id`) or as a **set** (order-insensitive allow-list, e.g. tsconfig `include`, `types`). Supports `append`. Two contributions to the same pointer with different values is a plan error naming both add-ons. Refuse `__proto__`, `constructor`, `prototype` on a walked `parseTree`. Never writes markers | jsonc-parser behind a comment-keeping wrapper |
| YAML                | Same, on the document model. `yaml` 2.9.1 keeps comments and blank lines. It re-indents and re-wraps on output, and its handling of trailing comments is "not completely stable". So write only when a value changed, and cover workflows with golden tests. Use the CST API if a file must stay byte-exact                                                                                                                                  | `yaml` Document API                           |
| `.env.example`      | By key                                                                                                                                                                                                                                                                                                                                                                                                                                       | `edit/env`                                    |
| `.gitignore`        | Ordered lines. A line is removed only if the engine introduced it and no other contribution still needs it                                                                                                                                                                                                                                                                                                                                   | `edit/lines`                                  |
| `package.json` deps | By key. Flag a dependency moved between sections. Opt-in "keep yours if your semver is at or above ours" for Renovate bumps                                                                                                                                                                                                                                                                                                                  | jsonc-parser                                  |
| Other text (`seed`) | Normalized line-based three-way                                                                                                                                                                                                                                                                                                                                                                                                              | node-diff3                                    |
| Binary              | Two-way                                                                                                                                                                                                                                                                                                                                                                                                                                      | hashes                                        |

### 4.5 Config, lock, baseline and plan

**Config** (you can edit it; it merges like `package.json`):

```jsonc
// buildkit.jsonc
{
  "$schema": "https://buildkit.gg/schema/buildkit.json",
  "catalog": "@buildkitgg/catalog", // version comes from package.json (pinned devDependency)
  "template": "saas-app",
  "target": { "id": "tanstack-start", "mode": "ssr" },
  "addons": {
    // keyed by id: one line each, so git merges cleanly
    "@buildkit/i18n": { "locales": ["en", "fr"] },
    "@buildkit/auth-better-auth": {},
    "@buildkit/db-d1": {}
  },
  "declined": ["slot:jobs", "@buildkit/storybook"], // answered "no"; `upgrade` won't ask again (§4.11)
  "environments": "better-apps.environments.jsonc" // read by Better Apps' deploy service
}
```

**Lock** (derived; marked `linguist-generated`; rebuilt with `buildkit sync`):

```jsonc
// .buildkit/lock.json
{
  "schemaVersion": 1,
  "engine": "1.4.0",
  "catalog": { "version": "3.2.0", "integrity": "sha512-…" },
  "addons": { "@buildkit/i18n": { "version": "1.1.0", "source": "catalog" } },
  "files": {
    "src/generated/buildkit/client.tsx": { "class": "owned", "genHash": "…", "diskHash": "…" },
    "lingui.config.ts": { "class": "seed", "genHash": "…" },
    "package.json": {
      "class": "shared",
      "keys": {
        "/dependencies/@lingui~1core": { "base": "^6.10.1", "provenance": "introduced" }
      }
    }
  },
  "deleted": ["src/routes/demo.tsx"],
  "lastApply": { "fingerprint": "…" }
}
```

**Where the merge base comes from (hybrid):**

| File class | Base                                                                                                                                                                          | Verification                                                                                                                                     |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `owned`    | Only the hash. The current catalog regenerates the file; the hash only detects edits                                                                                          | `diskHash` match                                                                                                                                 |
| `shared`   | The base value of each key, stored inline in the lock (small)                                                                                                                 | The stored value itself                                                                                                                          |
| `seed`     | **Buildkit:** regenerated with the recorded engine + catalog pair. **SpawnKit:** stored copies in the lock, because its catalog is bundled privately in the CLI and dashboard | Regenerated output must equal `genHash`. On a mismatch or if the catalog is unavailable, decide per file. Never merge against an unverified base |

**Which catalog version is used:**

- The CLI and catalog are pinned as devDependencies. The lock records the catalog version and integrity hash.
- If the installed catalog differs from the recorded one, `add` and `config` return a `catalog-mismatch` decision:
  upgrade first, or plan with the recorded version from cache. They never mix the two silently.
- `buildkit catalog fetch <version>` pre-warms offline sandboxes.
- Any fetched catalog is integrity-checked before its code runs.
- Old baselines render in an isolated install of the recorded pair, or engine serialization is frozen behind
  cross-version golden tests.
- Keys are sorted by code unit, never `localeCompare`.

**Git merges:**

1. Resolve `buildkit.jsonc`.
2. Take either side of the lock and the generated files.
3. Run `buildkit sync`.

Planning refuses while either file contains conflict markers.

**Apply robustness:**

- Writes go to a temp file, then rename (with Windows retries). The lock is written last.
- `lastApply.fingerprint` makes re-applying the same plan a no-op.
- The lock file `.buildkit/apply.lock` holds the pid, host and time, so a stale lock can be detected.
- `buildkit recover` rolls back from the journal. A gitignored `.buildkit/backup/<fingerprint>/` keeps every file that
  was overwritten or deleted.

**The plan contract:**

- **stdout** carries one bounded JSON envelope:
  - status, fingerprint, baseline source, counts by class;
  - decisions and conflict ids;
  - for each operation: `{path, action, class, linesAdded, linesRemoved}`.
- **Full artifacts** go to `--out` (gitignored `.buildkit/plans/<fp>/`): `plan.json`, patches for each path, and
  `conflicts/<id>/{base,current,incoming}`.
- `--diff=none|user|all` defaults to `user`: changes to your files plus all deletes. Regenerated generated files are
  collapsed.
- Files that may hold secrets (`.env`, `.dev.vars`) show hashes only. Option schemas never hold secrets.
- The plan file is **untrusted input**: `apply` re-plans from the plan's `request` and compares fingerprints.

```ts
type Envelope = {
  status: "planned" | "applied" | "unchanged" | "needs-decision" | "conflict" | "error"
  fingerprint?: string
  baseline?: { source: "installed" | "cache" | "registry" | "stored" | "two-way"; catalogVersion: string }
  decisions?: {
    id: string
    message: string
    choices: { id: string; label: string; request: unknown; argv: string[] }[]
  }[]
  conflicts?: { id: string; path: string; artifacts: string }[]
  operations?: {
    path: string
    action: "create" | "update" | "delete"
    class: string
    linesAdded: number
    linesRemoved: number
  }[]
  packages?: { name: string; section: string; from?: string; to?: string }[]
  env?: { name: string; scope: "server" | "client" | "build"; secret: boolean; required: boolean }[]
  commands?: { run: string; when: "after-apply" | "after-install"; why: string }[] // listed, never run
  migrations?: { id: string; kind: "codemod" | "packages" | "options" | "agent"; description: string }[]
  notices?: { code: string; text: string }[]
  error?: {
    code:
      | "E_DRIFT"
      | "E_LOCKED"
      | "E_INTERRUPTED"
      | "E_BASELINE_UNAVAILABLE"
      | "E_UNSUPPORTED"
      | "E_INVALID_OPTIONS"
      | "E_UNKNOWN_ADDON"
      | "E_CATALOG_MISMATCH"
    message: string
    paths?: string[]
    retryable: boolean
    next?: string[]
  }
}
```

**Exit codes:**

| Code | Meaning                       |
| ---- | ----------------------------- |
| 0    | planned, applied or unchanged |
| 1    | needs-decision                |
| 3    | conflict                      |
| 4    | drift                         |
| 5    | locked or interrupted         |
| 2    | usage or internal error       |

`check` uses the same envelope.

### 4.6 Manifest types (sketch)

```ts
import type { z } from "zod"

/** Registered facet ids; has() throws on an unknown id in catalog CI. */
export type Facet = FacetRegistry[number]
export type RenderModel = "ssr-loader" | "spa" | "rsc" | "browser-game"

export type EntryValue =
  | { ref: { module: string; export: string } } // module: a package, or "./…" from the project root for app code
  | { call: { module: string; export: string; args?: unknown[] } } // args are JSON
  | { value: unknown } // JSON

export type Order = { band?: "pre" | "framework" | "post"; before?: string[]; after?: string[] }

export interface PointDefinition<P extends z.ZodType = z.ZodType> {
  id: string // "vite.plugins", "db.schema", "ci.steps"
  version: number // contract version; adapters may shim older entries
  kind: "list" | "nest" | "wrap" | "map" | "single" | "chain"
  payload: P // schema for entry values
  instances?: boolean // e.g. ci.steps@ci.yml#verify
}

export type Contribution =
  | { kind: "dependency"; name: string; version: string; dev?: boolean }
  | { kind: "script"; name: string; command: string }
  | {
      kind: "env"
      name: string
      scope: "server" | "client" | "build"
      secret: boolean
      required: boolean
      description: string
      example?: string
    }
  | { kind: "file"; path: string; content: string; ownership: "owned" | "seed" | "sample" }
  | { kind: "entry"; point: string; id: string; value: EntryValue; order?: Order; when?: "required" | "if-present" }
  | { kind: "json"; path: string; pointer: string; op: "set" | "append" | "merge"; value: unknown; key?: string } // key = keyed-array identity
  | { kind: "lines"; path: string; lines: string[] }
  | { kind: "registry"; item: string } // shadcn registry item → files + deps
  | { kind: "command"; run: string; when: "after-install" | "after-apply"; why: string }
  | { kind: "notice"; code: string; text: string }

export interface ResolveContext<O> {
  options: O
  target: { id: string; mode: string; family: string; renderModel: RenderModel; has(f: Facet): boolean }
  provided<T>(name: string): T | undefined // typed data from other add-ons, e.g. { dialect: "sqlite" }
}
export interface ContributeContext<O> extends ResolveContext<O> {
  versions: Record<string, string> // catalog-pinned versions
  runtimeModule(map: Record<string, string>): string // per framework family; missing family = plan error
  ignored(option: string, reason: string): void // emits an option-ignored notice
}

export interface Migration {
  version: string // runs when old < version <= new
  description: string
  kind: "codemod" | "packages" | "options" | "agent"
  run?: (tree: VirtualTree) => void | Promise<void>
  options?: (old: unknown) => unknown // rewrites recorded options
  prompt?: string // agent task, surfaced in the plan; never run blind
}

export interface AddonManifest<S extends z.ZodType = z.ZodType> {
  id: string // namespaced: "@buildkit/i18n"
  version: string
  title: string
  description: string
  slot?: string // one per slot: "auth", "database", "jobs"
  provides?: Record<string, unknown> // typed data others read via ctx.provided()
  requires?: string[] // add-on ids, "slot:database", "provides:i18n"
  conflicts?: string[]
  after?: string[] // ordering only
  points?: PointDefinition[] // points this add-on owns and renders
  options?: S
  ask?: string[] // option keys the wizard asks; the rest take their defaults (§4.11)
  supports?(ctx: ResolveContext<z.infer<S>>): true | string
  contribute(ctx: ContributeContext<z.infer<S>>): Contribution[]
  migrations?: Migration[]
  nextSteps?(ctx: ContributeContext<z.infer<S>>): string[]
}

export interface SlotDefinition {
  id: string // "database"
  title: string // "Database"
  question: string // "Add a database?", asked only when a template makes the slot optional
  choose: string // "Which database?"
}

export type SlotPolicy =
  | { required: true; default?: string } // always choose one; asked unless only one add-on fits
  | { required: false; default?: string } // ask yes or no first; a default means yes, preselected

export interface TemplateManifest {
  id: string // "saas-app"
  title: string
  description: string
  target: string // "tanstack-start"
  modes?: string[] // asked when there's more than one
  required?: string[] // add-ons installed every time, never asked about
  optional?: Record<string, { default: boolean }> // offered together in one multi-select
  slots?: Record<string, SlotPolicy> // slots this template offers, asked in this order
}

export interface Answers {
  template: string
  mode?: string
  slots?: Record<string, string | null> // null: "no" to an optional slot
  optional?: string[]
  options?: Record<string, Record<string, unknown>> // keyed by add-on id
}

export interface PresetManifest {
  id: string
  title: string
  answers: Answers // saved answers; the wizard asks only what's left
}
```

**Targets use the same shape:**
`defineTarget({ id, family, modes, facets(mode), renderModel(mode), points, base, wiring })`. Templates, slots and
presets are data (`defineTemplate`, `defineSlot`, `definePreset`); §4.11 describes how they drive `init`.

**No hosts, integrations or deploy engines (D5).** Add-ons don't declare `needs()` or resources. Cloud resources come
from capability declarations in code ([better-apps-deploy.md](better-apps-deploy.md) §2), runtime glue for a cloud lives
in Better Apps ([better-apps-deploy.md](better-apps-deploy.md) §4), and deploys belong to the deploy service
([better-apps-deploy.md](better-apps-deploy.md) §5). `provides` is typed data passed between add-ons; it has nothing to
do with capability packages.

**Resolution runs in fixed phases:**

1. Template, target and mode.
2. Answers become a selection: the template's required add-ons, the slot answers and the optional add-ons, then whatever
   `requires` pulls in.
3. Options.
4. `supports()`.
5. `contribute()`.
6. Render the points.

**Trust:** catalogs are first-party only in v1, because manifests are code.

### 4.7 Worked example: localization (Lingui, written as app code)

There is no `@buildkitgg/i18n` package (D4). The add-on writes the Lingui wiring into the app as ordinary code you own:

- **The wiring is `seed` files** in `src/i18n/` plus `scripts/i18n.ts`, copied from real files in the add-on's
  `templates/` folder. You can read and edit them like any other app code. `upgrade` three-way merges template fixes
  into them (§3.3), so a fix reaches you as a reviewed merge, not a package bump.
- **Options flow into one file,** `src/i18n/locales.ts`. Adding a locale later with `buildkit config` is one merge
  there.
- **Generated glue points at your files.** The entries below reference app modules (`./src/i18n/…`, relative to the
  project root), and the renderers turn those into relative imports from `src/generated/buildkit/`. If you move or
  delete one of those files, `check` names the entry that imports it.
- **The templates start from Lingui's official example** (`lingui/js-lingui/examples/tanstack-start`, updated
  2026-09-18). It wires Lingui in three places:
  - request middleware in `src/start.ts` detects the locale and creates the instance;
  - the router reads that instance with `getGlobalStartContext()`;
  - a router wrapper sets `Wrap`, `dehydrate` and `hydrate`, so the client builds the same instance.

  Our additions:
  - `rewrite` for localized URLs (the example uses a `$lang` route parameter);
  - the native `macroTransform` (the example uses Babel);
  - the Workers specifics.

- **The per-request rule is a lint rule, not a runtime guard.**
  - A Worker serves concurrent requests, so the global Lingui `i18n` or the core `t` macro on the server leaks one
    user's locale to another. The `i18n` rule set of `@buildkitgg/oxlint-config` bans both, and the add-on adds that
    rule set to the lint config.
  - `.oxlintrc.json` can't extend a package: "Package imports are not supported". So the add-on contributes a
    `lint.extends` entry, which the target spreads into a TypeScript lint config: the `lint` block of `vite.config.ts`
    under Vite+, or `oxlint.config.ts`.
- **Tradeoff:** Renovate can't deliver a wiring fix. It reaches an app only when the app runs `buildkit upgrade`, and
  heavy local edits make that merge a conflict to resolve. A fix that a text merge can't carry ships as a `codemod` or
  `agent` migration (§4.6).

```ts
import { defineAddon, match, type Contribution } from "@buildkitgg/scaffolder"
import { z } from "zod"
import { emptyCatalog, linguiConfig, localesModule, template } from "./files"

export default defineAddon({
  id: "@buildkit/i18n",
  version: "1.0.0",
  title: "Localization",
  description: "Lingui, wired into the app as code you own: locale detection, catalogs, localized URLs.",
  provides: { i18n: { library: "lingui" } },
  supports: ({ target }) =>
    target.family !== "tanstack-start" ? "TanStack Start only in v1: the wiring is written as Start app code." : true,
  options: z.object({
    sourceLocale: z.string().default("en"),
    locales: z.array(z.string()).min(1).default(["en"]),
    detection: z.array(z.enum(["url", "cookie", "header", "navigator"])).default(["url", "cookie", "header"]),
    localizedUrls: z.boolean().default(true)
  }),
  contribute(ctx) {
    const { options, target, versions } = ctx
    // App code you own, from templates/<mode>/<path> or templates/common/<path>; merged on upgrade.
    const seed = (path: string): Contribution => ({
      kind: "file",
      path,
      content: template(target.mode, path),
      ownership: "seed"
    })
    const c: Contribution[] = [
      { kind: "dependency", name: "@lingui/core", version: versions["@lingui/core"]! },
      { kind: "dependency", name: "@lingui/react", version: versions["@lingui/react"]! },
      { kind: "dependency", name: "@lingui/cli", version: versions["@lingui/cli"]!, dev: true },
      { kind: "dependency", name: "@lingui/vite-plugin", version: versions["@lingui/vite-plugin"]!, dev: true },
      { kind: "script", name: "i18n:extract", command: "node scripts/i18n.ts extract" },
      { kind: "script", name: "i18n:check", command: "node scripts/i18n.ts check" },
      { kind: "script", name: "i18n:translate", command: "node scripts/i18n.ts translate" },
      { kind: "file", path: "lingui.config.ts", content: linguiConfig(options), ownership: "seed" },
      { kind: "file", path: "src/i18n/locales.ts", content: localesModule(options), ownership: "seed" },
      seed("src/i18n/instance.ts"),
      seed("src/i18n/provider.tsx"),
      seed("src/i18n/router.tsx"),
      seed("scripts/i18n.ts"),
      ...options.locales.map((l): Contribution => ({
        kind: "file",
        path: `src/locales/${l}.po`,
        content: emptyCatalog(l),
        ownership: "sample"
      })),
      // The per-request rule. The target already depends on @buildkitgg/oxlint-config for its base rules.
      {
        kind: "entry",
        point: "lint.extends",
        id: "i18n",
        value: { ref: { module: "@buildkitgg/oxlint-config/i18n", export: "default" } }
      },
      // Wrap renders I18nProvider; dehydrate and hydrate carry the locale and messages to the client.
      {
        kind: "entry",
        point: "router.wrappers",
        id: "lingui",
        value: { ref: { module: "./src/i18n/router.tsx", export: "withI18n" } }
      },
      {
        kind: "entry",
        point: "html.attributes",
        id: "lang-dir",
        value: { ref: { module: "./src/i18n/locales.ts", export: "htmlLangDir" } }
      },
      {
        kind: "entry",
        point: "ci.steps@ci.yml#verify",
        id: "check",
        order: { after: ["typecheck"] },
        value: { value: { name: "Check translations", run: "pnpm i18n:check" } }
      },
      {
        kind: "entry",
        point: "storybook.decorators",
        id: "provider",
        when: "if-present",
        value: { ref: { module: "./src/i18n/provider.tsx", export: "localeDecorator" } }
      },
      {
        kind: "entry",
        point: "vite.plugins",
        id: "lingui",
        order: { band: "pre" },
        value: { call: { module: "@lingui/vite-plugin", export: "lingui", args: [{ macroTransform: true }] } }
      }
    ]
    c.push(
      ...match(target.renderModel, {
        // SSR: detect per request and create the instance in middleware; the router wrapper dehydrates it.
        "ssr-loader": (): Contribution[] => [
          seed("src/i18n/server.ts"),
          {
            kind: "entry",
            point: "server.requestMiddleware",
            id: "locale",
            value: { ref: { module: "./src/i18n/server.ts", export: "localeMiddleware" } }
          }
        ],
        // SPA: the root loader runs at prerender time, so detect in the browser before the first render.
        spa: (): Contribution[] => {
          for (const d of options.detection.filter((d) => d === "cookie" || d === "header"))
            ctx.ignored(`detection.${d}`, "SPA pages are served statically; detection runs in the browser.")
          return [
            seed("src/i18n/browser.ts"),
            {
              kind: "entry",
              point: "app.bootstrap",
              id: "bootstrap",
              value: { ref: { module: "./src/i18n/browser.ts", export: "bootstrapLocale" } }
            }
          ]
        },
        rsc: () => [], // excluded by supports()
        "browser-game": () => [] // excluded by supports()
      })
    )
    if (options.localizedUrls) {
      if (target.has("router-rewrite"))
        c.push(seed("src/i18n/rewrite.ts"), {
          kind: "entry",
          point: "router.rewrite",
          id: "locale",
          value: { ref: { module: "./src/i18n/rewrite.ts", export: "localeRewrite" } }
        })
      else ctx.ignored("localizedUrls", "This target has no router rewrite.")
    }
    return c
  },
  nextSteps: () => ["Wrap strings with t`…` or <Trans> from useLingui(), then run pnpm i18n:extract."]
})
```

**The files it writes.** All are `seed` except the catalogs. A mode switch with `buildkit config` plans the swap of
`server.ts` and `browser.ts` under the usual rule: an edited file is a decision, never a silent delete.

| File                      | Class  | SSR | SPA | What it does                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------- | ------ | --- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lingui.config.ts`        | seed   | yes | yes | Locales, catalog paths, `.po` format                                                                                                                                                                                                                                                                                                                                               |
| `src/i18n/locales.ts`     | seed   | yes | yes | Everything from the options: locales, source locale, detection order. Also `htmlLangDir(locale)` for `<html lang dir>`, including RTL                                                                                                                                                                                                                                              |
| `src/i18n/instance.ts`    | seed   | yes | yes | `createI18n(locale, messages)` returns a new `setupI18n()` instance on every call. `loadMessages(locale)` imports `src/locales/<locale>.po` as a module, so Vite bundles each locale as a chunk and the Worker needs no filesystem                                                                                                                                                 |
| `src/i18n/provider.tsx`   | seed   | yes | yes | `LocaleProvider` renders Lingui's `I18nProvider` for a given instance. `localeDecorator` is the Storybook decorator                                                                                                                                                                                                                                                                |
| `src/i18n/router.tsx`     | seed   | yes | yes | `withI18n(router)` sets `Wrap` to `LocaleProvider`. On the server it takes the request's instance from `getGlobalStartContext()` and dehydrates locale and messages; `hydrate` rebuilds the same instance on the client. Modelled on Lingui's `routerWithLingui`                                                                                                                   |
| `src/i18n/server.ts`      | seed   | yes | no  | `localeMiddleware`, made with `createMiddleware({ type: "request" })`, checks the URL prefix, then the cookie, then `Accept-Language`. It creates the request's instance and passes `{ locale, i18n }` on with `next({ context })`                                                                                                                                                 |
| `src/i18n/browser.ts`     | seed   | no  | yes | `bootstrapLocale` detects from the URL and `navigator.languages`, then loads messages before the first render                                                                                                                                                                                                                                                                      |
| `src/i18n/rewrite.ts`     | seed   | yes | yes | `localeRewrite`, an `{ input, output }` pair for `createRouter({ rewrite })` (router-core 1.132.0 and later). `input` strips the locale prefix; `output` adds it back, so app links stay locale-free. On the server, `output` reads the request's locale from `getGlobalStartContext()`, never from `localStorage` as the TanStack guide's example does. Only with `localizedUrls` |
| `scripts/i18n.ts`         | seed   | yes | yes | `extract` (extract with clean, then compile), `check` (fails CI on missing translations or invalid ICU), `translate` (AI translation, using translator comments as context)                                                                                                                                                                                                        |
| `src/locales/<locale>.po` | sample | yes | yes | Empty catalogs. Yours from then on                                                                                                                                                                                                                                                                                                                                                 |

The Start middleware and router APIs above were checked against TanStack's docs and source on 2026-10-28. One part isn't
in the guides: middleware context reaches the router through `getGlobalStartContext()`, which exists in Start's source
and is what Lingui's example uses.

**Where each target renders these entries.** The generated files live in `src/generated/buildkit/`; your files import
them once, at init. The points are shared by every add-on; this one supports only TanStack Start, so the Next.js and
SpawnKit columns show how other add-ons' entries land.

| Point                      | TanStack Start SSR                                                                                                                                                                                      | TanStack Start SPA                                       | Next.js (App Router)                                                      | SpawnKit game                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------- |
| `vite.plugins`             | `config.ts`, spread in bands in `vite.config.ts`                                                                                                                                                        | same                                                     | n/a (Turbopack). Under vinext the target is Vite [U]                      | `spawnkit/generated/config.ts`    |
| `app.providers`            | `client.tsx`, used in `__root.tsx`                                                                                                                                                                      | same                                                     | `app/_generated/buildkit/client.tsx` (`"use client"`) in `app/layout.tsx` | unsupported (no React)            |
| `server.requestMiddleware` | `server.ts`, imported by `src/start.ts` `createStart(() => ({ requestMiddleware }))`. The target's `start.ts` lists Start's CSRF middleware first, because Start stops adding it once `start.ts` exists | unsupported: page requests are static                    | `proxy.ts` chain (Next 16 renamed `middleware.ts`)                        | unsupported                       |
| `router.wrappers`          | `client.tsx`, applied in `getRouter()` in `src/router.tsx`                                                                                                                                              | same                                                     | n/a                                                                       | n/a                               |
| `lint.extends`             | `config.ts`, spread into `lint.extends` in `vite.config.ts` (Vite+) [U: the `lint` block's `extends` accepting imported configs]                                                                        | same                                                     | same, or `oxlint.config.ts` without Vite+                                 | same                              |
| `root.loaderData`          | `server.ts`, called from the root loader                                                                                                                                                                | runs at prerender (build) time, so not usable for locale | n/a                                                                       | n/a                               |
| `html.attributes`          | root `shellComponent`                                                                                                                                                                                   | prerendered shell                                        | `<html>` in `app/layout.tsx`                                              | `index.html` (static values only) |
| `router.rewrite`           | router `rewrite` option                                                                                                                                                                                 | same                                                     | n/a                                                                       | n/a                               |
| `storybook.decorators`     | owned by the Storybook add-on; rendered only if it is installed                                                                                                                                         | same                                                     | same                                                                      | same                              |

### 4.8 Targets

- **TanStack Start SSR and SPA:** one adapter with two modes.
  - The target writes `src/start.ts`. Once that file exists, Start no longer adds its CSRF middleware, so the target
    lists `createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === "serverFn" })` first.
  - **No cloud in the target (D5).** `vite.config.ts` gets the Better Apps plugin, `betterApps()` from the Better Apps
    TanStack Start integration [U: package name], in band `framework` before `tanstackStart()`.
    - The plugin names no cloud. For the build's backend it adds the runtime glue
      ([better-apps-deploy.md](better-apps-deploy.md) §4). In v1 that is the Cloudflare Vite plugin with Start's server
      entry, plus the #7740 workaround in SPA mode.
    - The target writes no Wrangler config, no `cloudflare.config.ts` and no bindings file.
  - SPA mode emits `/_shell.html` by default. The target always sets `spa.prerender.outputPath: "/index.html"`. That is
    the path Cloudflare's SPA fallback serves, and the usual fallback on other static hosts, so the target needs no
    cloud branch. A maintainer confirmed that this works (TanStack/router#5619). [U: whether prerendering `/` collides
    with it]
  - **Open bug TanStack/router#7740:** with the Cloudflare Vite plugin, the shell is a full SSR of the mask path,
    including loader data. The Better Apps integration applies the workaround from the issue through Vite's `config`
    hook: `define: { "process.env.TSS_PRERENDERING": '"true"', "process.env.TSS_SHELL": '"true"' }`.
  - Server functions in SPA mode reach the Worker only if the assets config routes `/_serverFn/*` and `/api/*` to it.
    With a compatibility date of 2025-04-01 or later, navigation requests skip the Worker unless `run_worker_first`
    lists them. The deploy service renders that config ([better-apps-deploy.md](better-apps-deploy.md) §5).
  - SPA lacks `request-middleware` and has no request-time `root-loader`.
- **Next.js:**
  - Its own adapter, with render model `rsc`.
  - It has no `vite.plugins` point (vinext might change that, §7), and adds a `next.config.wrappers` point of kind
    `wrap` instead.
  - `proxy.ts` is its request-middleware point.
- **SpawnKit:**
  - The renderer is the target mode (`spawnkit/pixi`, `spawnkit/phaser`, `spawnkit/babylon`, `spawnkit/three`). The rule
    that you can't change the renderer falls out naturally.
  - Physics, UI, ECS and telemetry are add-ons with slots.
  - A `game.systems` point owned by the target replaces the `String.replace` patches. Each mode renders it into its own
    game loop: Pixi ticker, Phaser scene, Babylon observable, Three animation loop.

### 4.9 v1 scope

**In v1:**

- **Commands:** `init`, `add` (with `--replace` within a slot), `config`, `upgrade` (with `--list`), `sync`, `check`,
  `status [path]`, `explain <path|addon|entry>`, `plan show`, `catalog [fetch]`, `schema`, `recover`.
- **Shared flags:** every command takes `--dry-run`, `--json`, `--out`, `--plan` and `--yes`.
- **Ownership classes:** five (`owned`, `seed`, `sample`, `shared`, `user`).
- **Deploys:** through Better Apps' deploy service, to Cloudflare (§5). The scaffolder has no hosts.

**Deferred:**

- `remove`.
- The `eject` command (overrides cover the need).
- Third-party catalogs. Template packages came forward: see
  [scaffolder-template-packages.md](scaffolder-template-packages.md).
- Monorepo targets (but reserve `workspace` scope in the config schema now).
- Other clouds ([better-apps-deploy.md](better-apps-deploy.md) §7).
- Next.js add-ons beyond the base target.
- `vp create` as an entry point (§4.10).

### 4.10 Entry point: `vp create` (Vite+), deferred

Projects start with `buildkit init`. If `vp create @buildkitgg` comes back, it is a front door only:

- `@buildkitgg/create` holds a `createConfig.templates` manifest. Its entries hand off to `buildkit init`, so every
  project still starts with a config, a lock and a reviewed plan.
- Entries never bundle files. A project created without a lock could only be adopted as `user` files.
- A smoke test runs `vp create @buildkitgg:app` and then `buildkit check`, to catch vp's own setup steps rewriting our
  files.
- Agents call `buildkit init` directly. The envelope and exit codes are our contract.

It costs two small packages and a CI test, and nothing in v1 blocks it. The full evaluation is in `vp-create.md` in the
notes folder.

### 4.11 Templates and the `init` wizard

A template is what `init` offers first. It names a target, and decides how the catalog's add-ons appear:

- **Required add-ons** are installed every time and never asked about. Their options take their defaults, and catalog CI
  fails if one has an option without a default.
- **Optional add-ons** are offered together in one multi-select, with the template's defaults checked.
- **Slots** are one-of choices, such as the database:
  - An optional slot asks yes or no first ("Add a database?"), then which one ("Which database?").
  - A required slot asks only which one.
  - The choices are the slot's add-ons whose `supports()` accepts the target. When only one fits, the wizard doesn't
    ask.

**The wizard asks in this order:**

1. The template, unless there's only one or it was given. Then the mode, if the template offers more than one.
2. Each slot, in the template's order.
3. The optional add-ons.
4. For each chosen add-on, the options it lists in `ask`. The rest take their defaults; `--set`, or `config` later,
   changes them.
5. Environment variables. Option schemas never hold secrets (§4.5), so a secret is an `env` contribution with
   `secret: true`. `init` asks for each variable the plan needs, with a masked prompt for secrets; a required one's
   example is its default, and an optional one can be left blank. Values go only to the secrets file (`.env` or
   `.dev.vars`). Later commands ask only for required secrets that file doesn't have yet. Without a TTY, required
   secrets are listed in the next steps instead.
6. A summary that also lists the required add-ons and anything `requires` pulled in ("also adds X, needed by Y"), then
   one confirmation.

The wizard is generated from the catalog. Adding an add-on to a slot adds it to that slot's question, with no CLI code.

**Flags give the same answers without prompts:**

| Answer            | Flag                                 |
| ----------------- | ------------------------------------ |
| Template and mode | `init saas-app my-app --mode ssr`    |
| A slot            | `--database db-d1`, `--no-database`  |
| Optional add-ons  | `--with i18n`, `--without storybook` |
| An option         | `--set i18n.locales=en,fr`           |
| Saved answers     | `--preset saas`                      |

- Short names drop the add-on id's scope: `db-d1` is `@buildkit/db-d1`.
- `--yes` accepts every default, but never makes a decision. A required slot with no default and more than one choice is
  `needs-decision`.
- `--json` never prompts.

**The same answers drive every door:**

- `catalog --json` describes the templates, slots and add-ons, with their option schemas as JSON Schema. SpawnKit's
  dashboard and agents build the same questions from it.
- `add` asks a slot's question later: `buildkit add database`.
- The config records every answer, including "no" (`declined`, §4.5). A later `upgrade` asks only about the slots and
  add-ons the template gained since.

**Catalog CI checks** that:

- every add-on a template names exists and supports the template's target;
- each slot default is one of that slot's add-ons;
- every option of a required add-on has a default;
- every pair of answers plans without a conflict (the pairwise matrix in §7.8).

---

## 5. Deploys

The deploy design moved to [better-apps-deploy.md](better-apps-deploy.md) on 2026-10-28: capability packages, how the
build finds them, how the backend is chosen, and Better Apps' deploy service, with decisions D2, D3, D5 and D6. This
section keeps the scaffolder's side.

- Add-ons add capability packages as dependencies, and write the declarations as seed files. Third-party services stay
  env vars.
- The Start target wires the Better Apps Vite plugin into `vite.plugins` (§4.8).
- `init` writes `better-apps.environments.jsonc`. The CI add-on writes the workflows. `ci.yml`'s app-code checks are
  Buildkit's; the preview, deploy and cleanup workflows call Better Apps' versioned actions and `better-apps deploy`.
- There are no hosts, no `needs()`, no generated bindings and no cloud config. `check` flags a Wrangler config or a
  `cloudflare.config.ts`, because the deploy service ignores both.

| Add-on                                    | Uses                                                                | Notes                                                                                                            |
| ----------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Database (default)                        | `@better-apps/sql`, with a seed `src/server/db.ts` declaring `main` | D1 has no interactive transactions: Better Auth's SCIM plugin is out, and reset flows aren't atomic              |
| Database: Neon, Convex                    | Env vars; Convex adds a deploy step                                 | Third-party services aren't capabilities. Postgres through Hyperdrive, behind `@better-apps/sql`, can come later |
| Jobs (built in)                           | `@better-apps/queue`, `/workflow` and `/cron`                       | Queue consumers and cron on user Workers are spike #4 in [better-apps-deploy.md](better-apps-deploy.md) §6       |
| Jobs: Trigger.dev, Temporal               | Env vars; deployed separately                                       | Temporal workers run outside Workers                                                                             |
| Uploads                                   | `@better-apps/storage`                                              |                                                                                                                  |
| Auth: Better Auth                         | The database add-on's `main`                                        |                                                                                                                  |
| Auth: Clerk, WorkOS                       | Env vars                                                            | Clerk runs on Workers but doesn't document it: pass the keys to `clerkMiddleware` explicitly, and smoke-test it  |
| Better Apps features (presence, comments) | Their own declarations, inside the feature packages                 | How a feature reaches the app's database is open ([better-apps-deploy.md](better-apps-deploy.md) §8)             |

---

## 6. SpawnKit: what to extract and how to move it

D1 applies throughout: no backwards compatibility.

### 6.1 Extract into the engine

| SpawnKit piece                                                                                     | File                                         | Engine form                                                                                           |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Module graph (topological order, cycles, conflicts)                                                | `templates/src/index.ts` `resolveModules`    | Resolver with `slot`, `requires`, `after`, `supports()`                                               |
| Composition with structured choices, including replacing within a category                         | `templates/src/composition.ts`               | Resolver decisions; `add --replace`                                                                   |
| Whole-project plan                                                                                 | `templates/src/index.ts` `createProjectPlan` | `plan()` over contributions. Contributions can share a file through entries and keyed JSON operations |
| Three-way add                                                                                      | `templates/src/addition.ts`                  | Planner merge stage with ownership classes and normalization                                          |
| JSON merge with the proto-pollution guard                                                          | `addition.ts` `merge`                        | `edit/json`, walking `parseTree`                                                                      |
| Package section diff, moved-dependency conflict                                                    | `addition.ts`                                | Plan `packages`                                                                                       |
| Path safety, fingerprint, lock, journal, rollback, exclusive create                                | `cli/src/add.ts`, `scaffold.ts`              | `node` apply (hardened, §4.5)                                                                         |
| CLI semantics (`--dry-run`, `--json`, `--yes`, `needs-decision`, preview by default without a TTY) | `cli/src/composition.ts`                     | `cli` builders + envelope                                                                             |
| `AGENTS.md` kept out of the baseline                                                               | `index.ts`                                   | `sample` class                                                                                        |
| Starter kits                                                                                       | `templates/src/kits.ts`                      | Catalog presets                                                                                       |

### 6.2 Stays in SpawnKit

- **The catalog content:**
  - renderers, physics, UI, ECS and telemetry;
  - Colyseus services;
  - the hosting catalog;
  - example games.
- **Game sources and tests.**
- **Platform files:** `game.config.json`, `spawnkit.config.ts`, the listing schema and plugin, telemetry vendor files,
  dev-domains wiring.
- **Platform commands:** `link`, `login`, `deploy`.
- **Hosting:** SpawnKit's platform deploys games. The engine has no hosts (D5).
- **The dashboard composer**, which reads `catalog --json`.

### 6.3 Weaknesses to fix (no compatibility constraints)

- **The patches in `extensions.ts` chain on each other.** Later patches match text that earlier patches inserted, and a
  missed anchor silently does nothing. Replace them with the `game.systems` point (§4.8).
- **Combination-specific files** in `createProjectPlan` move into add-on contributions or `if-present` entries:
  - `hud.test.ts` for storybook+vitest;
  - `physics.test.ts`;
  - Playwright's edits to `tsconfig`.
- **Every option is a top-level `ProjectOptions` field.** They become options on each add-on.
- **`state.json` stores every file in full**, regenerates the baseline, and requires it to equal those copies byte for
  byte. `generatorVersion` is always `"0.0.0"`. Replace all of this with the config + lock design; SpawnKit keeps stored
  seed copies (§4.5).
- **No `.gitattributes` in generated games.** Targets now contribute one (§4.3).

### 6.4 Migration path

Phase 0 is planned in detail in [scaffolder-phase-0.md](scaffolder-phase-0.md), and phase 1 in
[scaffolder-phase-1.md](scaffolder-phase-1.md).

| Phase               | Work                                                                                                                                                                                                          | Done when                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 0. Engine           | Build `@buildkitgg/scaffolder` in Buildkit; port SpawnKit's composition, addition and CLI tests as engine tests                                                                                               | Engine tests pass                                                                                                                          |
| 1. SpawnKit catalog | Rewrite it as manifests on the engine: renderer as target mode, categories as slots, `game.systems`, replace-within-slot. Switch the CLI and the dashboard Worker together. Replace `/catalog/v1.json` freely | Every option set generates, typechecks and builds in catalog CI (sampled per PR, all nightly); `add`, `--replace` and `upgrade` tests pass |
| 2. Buildkit catalog | TanStack Start SSR target with the Better Apps Vite plugin, the first add-ons, and a first deploy through the deploy service (after the spike in [better-apps-deploy.md](better-apps-deploy.md) §6)           | A Buildkit app inits, adds auth and i18n, upgrades, and deploys to staging                                                                 |

**Release coupling:**

- Today only SpawnKit's generated games depend on a Buildkit package (`@buildkitgg/dev-domains`); SpawnKit's own
  packages don't yet.
- The engine will be bundled into SpawnKit's CLI and dashboard Worker. Pin it exactly and publish canaries.
- Buildkit's CI runs SpawnKit's catalog tests before publishing an engine release.

---

## 7. Open questions and risks

1. **Determinism of seed regeneration** across engine versions (§4.5). If the cross-version golden tests prove brittle,
   Buildkit stores seed copies too, as SpawnKit does.
2. **Point kinds.** Are `list | nest | wrap | map | single | chain` enough? Test against the first ten add-ons before
   freezing point contracts.
3. **Next.js.** Is vinext a separate mode with the `vite` facet, or a detail of the Better Apps integration? In v1, Next
   is a base target only.
4. **Monorepos.** Reserve `workspace` scope in the config now; support it after v1.
5. **Removal.** `remove` falls out of the lock (delete unchanged generated files, unset introduced keys, decide on
   seeds), but it's deferred.
6. **Adopting existing projects** (`init --adopt`, `spawn connect`). Detect without executing project code, record every
   file as `user`, then wire once with the target's codemods.
7. **Trust.** First-party catalogs only until manifests can be sandboxed or made data-only.
8. **Matrix cost.** Buildkit's three auth × three database × three jobs options, times targets, gives many combinations.
   Test every pair plus the presets per PR, and everything nightly.
9. **Dependencies:**
   - jsonc-parser: 3.3.1 needs a wrapper; 4.0.0-next is ESM-only and not yet `latest`.
   - node-diff3: low traffic; keep `git merge-file` as an optional backend.
10. **Checked on 2026-10-28.** The results are folded into the sections above; full detail with sources is in
    `verification-2026-10-28.md`. Still unverified:
    - Lingui's SWC plugin works under Turbopack if it is pinned for each Next minor. 6.7.1 with Next 16.4.3 is untested.
    - Whether the `lint` block in Vite+'s `vite.config.ts` accepts imported configs in `extends`.
    - Whether prerendering `/` collides with the SPA shell at `index.html`.

---

## Sources

**Local code:**

- `D:\spawn\packages\templates\src\{catalog,composition,extensions,addition,kits,index}.ts`
- `D:\spawn\packages\cli\src\{add,composition,scaffold,cli}.ts`
- `D:\spawn\docs\{project-templates,existing-project-onboarding,deployment}.md`

**Engines:**

- TanStack CLI: [repo](https://github.com/TanStack/cli)
  (`packages/create/src/{types,add-ons,add-to-app,create-app}.ts`),
  [add-ons](https://tanstack.com/cli/latest/docs/add-ons)
- [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack)
- [create-t3-app](https://github.com/t3-oss/create-t3-app)
- shadcn: [repo](https://github.com/shadcn-ui/ui),
  [registry-item schema](https://ui.shadcn.com/schema/registry-item.json)
- sv: [repo](https://github.com/sveltejs/cli)
- Astro: [`astro add`](https://github.com/withastro/astro/blob/main/packages/astro/src/cli/add/index.ts)
- Nuxt: [nuxt/cli](https://github.com/nuxt/cli)
- [Projen](https://github.com/projen/projen)
- Copier: [repo](https://github.com/copier-org/copier), [updating](https://copier.readthedocs.io/en/stable/updating/)
- [Cruft](https://github.com/cruft/cruft)
- Nx: [repo](https://github.com/nrwl/nx), [migrate](https://nx.dev/docs/features/automate-updating-dependencies),
  [sync generators](https://nx.dev/docs/concepts/sync-generators)
- [Angular CLI](https://github.com/angular/angular-cli)
- [Hygen](https://github.com/jondot/hygen), [Plop](https://github.com/plopjs/plop)
- [Yeoman](https://github.com/yeoman/generator)
- Vite+: [creating a project](https://viteplus.dev/guide/create), [`create` config](https://viteplus.dev/config/create),
  [repo](https://github.com/voidzero-dev/vite-plus) (MIT), `vite-plus` 1.4.0 on npm (2026-10-23)

**Libraries:**

- [oxc-parser](https://github.com/oxc-project/oxc/tree/main/napi/parser),
  [oxc#22055](https://github.com/oxc-project/oxc/issues/22055)
- [ast-grep](https://github.com/ast-grep/ast-grep)
- [magicast](https://github.com/unjs/magicast)
- [ts-morph](https://github.com/dsherret/ts-morph)
- jsonc-parser: [repo](https://github.com/microsoft/node-jsonc-parser),
  [PR #140](https://github.com/microsoft/node-jsonc-parser/pull/140)
- [node-diff3](https://github.com/bhousel/node-diff3)
- [git merge-file](https://git-scm.com/docs/git-merge-file)

**Deployment:**

- TanStack Start: [on Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/),
  [SPA mode](https://tanstack.com/start/latest/docs/framework/react/guide/spa-mode),
  [middleware](https://tanstack.com/start/latest/docs/framework/react/guide/middleware),
  [hosting](https://tanstack.com/start/latest/docs/framework/react/guide/hosting)
- Next.js: [on Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/),
  [OpenNext Cloudflare](https://opennext.js.org/cloudflare),
  [Next.js across platforms](https://nextjs.org/blog/nextjs-across-platforms),
  [`proxy.ts`](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)
- Cloudflare:
  - [Workers static assets](https://developers.cloudflare.com/workers/static-assets/),
    [SPA routing](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)
  - [Vite plugin environments](https://developers.cloudflare.com/workers/vite-plugin/reference/cloudflare-environments/)
  - [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [std-env providers](https://raw.githubusercontent.com/unjs/std-env/main/src/providers.ts)

**Verification (2026-10-28):**

- TanStack: [URL rewrites](https://github.com/TanStack/router/blob/main/docs/router/guide/url-rewrites.md),
  [`getGlobalStartContext`](https://github.com/TanStack/router/blob/main/packages/start-client-core/src/getGlobalStartContext.ts),
  [#5619](https://github.com/TanStack/router/issues/5619), [#7740](https://github.com/TanStack/router/issues/7740)
- Lingui: [TanStack Start example](https://github.com/lingui/js-lingui/tree/main/examples/tanstack-start),
  [Next.js SWC example](https://github.com/lingui/js-lingui/tree/main/examples/nextjs-swc)
- oxlint: [config](https://oxc.rs/docs/guide/usage/linter/config.html),
  [JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html); Vite+
  [lint config](https://viteplus.dev/config/lint)
- [`yaml` docs](https://eemeli.org/yaml/)
- Clerk: [`@clerk/backend`](https://github.com/clerk/javascript/tree/main/packages/backend),
  [#8197](https://github.com/clerk/javascript/issues/8197)
