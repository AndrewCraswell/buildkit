# @buildkitgg/scaffolder

A plan-first scaffolding engine. A product describes what projects can be made of in a **catalog**: targets, templates,
slots and add-ons. The engine turns answers into a reviewed **plan**, applies it safely, and later adds to, changes or
upgrades the project without overwriting your edits.

Requires Node.js 24 or later. Until 1.0, minor versions may change the catalog and manifest types.

## Table of contents

- [Exports](#exports)
- [Concepts](#concepts)
- [Writing a catalog](#writing-a-catalog)
- [Templates and the wizard](#templates-and-the-wizard)
- [File ownership](#file-ownership)
- [Building a CLI](#building-a-cli)
- [Commands](#commands)
- [The JSON envelope and exit codes](#the-json-envelope-and-exit-codes)
- [Upgrades](#upgrades)
- [Template packages](#template-packages)
- [Catalog CI](#catalog-ci)

## Exports

| Import                             | What it has                                                                    | Runs in                           |
| ---------------------------------- | ------------------------------------------------------------------------------ | --------------------------------- |
| `@buildkitgg/scaffolder`           | `define*` helpers, the resolver, the pure planner, the envelope, state schemas | Anywhere: no file system, no git  |
| `@buildkitgg/scaffolder/edit`      | Comment-keeping edits for JSON, JSONC, YAML, line lists and `.env` files       | Anywhere                          |
| `@buildkitgg/scaffolder/edit/code` | `ensureImport` and `appendToArray` codemods on oxc's AST                       | Node and bundlers with oxc-parser |
| `@buildkitgg/scaffolder/node`      | The disk snapshot, safe apply, `recover`, plan artifacts, the catalog cache    | Node                              |
| `@buildkitgg/scaffolder/cli`       | Command builders, the generated wizard and its flags, readable output          | Node                              |

## Concepts

| Concept          | What it is                                                                                          |
| ---------------- | --------------------------------------------------------------------------------------------------- |
| **Catalog**      | A product's versioned package of targets, templates, slots, add-ons and presets                     |
| **Target**       | A framework and its modes, such as `web/ssr`. It provides base files and owns extension points      |
| **Template**     | What `init` offers: required add-ons (never asked about), optional add-ons and slot questions       |
| **Slot**         | A one-of choice, such as the database. A template makes it optional ("Add a database?") or required |
| **Add-on**       | A manifest whose `contribute()` returns data-only contributions                                     |
| **Point**        | A typed extension point, rendered into a generated file that your code imports                      |
| **Plan**         | Operations, decisions and conflicts, with a fingerprint                                             |
| **Config, lock** | `<product>.jsonc` holds your choices; `.<product>/lock.json` holds derived state                    |

## Writing a catalog

```ts
import { defineAddon, defineCatalog, defineSlot, defineTarget, defineTemplate } from "@buildkitgg/scaffolder"
import { z } from "zod"

const i18n = defineAddon({
  id: "@acme/i18n",
  version: "1.0.0",
  title: "Localization",
  description: "Lingui message catalogs",
  options: z.object({ locales: z.array(z.string()).default(["en"]).describe("Locales") }),
  ask: ["locales"],
  contribute: (ctx) => [
    { kind: "dependency", name: "@lingui/core", version: ctx.version("@lingui/core") },
    {
      kind: "file",
      path: "src/i18n/setup.ts",
      content: `export const locales = ${JSON.stringify(ctx.options.locales)}\n`,
      ownership: "seed"
    },
    {
      kind: "entry",
      point: "vite.plugins",
      id: "lingui",
      value: { call: { module: "@lingui/vite-plugin", export: "lingui" } }
    }
  ]
})

export default defineCatalog({
  id: "@acme/catalog",
  version: "1.0.0",
  facets: ["vite", "ssr", "spa"],
  versions: { "@lingui/core": "6.10.1" },
  targets: [/* defineTarget({ id, family, modes, points, base }) */],
  slots: [defineSlot({ id: "database", title: "Database", question: "Add a database?", choose: "Which database?" })],
  templates: [
    defineTemplate({
      id: "app",
      title: "App",
      description: "A web app",
      target: "web",
      required: ["@acme/lint"],
      optional: { "@acme/i18n": { default: false } },
      slots: { database: { required: false, default: "@acme/db-sqlite" } }
    })
  ],
  addons: [i18n /* … */]
})
```

Contribution kinds: `dependency`, `script`, `env`, `file` (`owned`, `seed` or `sample`), `entry`, `json` and `yaml`
(`set`, `merge`, or `append` with an optional `key` for keyed arrays), `lines`, `command` (listed, never run) and
`notice`. Add-ons declare `requires` (ids, `slot:<id>` or `provides:<name>`), `conflicts`, `after`, `supports()` and
`migrations`.

## Templates and the wizard

The wizard is generated from the catalog, so a new add-on or a new choice in a slot needs no CLI code. It asks, in
order: the template, the project name, the mode, each slot (yes or no first for an optional slot, then which one), the
optional add-ons in one multi-select, the options each chosen add-on lists in `ask`, and the plan's environment
variables, with a masked prompt for secrets. A required variable's example is its default, and an optional one can be
left blank. Then it shows the plan and asks for one confirmation, which defaults to no. The answers go to the secrets
file. Later commands ask only for required secrets that file doesn't have yet.

A slot's choices are the add-ons whose `supports()` accepts the target, and a slot with one fitting choice isn't asked.
Required add-ons are never asked about, so their options must all have defaults.

Every question has a flag: `--mode`, `--<slot> <add-on>`, `--no-<slot>`, `--with`, `--without`,
`--set <add-on>.<option>=<value>` and `--preset`. Short names drop the scope: `db-sqlite` is `@acme/db-sqlite`.
`catalog --json` describes the whole questionnaire, for dashboards and agents.

## File ownership

| Class    | Examples                        | The engine may                      | Later                                       |
| -------- | ------------------------------- | ----------------------------------- | ------------------------------------------- |
| `owned`  | Generated point files           | Rewrite it while you haven't        | Regenerated. Your edit is a decision        |
| `seed`   | Starter routes, config files    | Create it once                      | Three-way merged with your edits on upgrade |
| `sample` | `AGENTS.md`, example pages      | Create it once                      | Never touched again. Your deletion persists |
| `shared` | `package.json`, `tsconfig.json` | Edit only the keys it introduced    | Merged by key. Keys you had are kept        |
| `user`   | Everything else                 | Nothing, except codemods you review | Never merged                                |

The one rule: create a path only if it's absent, and overwrite or delete only while the file still hashes to what the
engine last wrote. Anything else is a conflict, and `--yes` can't answer it. Hashes ignore line endings, a BOM and the
final newline, and writes keep each file's line endings.

## Building a CLI

```ts
#!/usr/bin/env node
import catalog from "@acme/catalog"
import { defineSettings } from "@buildkitgg/scaffolder"
import { createCli } from "@buildkitgg/scaffolder/cli"
import { runMain } from "citty"

await runMain(createCli({ name: "acme", version: "1.0.0", catalog, settings: defineSettings({ product: "acme" }) }))
```

`defineSettings` picks the product's file names: `acme.jsonc`, `.acme/` and `.env` for secrets, unless you set them.
`runCli(argv, options)` runs one command and returns its exit code, for tests and embedding tools.

## Commands

| Command                                    | What it does                                                         |
| ------------------------------------------ | -------------------------------------------------------------------- |
| `init [template] [folder]`                 | Create a project, from a template or a package. `--adopt` adopts one |
| `add <add-on or slot…>`                    | Add add-ons, or answer a slot question: `add database`. `--replace`  |
| `config`, `config get`, `config set`       | Show the config, get an option, or set options                       |
| `upgrade [--list]`                         | Move to the installed catalog version, running migrations            |
| `sync`                                     | Bring generated files and the lock in line with the config           |
| `check`                                    | Fail when generated files or the lock are out of date                |
| `status [path]`, `explain <subject>`       | What the engine manages, and who contributes a path, add-on or entry |
| `plan show <file>`                         | Show a saved plan                                                    |
| `catalog [package] [--json]`               | Describe the questionnaire, or a template package's templates        |
| `catalog fetch <version>`, `catalog check` | Cache an earlier catalog version, or check a package before publish  |
| `schema`                                   | JSON Schemas for the config, the lock and plan requests              |
| `recover`                                  | Roll back an interrupted apply                                       |

Every planning command takes `--dry-run`, `--json`, `--out [folder]`, `--plan <file>`, `--yes`, `--diff`,
`--resolve <id>=keep-current|take-incoming|file:<path>` and `--conflict markers`. Without a terminal, a command plans
and writes nothing unless you pass `--yes` or apply a reviewed plan with `--plan`. A reviewed plan applies only if the
project hasn't changed since; applying it twice is a no-op. It records the template packages it was made with, and
applying it loads those exact versions, so a newer release never runs first. `--cwd` sets where the project is for every
command, and `init`'s folder is relative to it.

## The JSON envelope and exit codes

With `--json`, the commands that plan or change the project (`init`, `add`, `config set`, `upgrade`, `sync`, `check`,
`plan show`, `catalog fetch` and `recover`) print one JSON envelope: `status`, `fingerprint`, `operations` (path,
action, class and line counts), `decisions` (each choice with its `request` and `argv`), `conflicts`, `packages`, `env`,
`commands`, `migrations`, `notices`, `nextSteps` and `error`. Files that may hold secrets show no contents or line
counts.

The commands that only read print their own JSON instead:

| Command      | `--json` prints                                                                |
| ------------ | ------------------------------------------------------------------------------ |
| `config`     | The config, as an object                                                       |
| `config get` | The add-on's options or the option's value, or `null`                          |
| `status`     | `{ catalog, files, deleted }`: each file's path, class, state and contributors |
| `explain`    | An object whose `kind` is `path`, `addon`, `entry` or `unknown`                |
| `catalog`    | The questionnaire: each template's questions, by mode                          |
| `schema`     | `{ config, lock, request }`, each a JSON Schema                                |

When any command fails, it prints the envelope with `status: "error"`.

| Code | Meaning                       |
| ---- | ----------------------------- |
| 0    | planned, applied or unchanged |
| 1    | needs a decision              |
| 2    | usage or internal error       |
| 3    | conflict                      |
| 4    | drift: the project changed    |
| 5    | locked or interrupted         |
| 130  | cancelled                     |

## Upgrades

`upgrade` renders the old baseline with the catalog version the lock records, renders the new one, and merges: seeds
three-way, shared files by key, generated files by hash. Run `catalog fetch <version>` to cache an old version for
offline use; without it, edited seeds need a decision. The cache is in your user cache folder, never in the project, so
a cloned repository can't supply catalog code for the CLI to run. A product whose catalog isn't published sets
`seedBases: "stored"` in `defineSettings`, which keeps each seed's generated text in the lock to merge against instead.
Migrations run when an add-on's version moves past theirs: option rewrites, codemods, package bumps, and agent tasks
that are only listed.

## Template packages

Anyone can publish templates for a product's catalog as an npm package, and the product's CLI installs one by name:
`npx <cli> init @acme/tower-defense my-game`. A scoped name, or any name after `npm:`, is a package. Add a version or a
range (`@acme/tower-defense@^2`), and `#<id>` to pick one of several templates (`@acme/starters#tower`). Built-in
template ids can't look like a package, so a typo is never fetched.

A template package's default export is a pack:

```ts
import { definePack } from "@buildkitgg/scaffolder"

export default definePack({
  extends: { catalog: "@acme/catalog", versions: "^1.0.0" },
  templates: [{ id: "tower", title: "Tower defense", description: "Waves, towers and a path", target: "web" }],
  addons: [/* ids start with "@acme/tower-defense/" */]
})
```

- **It extends one catalog.** Its templates and add-ons use the catalog's targets, slots and points, and the catalog's
  add-ons stay available to `add`. It can't add targets, slots or points, or replace anything the catalog has.
- **Ids.** A template is recorded as `<package>#<id>`, and its add-on ids start with `<package>/`.
- **Compatibility.** The engine refuses a pack whose `versions` range doesn't include the installed catalog.
- **Checks.** The engine merges the pack into the catalog and runs `checkCatalog` before planning. Run `catalog check`
  in the package's folder, after building it, to plan every option set of its templates before you publish.

npm installs packages into the user cache folder, never the project, without running their scripts. The lock records
each package's version and integrity, and later commands load that copy and refuse one that doesn't match. Only the
package itself is pinned: npm resolves its dependencies' ranges again when it installs it into a new cache, so a pack
that needs exact dependencies publishes an `npm-shrinkwrap.json`, which npm follows. `upgrade` moves each package to its
newest version that works with the installed catalog. The plan says the template comes from a package and not from the
product, because applying it runs the package author's code.

## Catalog CI

`checkCatalog(catalog, { matrix: true })` reports broken references, slot defaults that aren't the slot's add-ons,
required add-ons with options that lack defaults, unregistered facets, and any pair of answers that fails to plan.

`pairwiseAnswers(catalog, template, mode)` gives the answer sets it plans: a covering array, in which every pair of
values of every two questions appears in at least one set, built greedily and the same every time. A product's smoke
tests can generate and build those sets. `requestArgv(request, { preset })` turns one into the CLI command. Given a
preset for the request's template, it writes `init --preset <id>` plus what differs from the preset, when the request
answers every question the preset does; a question left to the template's default can't be written as a difference.

See [the architecture guide](docs/README.md) to work on the engine itself.
