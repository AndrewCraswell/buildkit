# Your Buildkit app

A React app on [TanStack Start](https://tanstack.com/start), made with Buildkit.

## Run it

Requires Node.js 24 or later and pnpm 12.

```sh
pnpm install
pnpm dev
```

## Check and build

```sh
pnpm lint
pnpm build
pnpm typecheck
```

`pnpm build` also writes `src/routeTree.gen.ts`, the route tree that `pnpm typecheck` reads. Commit it.

## What Buildkit manages

`buildkit.jsonc` records the template and the add-ons you chose, and `.buildkit/lock.json` records what Buildkit wrote.
Commit both.

- `pnpm buildkit add <add-on>` adds an add-on, such as `pnpm buildkit add i18n`, or answers a question such as
  `pnpm buildkit add database`.
- `pnpm buildkit config set <add-on>.<option>=<value>` changes an option.
- `pnpm buildkit upgrade` moves the app to the Buildkit catalog you installed. It merges template fixes into the files
  it started, and asks when your edits and its changes overlap.
- `pnpm buildkit check` fails when generated files are out of date.

Files under `src/generated/buildkit/` are generated: your starter files import them, so adding an add-on never edits
your code.
