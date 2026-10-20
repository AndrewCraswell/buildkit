# Engineering docs

- [Conventions](conventions.md)
- [TypeScript](typescript.md)
- [React](react.md)
- [Hooks](hooks.md)
- [Preferred tools](tech-stack.md)
- [Package lifecycle](packages.md)
- [Releases](releases.md)
- [Website and documentation deployment](website.md)
- [Reference site development](../apps/docs/README.md)
- [Public API baselines and extraction](../api-reports/README.md)
- [Public behavior APIs](public-apis.md)
- [Inline alerts and native toast architecture](alerts.md)
- [Modal architecture and lifecycle](modals.md)
- [Typed modal forms and inferred state](modal-forms.md)
- [Shared behavior packages and Fluent extraction plan](behavior-packages.md)

Theme packages: [core](../packages/core/theme-core/README.md), [React](../packages/react/react-theme/README.md),
[shadcn](../packages/shadcn/shadcn-theme/README.md), [Fluent UI](../packages/fluentui/fluentui-theme/README.md).

The unified package documentation and component workshop lives in `apps/behavior-storybook`
(`pnpm --filter @buildkitgg/behavior-storybook storybook`).

Preferences packages: [core](../packages/core/preferences-core/README.md),
[React](../packages/react/react-preferences/README.md).

Package-specific docs live in each package’s `docs/README.md`. Start with
[dev-domains](../packages/tooling/dev-domains/docs/README.md).

[shadcn-baseui-kit](../packages/shadcn/shadcn-baseui-kit/docs/README.md) documents the compiled Base UI component
package.

[Route tabs and panels](routing.md): shared behavior and React Router / TanStack Router integrations.
