/**
 * `@buildkitgg/catalog`: Buildkit's scaffolding catalog for `@buildkitgg/scaffolder`. The `buildkit` CLI runs it, and a
 * cached copy of an earlier version renders an old baseline during `buildkit upgrade`.
 */
export { catalog, catalog as default } from "./catalog.js"
export { settings } from "./settings.js"
