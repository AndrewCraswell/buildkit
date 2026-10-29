# Engineering docs

- [Conventions](conventions.md)
- [TypeScript](typescript.md)
- [React](react.md)
- [Hooks](hooks.md)
- [Recommended stack](platform-planning/stack.md)
- [Build plans: packages, services and pipelines we will build](platform-planning/build-plans.md)
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
- [Updating modal content, state and presentation](modal-updates.md)
- [Shared behavior packages and Fluent extraction plan](behavior-packages.md)

Theme packages: [core](../packages/core/theme-core/README.md), [React](../packages/react/react-theme/README.md),
[shadcn](../packages/shadcn/shadcn-theme/README.md), [Fluent UI](../packages/fluentui/fluentui-theme/README.md).

The unified package documentation and component workshop lives in `apps/behavior-storybook`
(`pnpm --filter @buildkitgg/behavior-storybook storybook`).

Preferences packages: [core](../packages/core/preferences-core/README.md),
[React](../packages/react/react-preferences/README.md).

Package-specific docs live in each package’s `docs/README.md`. Start with
[dev-domains](../packages/tooling/dev-domains/docs/README.md).

[Scaffolder](../packages/tooling/scaffolder/README.md): the plan-first scaffolding engine behind product CLIs, with its
[architecture guide](../packages/tooling/scaffolder/docs/README.md).
[Template packages](platform-planning/scaffolder-template-packages.md): templates anyone can publish to npm for a
product's catalog, installed by name.

[shadcn component styles](shadcn/README.md) documents installation, styling, and maintenance of the generated Base UI
packages.

[Route tabs and panels](routing.md): shared behavior and React Router / TanStack Router integrations.

Configuration: [core and provider contract](../packages/core/configuration-core/README.md),
[React subscriptions](../packages/react/react-configuration/README.md).

[Generated shadcn styles and dependency aliases](shadcn/styles.md).

[Shadcn localization, RTL, and class merging](shadcn/localization.md).

[Better Apps](../packages/better-apps/better-apps/README.md): app features with their own tables, actions and events.
Its [CLI](../packages/better-apps/cli/README.md) generates the schema for your ORM, using
[vendored Better Auth source](../packages/better-apps/cli/docs/vendoring.md), and its
[Drizzle adapter](../packages/better-apps/drizzle/README.md) reads and writes the tables, using
[forked Better Auth source](../packages/better-apps/drizzle/docs/fork.md).
[`@better-apps/testing`](../packages/better-apps/testing/README.md) runs features against in-memory SQLite.
[`@better-apps/comments`](../packages/better-apps/comments/README.md) adds comment threads to any record an app owns.
[`@better-apps/react`](../packages/better-apps/react/README.md) binds the Better Apps client and its stores to React.
