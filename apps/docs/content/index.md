# Buildkit documentation

TypeScript packages for the work applications share: preferences, themes, modals, alerts, routing, and development
tooling.

## Choose the layer you need

- **Core** packages define state, operations, and lifecycle without a framework dependency.
- **React** packages connect that behavior to subscriptions, hooks, and rendering.
- **shadcn and Fluent UI** integrations connect behavior to component-library conventions.
- **Developer tools** help run applications and their local workflows.

Start with an integration when it matches your app. Use a core directly when you want to own the integration.

## Find your next step

[Package guides](/packages/) cover installation and practical usage, rendered from each package’s README.

[Routing](/routing/) groups route tabs and panels, with integrations for React Router and TanStack Router alongside
their shared core and React bindings.

[API reference](/reference/) covers the exported TypeScript surface, including subpath imports. API Extractor reads
compiled declarations; API Documenter renders their signatures and source comments. These pages are generated during the
documentation build. Interactive examples live in Storybook, linked from the website.

## Public API changes

API reports are checked into the repository and verified in CI. An intentional signature change needs a reviewed
baseline update. The report identifies signature differences; release compatibility and behavior still require review.
