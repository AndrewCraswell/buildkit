# @buildkitgg/shadcn-runtime

Shared runtime for Buildkit's generated shadcn styles. Each style re-exports these APIs, so applications normally import
them through `@buildkitgg/shadcn-baseui-kit`.

- `ShadcnLocalizationProvider`, `useShadcnLocalization`, `ShadcnStrings`, and `defaultShadcnStrings` provide reactive,
  scoped localization with English defaults.
- The localization provider also supplies Base UI reading direction through its `direction` prop. Set the document's
  `dir` attribute too.
- `cn` and `setCn` share one replaceable class merger across generated components.

See [localization, direction, and class merging](../../../docs/shadcn/localization.md).
