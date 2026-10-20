# Buildkit

TypeScript behavior packages with React bindings and shadcn and Fluent UI integrations.

The Buildkit.gg landing page lives in `apps/site`; run `pnpm --filter @buildkitgg/site dev` to preview it. See
[website deployment](docs/website.md) and the [automated API report workflow](api-reports/README.md).

## Development

Use Node 24+ and pnpm 12. Run `pnpm install`, then `pnpm verify` (format, lint, types, unused code, coverage, and
builds).

## Packages

- [Preferences](packages/core/preferences-core/README.md): typed defaults, overrides, storage, and JSON import/export.
- [Themes](packages/core/theme-core/README.md): system/light/dark selection with shadcn and Fluent UI integrations.
- [Modals](docs/modals.md): typed results, stack lifecycle, React bindings, and both UI adapters.
- [shadcn-baseui-kit](packages/shadcn/shadcn-baseui-kit/README.md): compiled Base UI components and styles.
- [@buildkitgg/dev-domains](packages/tooling/dev-domains/README.md): Portless domain CLI with typed configuration,
  guided setup, and webhook tunnels.
- Private `@repo/*` packages share TypeScript, oxlint, and Storybook configuration.

Apps and examples belong under `apps/`; independently reusable libraries belong under `packages/`.

Run `pnpm --filter @buildkitgg/behavior-storybook storybook` for the package directory and interactive examples.

See [engineering docs](docs/README.md), [agent instructions](AGENTS.md), and [MIT license](LICENSE).

Reusable packages are grouped under `packages/core`, `packages/react`, `packages/shadcn`, and `packages/fluentui`.
Shared configuration and developer tools live under `packages/tooling`. Package names and imports do not depend on their
directory.
