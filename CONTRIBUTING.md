# Contributing to Buildkit

Use Node 24+ and pnpm 12. Run `pnpm install`, make one coherent change, then `pnpm verify`. Do not bypass Git hooks. The
[engineering docs](docs/README.md) describe shared conventions. Read each package's indexed docs before changing it.

Keep public packages focused and independently usable. Expose deliberate entry points, separate CLI presentation from
operations, and document observable behavior and limitations. Add behavioral tests and regression cases. Prefer small
real fixtures to mock-heavy tests where possible.

For dev-domains, also run `pnpm --filter @buildkit/dev-domains test:integration`. It uses isolated Portless state and
does not alter the developer's shared proxy. Exercise changed CLI presentation in an interactive terminal.

Open a pull request with the problem, resulting behavior, and validation. Public APIs need a versioning decision;
packages remain unpublished during incubation. Contributions are MIT licensed.
