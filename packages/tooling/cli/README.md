# @buildkitgg/cli

The `buildkit` CLI: create, extend and upgrade Buildkit apps. It runs the project commands of
[`@buildkitgg/scaffolder`](../scaffolder/README.md) on [Buildkit's catalog](../catalog/README.md).

Requires Node.js 24 or later.

## Create an app

```sh
npx @buildkitgg/cli init app my-app
```

In a terminal it asks for the mode, a database, sign-in and localization, shows the plan, and asks once before it writes
anything. The same answers work as flags:

```sh
npx @buildkitgg/cli init app my-app --mode ssr --with i18n --set i18n.locales=en,fr --yes
npx @buildkitgg/cli init app my-app --preset saas --yes
```

`--yes` accepts every default but never makes a decision for you, and `--json` prints one JSON envelope without
prompting. Without a terminal, a command plans and writes nothing unless you pass `--yes`.

## Change an app

New apps pin `@buildkitgg/cli` as a dev dependency, so run it through pnpm inside the project:

| Command                                          | What it does                                                         |
| ------------------------------------------------ | -------------------------------------------------------------------- |
| `pnpm buildkit add i18n`                         | Add an add-on                                                        |
| `pnpm buildkit add database`, `add auth`         | Answer a question later. Sign-in needs a database, and asks for one  |
| `pnpm buildkit config set i18n.locales=en,fr,de` | Change an option                                                     |
| `pnpm buildkit upgrade`                          | Move to the installed catalog, merging template fixes into your code |
| `pnpm buildkit check`                            | Fail when generated files or the lock are out of date                |
| `pnpm buildkit status`, `explain <path>`         | What Buildkit manages, and who contributes a file                    |
| `pnpm buildkit catalog --json`                   | Every template, question and add-on                                  |

The other commands are `sync`, `plan show`, `schema` and `recover`. Every planning command takes `--dry-run`, `--json`,
`--out`, `--plan` and `--yes`. Exit codes: 0 done, 1 needs a decision, 2 usage or internal error, 3 conflict, 4 drift, 5
locked, 130 cancelled.

To upgrade, install the newer CLI, then run `upgrade`:

```sh
pnpm add -D @buildkitgg/cli@latest
pnpm buildkit upgrade
```

## Embedding

```ts
import { runBuildkit } from "@buildkitgg/cli"

const code = await runBuildkit(["add", "i18n", "--json", "--yes"], { io: { cwd: "path/to/app" } })
```

`buildkitOptions(overrides)` returns the options `runBuildkit` passes to the scaffolder's `runCli`.

## Smoke test

`pnpm --filter @buildkitgg/cli test:smoke` generates apps with the built CLI, installs them with the Buildkit packages
packed from the checkout, then runs `buildkit check`, lint, format check, build and type-check, and requests pages from
the built server. Build first with `pnpm exec vp run --cache --filter "@buildkitgg/cli..." build`. Cases that need
unpublished Better Apps packages are skipped and say why.
