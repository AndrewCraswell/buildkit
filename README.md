# Buildkit

Small, focused libraries for building apps with React, shadcn/ui, and TypeScript. Brand domain: **buildkit.gg**.

## Development

Use Node 24+ and pnpm 12. Run `pnpm install`, then `pnpm verify` (format, lint, types, unused code, coverage, and
builds).

## Packages

- [@buildkitgg/dev-domains](packages/dev-domains/README.md): Portless domain CLI with typed configuration, guided setup,
  and webhook tunnels.
- Private `@repo/*` packages share TypeScript, oxlint, and Storybook configuration.

Apps and examples belong under `apps/`; independently reusable libraries belong under `packages/`.

See [engineering docs](docs/README.md), [agent instructions](AGENTS.md), and [MIT license](LICENSE).
