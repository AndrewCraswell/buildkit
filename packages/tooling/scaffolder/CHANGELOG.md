# Change Log - @buildkitgg/scaffolder

<!-- This log was last generated on Thu, 29 Oct 2026 11:46:01 GMT and should not be manually modified. -->

<!-- Start content -->

## 0.2.0

Thu, 29 Oct 2026 11:46:01 GMT

### Minor changes

- Add template packages. Anyone can publish templates for a product's catalog as an npm package (`definePack`), and
  `init @scope/name` installs one by name. The lock records each package's version and integrity, `upgrade` moves
  packages to their newest compatible version, and `catalog check` checks a package before it's published.
  (ajcraswell@gmail.com)

## 0.1.0

Thu, 29 Oct 2026 04:54:16 GMT

### Minor changes

- Add `seedBases: "stored"` to `defineSettings`. The lock keeps each seed's generated text, so `upgrade` merges your
  edits three-way even when the catalog version the project started from can't be fetched. (ajcraswell@gmail.com)
- First release: a plan-first scaffolding engine. Describe targets, templates, slots and add-ons in a catalog, and the
  engine plans, applies, adds to and upgrades projects without overwriting your edits. Build a product CLI with
  `createCli` from `@buildkitgg/scaffolder/cli`. (ajcraswell@gmail.com)

### Patches

- Type `engineVersion` as `string`. (ajcraswell@gmail.com)
