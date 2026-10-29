# Change Log - @buildkitgg/scaffolder

<!-- This log was last generated on Thu, 29 Oct 2026 23:24:24 GMT and should not be manually modified. -->

<!-- Start content -->

## 0.5.0

Thu, 29 Oct 2026 23:24:24 GMT

### Minor changes

- JSON the engine writes is laid out as oxfmt and Prettier lay it out, for the new `printWidth` setting: short lists on
  one line, objects as they are written, and `package.json` as `JSON.stringify` writes it. A keyed append takes
  `order: { after, before }`. `match(value, cases)` branches on a render model or mode. Removing the last item of a
  one-line array no longer leaves a stray quote. (ajcraswell@gmail.com)

## 0.4.0

Thu, 29 Oct 2026 17:55:35 GMT

### Minor changes

- `pairwiseAnswers` returns a greedy covering array, so catalog CI and smoke tests plan far fewer answer sets for the
  same pairwise coverage. `requestArgv` takes a `preset` and writes `init --preset <id>` plus what differs from it, and
  takes the `catalog` so it writes `--without` for a default add-on the request leaves out and a full id where a short
  name is ambiguous; decision choices in the JSON envelope use the catalog of the version they plan with. `init`'s
  folder is relative to `--cwd`. On Windows, installing a template package and fetching an earlier catalog version work:
  the command line no longer quotes `npm.cmd`, which made npm look for its own code in the cache folder.
  (ajcraswell@gmail.com)

## 0.3.0

Thu, 29 Oct 2026 12:16:13 GMT

### Minor changes

- The init wizard asks for every environment variable the plan needs, optional ones included, and later commands ask
  only for required secrets that aren't set yet. `askSecrets` is now `askEnv`. Plans no longer list add-ons the project
  already has. Apply retries Windows file locks for longer, including when it releases its lock, so a held lock file no
  longer blocks the next command. A saved plan records the template package versions it was made with, and `init --plan`
  loads exactly those, so a newer release never runs before the plan is checked. (ajcraswell@gmail.com)

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
