> Inherited preference catalog from Agency. Entries describe preferred choices, not dependencies installed in Buildkit.
> Check each workspace manifest before use.

# Preferred Tech Stack

The tools we reach for **first**. Prefer them before introducing an alternative for the same job.

> **Deviating from this list requires a discussion with a human.** If a task seems to need a library that isn't here (or
> a different one than what's listed), raise it — in the issue or PR — and get agreement before adding it. Don't
> silently swap in a different tool.

## Developer experience

- **pnpm** — package manager (workspaces, catalog, hoisted linker).
- **Turborepo** — task runner + caching.
- **Vite** — bundler / dev server.
- **oxlint** — linter; **oxfmt** — formatter.
- **knip** — unused files / deps / exports.
- **npm-run-all2** — script orchestration (`run-s` / `run-p`).
- **lefthook** — git hooks.
- **Dependabot** — dependency update PRs.
- **beachball** — versioning + changelogs (`pnpm change` to add change files; release automation deferred).

## Library authoring

For building publishable TypeScript libraries.

- **tsdown** — Rolldown-powered library bundler; fits this repo's oxc/rolldown toolchain and a good default.

(Versioning + publishing is **beachball** — see [Developer experience](#developer-experience).)

## CLI tooling

For building command-line tools.

- **citty** — typed command / argument framework (used by dev-domains).
- **@clack/prompts** — interactive prompts.
- **picocolors** — terminal colors (tiny, fast).
- **ink** — React for the terminal, for rich interactive CLIs.
- **c12** — Configuration file management.
- **package-manager-detector** — package-manager discovery and command resolution for dev-domains.

## Scaffolding

Used by `@buildkitgg/scaffolder` to edit project files without losing your formatting.

- **jsonc-parser** — reads and edits JSON and JSONC, keeping comments. Parse through the scaffolder's wrapper, which
  refuses `__proto__` keys.
- **yaml** — YAML document edits that keep comments. It re-indents on output, so write only when a value changes.
- **diff** (jsdiff) — line counts and patches; **node-diff3** — line-based three-way merges of starter files.
- **oxc-parser** + **magic-string** — small codemods that edit only the span they change.

## Testing

- **Vitest** — test runner; **happy-dom** — DOM environment; **@vitest/coverage-v8** — coverage.
- **@testing-library/react**, **user-event**, **jest-dom** — component testing.
- **@playwright/test** — browser engine (also drives Storybook browser tests).
- **msw** — API mocking (see the `ApiMock` helper in tests).
- **Storybook** + **@storybook/react-vite** — component workshop.
- **@storybook/addon-vitest** — run stories as tests; **@storybook/addon-a11y** — accessibility checks.
- **@chromatic-com/storybook** + **chromatic** — visual regression + Storybook publishing.
- **@alwaysmeticulous/recorder-plugin** + **@alwaysmeticulous/recorder-loader** — record real sessions to auto-generate
  e2e coverage.
- **@axe-core/playwright** — automated accessibility checks in Playwright/e2e (complements the Storybook a11y addon).

## Core libraries

- **zod** — schema validation (Standard Schema; powers forms + env parsing).
- **@t3-oss/env-core** — type-safe environment variables.
- **ts-pattern** — pattern matching / exhaustive unions; **ts-extras** — type-safe stdlib helpers.
- **tiny-invariant** — runtime assertions.
- **date-fns** — date utilities.
- **@mantine/hooks** — React hooks catalog.
- **react-error-boundary** — error boundaries; **nuqs** — type-safe URL state.
- **@tanstack/react-router** — type-safe routing. Preferred setup: **@tanstack/router-plugin** (Vite, file-based
  routes) + **router-devtools**. _(This repo currently uses code-based routes; move to the plugin when routes grow.)_
- **react-hook-form** + **@hookform/resolvers** — forms with Zod-backed validation.
- **@tanstack/react-hotkeys** — keyboard shortcuts (or `useHotkeys` from `@mantine/hooks`).

## UI & components

- **the-new-css-reset** — CSS reset.
- **@fluentui/react-components** — component library (Fluent UI v9); **@fluentui/react-icons** — icons for Fluent-based
  apps and product surfaces.
- **@fluentui/react-datepicker-compat** + **@fluentui/react-timepicker-compat** — date and time inputs for Fluent
  surfaces.
- **@fluentui/react-charting** or **recharts** — charts / data visualization.
- **shadcn/ui** — component scaffolding for apps and product surfaces that select the shadcn architecture
  (`pnpm dlx shadcn@latest init -t <vite|start>`). Use its Tailwind CSS and CSS-variable token model consistently.

Select Fluent UI or shadcn/ui at the app or product-surface boundary. Neither is a monorepo-wide requirement, and an
existing surface should keep its established system unless its architecture is deliberately changed.

## Markdown & rich text

Built on the **unified** (remark + rehype) ecosystem — the standard for parsing and transforming Markdown/HTML.

- **react-markdown** — render Markdown as React components (no `dangerouslySetInnerHTML`); the default for showing
  Markdown content.
- **remark-rehype** + **rehype-react** — build a custom Markdown→React pipeline directly on **unified** when
  `react-markdown` isn't flexible enough.

## State management

- **zustand** — lightweight client state (default for local/global UI state).
- **@reduxjs/toolkit** — formal store for larger apps; includes **RTK Query**, our **preferred data-fetching /
  server-cache** layer.

## Database & data layer

- **drizzle-orm** + **drizzle-zod** + **drizzle-kit** — SQL ORM, zod schema bridge, and migrations.
- **@neondatabase/serverless** — serverless Postgres driver.
- **convex** — reactive backend + database (alternative to a SQL stack).

## Authentication

- **better-auth** — self-hosted auth.
- **@workos-inc/authkit-react** — enterprise SSO / directory sync.

## Payments

- **stripe** — server-side SDK (checkout, subscriptions, webhooks).
- **@stripe/stripe-js** — the browser Stripe.js loader.
- **@stripe/react-stripe-js** — React components + hooks for Stripe Elements.

## File uploads

- **react-dropzone** — drag-and-drop / file-picker hook; pairs with any upload target.
- **uploadthing** — managed uploads (files land in UploadThing's own S3-backed storage, not your bucket). For uploads
  into your **own** blob storage, mint a short-lived SAS/presigned URL server-side and upload directly (e.g.
  `@azure/storage-blob`).
- **convex** — built-in file storage + serving when Convex is the backend.

## Observability

- **@sentry/react** — error + performance monitoring.
- **@launchdarkly/react-sdk** — feature flags.

## Backend / full-stack

- **@tanstack/react-start** — full-stack React (SSR, server functions). Scaffold with `npx @tanstack/cli@latest create`.

## Background jobs & events

- **@trigger.dev/sdk** — durable background tasks, scheduled/cron jobs, and event/webhook handlers (long-running work
  off the request path).
- **@trigger.dev/react-hooks** — realtime hooks to subscribe to run status from the frontend.
- **convex** — its scheduled functions, cron, and database triggers cover event-driven work when Convex is the backend.

## Notifications

- **@trycourier/courier** — multi-channel notification infrastructure.
- **novu** — multi-channel notification infrastructure with optional self hosting.

## Scheduling

- **nylas** — calendar / scheduling API (server-side SDK for events, availability, and bookings).
- **@nylas/react** — React components + hooks for embedding Nylas scheduling UI.

## Localization (i18n)

- **react-intl** + **@formatjs/cli** + **@formatjs/unplugin** — FormatJS message extraction + runtime.
- **@lingui/core** + **@lingui/react** + **@lingui/cli** + **@lingui/vite-plugin** — the localization the scaffolder's
  i18n add-on writes into generated Buildkit apps, as app code with extract and check scripts (owner, 2026-10-29).
- **generaltranslation** — AI-assisted translation.

## SEO

- **react-schemaorg** — typed schema.org structured data.
