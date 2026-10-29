# Change Log - @buildkitgg/scaffolder

<!-- This log was last generated on Thu, 29 Oct 2026 04:32:14 GMT and should not be manually modified. -->

<!-- Start content -->

## 0.1.0

Thu, 29 Oct 2026 04:32:14 GMT

### Minor changes

- Add `seedBases: "stored"` to `defineSettings`. The lock keeps each seed's generated text, so `upgrade` merges your
  edits three-way even when the catalog version the project started from can't be fetched. (ajcraswell@gmail.com)
- First release: a plan-first scaffolding engine. Describe targets, templates, slots and add-ons in a catalog, and the
  engine plans, applies, adds to and upgrades projects without overwriting your edits. Build a product CLI with
  `createCli` from `@buildkitgg/scaffolder/cli`. (ajcraswell@gmail.com)

### Patches

- Type `engineVersion` as `string`. (ajcraswell@gmail.com)
