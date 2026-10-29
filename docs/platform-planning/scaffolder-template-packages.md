# Scaffolder: template packages

Anyone can publish a template as an npm package, written against the engine's manifest types. A product CLI built on the
engine installs it by name, with nothing installed first:

```sh
npx @spawnkit/cli init @acme/tower-defense my-game
```

`npx` fetches the CLI, and the CLI fetches the template. This lives in the engine, so every product CLI gets it:
SpawnKit now, Buildkit's CLI when phase 2 builds it. [scaffolder-research.md](scaffolder-research.md) §4.9 deferred
third-party catalogs; this is the template part of that, brought forward.

## Commands

A template argument that names a package is a package. Every other `init` flag works as it does with a built-in
template.

```sh
spawn init @acme/tower-defense my-game                 # the package's template
spawn init @acme/tower-defense@2.1.0 my-game           # a version, or a range such as @^2
spawn init @acme/starters#tower my-game                # one of several templates in a package
spawn init npm:tower-defense my-game                   # an unscoped package
spawn init @acme/tower-defense my-game --physics rapier2d --with vitest --dry-run
spawn catalog @acme/tower-defense [--json]             # its templates and questions
spawn catalog check [path]                             # for authors: validate a package before publishing
```

- **Which arguments are packages.** A scoped name (`@scope/name`), or any name after `npm:`. Built-in template ids can't
  contain `/`, `#` or `:`, and `checkCatalog` enforces that. So a mistyped built-in id is reported as unknown. It never
  fetches a stranger's package.
- **Several templates.** `#<id>` picks one. Without it, the wizard asks, and a run without a terminal stops with the
  choices.
- **No arguments.** The wizard offers built-in templates only. Packages are always asked for by name.

## A template package

```json
{
  "name": "@acme/tower-defense",
  "version": "1.0.0",
  "type": "module",
  "exports": { ".": "./dist/index.js" },
  "keywords": ["spawnkit-template"],
  "dependencies": { "@buildkitgg/scaffolder": "^0.2.0" }
}
```

Its default export is a template pack:

```ts
import { definePack, defineTemplate } from "@buildkitgg/scaffolder"

export default definePack({
  extends: { catalog: "@spawn/templates", versions: "^1.0.0" },
  templates: [defineTemplate({ id: "tower", title: "Tower defense", target: "spawnkit", modes: ["pixi"], ... })],
  addons: [...]
})
```

- **What a pack can add.** Templates and add-ons, for the targets, slots and points the product's catalog already has.
  The product's add-ons stay available, so `spawn add sentry` works in a game made from a package. A pack can't add
  targets, slots or points, and can't replace anything the product defines. Those need product support, such as deploys
  and the dashboard.
- **Ids.** A pack's templates are recorded as `<package>#<id>`. Its add-on ids must start with `<package>/`. Two packs
  can't collide, and neither can collide with the product.
- **Compatibility.** `extends` names the product catalog and the versions the pack works with. The engine refuses a pack
  whose range doesn't include the installed catalog, and says which CLI version to use.
- **Checks.** The engine merges the pack into the product catalog and runs `checkCatalog` on the result before planning.
  A pack that breaks a rule stops before anything is written. `spawn catalog check` runs the same check with
  `matrix: true`, planning every option set, so authors find problems before publishing.
- **Types are the schema.** Authors write against the engine's exported types, and the engine validates every pack when
  it loads it.

## Installing and later commands

- **Installing.** `PackStore` installs packs the way `CatalogStore` installs earlier catalog versions. npm puts each one
  into the user's cache folder, never into the project, without running its scripts. The engine records the package's
  integrity and checks it on every load.
- **The lock.** It records each pack: `packs: { "@acme/tower-defense": { version, integrity } }`. `add`, `config`,
  `sync`, `check`, `explain` and `schema` load that exact version from the cache, fetching it when it's missing. They
  refuse a copy whose integrity doesn't match. `status` reads only the lock and the files, so it never loads a pack.
- **Upgrades.** `upgrade` moves each pack to its newest version whose `extends` range includes the installed catalog.
  `upgrade --list` shows that move. Seeds merge three-way as they do for built-in templates. With stored seed bases, the
  old pack version isn't needed. With regenerated bases, it comes from the cache.
- **Offline.** A cached pack works offline. A missing one fails with `E_PACKAGE_UNAVAILABLE`, and the error names the
  package.

## Trust

A template package is code from its author, running on your computer, like any package `npx` runs.

- **The plan says where it came from.** For example: "The template comes from @acme/tower-defense@1.0.0 on npm, not from
  spawn. Applying it runs code from its author." In a terminal, `init` asks before applying. `--yes` and `--json` don't
  ask, because the person automating it chose the package.
- **The engine's rules still hold.** Paths stay inside the project, the ownership classes apply, and conflicts stop.
  Packs only produce contributions, and the engine does all the writing.
- **Integrity.** The package's own integrity is recorded in the lock, so a teammate's `spawn sync` uses the same package
  the project was made with. Its dependencies aren't pinned: npm resolves their ranges again when it installs the
  package into a new cache, unless the package publishes an `npm-shrinkwrap.json`.

## Not in v1

- **The dashboard** lists built-in templates only. Previewing a package there would mean running its code in the
  browser.
- **Add-on packages** (`spawn add @acme/turrets`). They need the same loader, and come next.
- **Package targets, slots, points and presets.**
- **npm provenance** in the plan, for packages published with it.
- **Search or a registry.** Packages are found on npm, for example by the `spawnkit-template` keyword.
- **A `create` front door** such as `npm create spawnkit`. It could hand off to `spawn init` later.

## Work

1. **Engine.**
   - Add `definePack` and the `TemplatePack` type.
   - Parse template package arguments.
   - Turn `CatalogStore` into a package store that resolves ranges.
   - Merge packs into the catalog and check them.
   - Add `packs` to the lock.
   - In the CLI runtime: `init` with a package, `catalog <package>`, `catalog check`, packs loaded from the lock, the
     source line in plans, and `upgrade`.
   - Tests use a fixture package installed through an injected `runCommand`.
2. **Docs.** A "Publish a template package" section in the engine's README.
3. **Release**, then **SpawnKit.**
   - Bump the engine.
   - Document `spawn init <package>`.
   - Add a smoke case that installs a fixture package from a local tarball.
