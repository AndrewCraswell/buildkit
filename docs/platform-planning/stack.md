# Recommended Stack

What to use for each job when building an app. Use these before reaching for anything else.

**Default** = selected by default when you create an app; you can change it · **Add** = recommended when you need the
feature · **Choose one** = pick one of the listed options; each has its own section below

## Contents

- [New app defaults](#new-app-defaults)
- [Code libraries](#code-libraries)
  - [Toolchain](#toolchain)
  - [Testing](#testing)
  - [Core and utilities](#core-and-utilities)
  - [App framework and data](#app-framework-and-data)
  - [UI](#ui)
  - [Content](#content)
  - [CLIs and packages](#clis-and-packages)
- [Services](#services)
- [Buildkit](#buildkit)
  - [Packages available now](#packages-available-now)
  - [Packages coming](#packages-coming)
  - [Services coming](#services-coming)
- [Better Apps](#better-apps)
  - [Deploy and environments](#deploy-and-environments)
  - [Collaboration](#collaboration)
- [Auth](#auth)
  - [Billing](#billing)
- [Database](#database)
- [Background jobs](#background-jobs)
- [By app type](#by-app-type)
  - [By audience](#by-audience)
  - [By kind of app](#by-kind-of-app)
- [App structure](#app-structure)
  - [Folders](#folders)
  - [Layout](#layout)
- [AI guidance](#ai-guidance)
  - [Instructions](#instructions)
  - [Guides](#guides)
  - [Skills](#skills)
  - [Checklists](#checklists)

---

## New app defaults

| Area                  | Included                                                                                                                                                                                                                                                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Runtime and toolchain | [Node.js](https://nodejs.org) LTS, [pnpm](https://pnpm.io), [Vite+](https://viteplus.dev) (build, test, lint, format, tasks, git hooks), [knip](https://knip.dev)                                                                                                                                                                                                  |
| Framework             | [TanStack Start](https://tanstack.com/start), [Router](https://tanstack.com/router), [Query](https://tanstack.com/query), [Form](https://tanstack.com/form)                                                                                                                                                                                                        |
| State                 | URL state in [Router search params](https://tanstack.com/router/latest/docs/framework/react/guide/search-params), client state in [Zustand](https://zustand.docs.pmnd.rs)                                                                                                                                                                                          |
| Validation            | [Zod](https://zod.dev), [@t3-oss/env-core](https://env.t3.gg) for environment variables                                                                                                                                                                                                                                                                            |
| TypeScript utilities  | [es-toolkit](https://es-toolkit.dev), [ts-extras](https://github.com/sindresorhus/ts-extras), [type-fest](https://github.com/sindresorhus/type-fest), [ts-reset](https://www.totaltypescript.com/ts-reset), [ts-pattern](https://github.com/gvergnaud/ts-pattern), [date-fns](https://date-fns.org)                                                                |
| UI                    | [Buildkit](https://buildkit.gg) [shadcn/ui](https://ui.shadcn.com) on [Base UI](https://base-ui.com), [Tailwind CSS v4](https://tailwindcss.com), [Lucide](https://lucide.dev) icons, [Sonner](https://sonner.emilkowal.ski) toasts, [react-error-boundary](https://github.com/bvaughn/react-error-boundary), [@mantine/hooks](https://mantine.dev/hooks/package/) |
| Buildkit packages     | [`shadcn-theme`](https://buildkit.gg), [`shadcn-modals-manager`](https://buildkit.gg), [`shadcn-alerts-manager`](https://buildkit.gg), [`dev-domains`](https://buildkit.gg)                                                                                                                                                                                        |
| Testing               | Unit and component tests with [Vitest](https://vitest.dev), [happy-dom](https://github.com/capricorn86/happy-dom) and [Testing Library](https://testing-library.com); coverage with [@vitest/coverage-v8](https://vitest.dev/guide/coverage)                                                                                                                       |
| Pipelines             | Preview, staging and production on [GitHub Actions](https://github.com/features/actions), [Dependabot](https://docs.github.com/en/code-security/dependabot)                                                                                                                                                                                                        |

Auth, a database and background jobs aren't included unless you choose them when you create the app (or add them later):
see [Auth](#auth), [Database](#database) and [Background jobs](#background-jobs). Choosing a database adds
[Drizzle](https://orm.drizzle.team).

---

## Code libraries

### Toolchain

| Job                                         | Use                                                                               | Status  |
| ------------------------------------------- | --------------------------------------------------------------------------------- | ------- |
| Runtime and packages                        | [Node.js](https://nodejs.org) LTS, [pnpm](https://pnpm.io) (workspaces + catalog) | Default |
| Build, test, lint, format, tasks, git hooks | [Vite+](https://viteplus.dev)                                                     | Default |
| Unused files and dependencies               | [knip](https://knip.dev)                                                          | Default |
| Local HTTPS domains                         | [@buildkitgg/dev-domains](https://buildkit.gg)                                    | Default |
| Script orchestration                        | [npm-run-all2](https://github.com/bcomnes/npm-run-all2)                           | Add     |

### Testing

| Job                | Use                                                                                                                                                                                            | Status  |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Unit and component | [Vitest](https://vitest.dev) + [happy-dom](https://github.com/capricorn86/happy-dom) + [Testing Library](https://testing-library.com)                                                          | Default |
| Coverage           | [@vitest/coverage-v8](https://vitest.dev/guide/coverage)                                                                                                                                       | Default |
| End to end         | [Playwright](https://playwright.dev)                                                                                                                                                           | Add     |
| Accessibility      | [@axe-core/playwright](https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright), [@storybook/addon-a11y](https://storybook.js.org/docs/writing-tests/accessibility-testing) | Add     |
| API mocking        | [MSW](https://mswjs.io)                                                                                                                                                                        | Add     |
| Component workshop | [Storybook](https://storybook.js.org) (react-vite, addon-vitest)                                                                                                                               | Add     |

### Core and utilities

| Job                                                                                                    | Use                                                                     | Status                                      |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------- |
| Validation                                                                                             | [Zod](https://zod.dev)                                                  | Default                                     |
| Environment variables                                                                                  | [@t3-oss/env-core](https://env.t3.gg)                                   | Default                                     |
| Pattern matching                                                                                       | [ts-pattern](https://github.com/gvergnaud/ts-pattern)                   | Default                                     |
| Dates                                                                                                  | [date-fns](https://date-fns.org)                                        | Default                                     |
| General helpers (arrays, objects, functions, string casing, `invariant`)                               | [es-toolkit](https://es-toolkit.dev)                                    | Default                                     |
| Typed versions of built-ins and assertions (`objectKeys`, `isPresent`, `assertPresent`, `assertNever`) | [ts-extras](https://github.com/sindresorhus/ts-extras)                  | Default                                     |
| Utility types (`SetRequired`, `PartialDeep`, branded IDs)                                              | [type-fest](https://github.com/sindresorhus/type-fest)                  | Default                                     |
| Safer built-in typings (`JSON.parse` returns `unknown`)                                                | [ts-reset](https://www.totaltypescript.com/ts-reset)                    | Default (apps only, not published packages) |
| Error boundaries                                                                                       | [react-error-boundary](https://github.com/bvaughn/react-error-boundary) | Default                                     |
| React hooks                                                                                            | [@mantine/hooks](https://mantine.dev/hooks/package/)                    | Default                                     |

### App framework and data

| Job                         | Use                                                                                                                              | Status     |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Framework                   | [TanStack Start](https://tanstack.com/start)                                                                                     | Default    |
| Routing                     | [TanStack Router](https://tanstack.com/router) (file routes)                                                                     | Default    |
| URL state                   | [TanStack Router search params](https://tanstack.com/router/latest/docs/framework/react/guide/search-params), validated with Zod | Default    |
| Server state                | [TanStack Query](https://tanstack.com/query), defined in `src/api` (see [Instructions](#instructions))                           | Default    |
| Client state                | [Zustand](https://zustand.docs.pmnd.rs)                                                                                          | Default    |
| Forms                       | [TanStack Form](https://tanstack.com/form) + [shadcn Field](https://ui.shadcn.com/docs/components/field)                         | Default    |
| ORM and migrations          | [Drizzle](https://orm.drizzle.team) (drizzle-orm, drizzle-kit, drizzle-zod), added when you choose a database                    | Add        |
| Auth                        | [Better Auth](https://www.better-auth.com) · [WorkOS](https://workos.com) · [Clerk](https://clerk.com)                           | Choose one |
| User preferences            | [@buildkitgg/react-preferences](https://buildkit.gg)                                                                             | Add        |
| Typed config with overrides | [@buildkitgg/react-configuration](https://buildkit.gg)                                                                           | Add        |
| Keyboard shortcuts          | [@tanstack/react-hotkeys](https://www.npmjs.com/package/@tanstack/react-hotkeys)                                                 | Add        |

### UI

| Job                           | Use                                                                                                                                                                                                                                                                                                                             | Status     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Components                    | [shadcn/ui](https://ui.shadcn.com) on [Base UI](https://base-ui.com) via [@buildkitgg/shadcn-baseui-&lt;style&gt;](https://buildkit.gg)                                                                                                                                                                                         | Default    |
| Theme                         | [@buildkitgg/shadcn-theme](https://buildkit.gg)                                                                                                                                                                                                                                                                                 | Default    |
| Styling                       | [Tailwind CSS v4](https://tailwindcss.com) through [@tailwindcss/vite](https://tailwindcss.com/docs/installation/using-vite), with Buildkit's `@buildkitgg/shadcn-baseui-<style>/tailwind.css` imported alongside it. Set up by the app template: one plugin, one stylesheet, no config file. Registry blocks work as installed | Default    |
| CSS reset                     | [Tailwind Preflight](https://tailwindcss.com/docs/preflight), which comes with `@import "tailwindcss"`. No separate reset package                                                                                                                                                                                               | Default    |
| Modals and confirms           | [@buildkitgg/shadcn-modals-manager](https://buildkit.gg)                                                                                                                                                                                                                                                                        | Default    |
| Inline alerts                 | [@buildkitgg/shadcn-alerts-manager](https://buildkit.gg)                                                                                                                                                                                                                                                                        | Default    |
| Toasts                        | [Sonner](https://sonner.emilkowal.ski)                                                                                                                                                                                                                                                                                          | Default    |
| Icons                         | [Lucide](https://lucide.dev) by default, or [Tabler Icons](https://tabler.io/icons), [Hugeicons](https://hugeicons.com), [Phosphor](https://phosphoricons.com) or [Remix Icon](https://remixicon.com). Set in `components.json` (`iconLibrary`), so registry blocks follow the app's choice                                     | Choose one |
| File upload                   | [Uploadcn](https://uploadcn.dev)                                                                                                                                                                                                                                                                                                | Add        |
| Route tabs and panels         | [@buildkitgg/tanstack-router](https://buildkit.gg)                                                                                                                                                                                                                                                                              | Add        |
| Tables                        | [tablecn](https://table-cn.vercel.app) on [TanStack Table](https://tanstack.com/table) (v9): filter builder, inline and bulk editing, saved layouts, virtualization, URL state, Base UI                                                                                                                                         | Add        |
| Editable grids                | [gridcn](https://gridcn.vercel.app)                                                                                                                                                                                                                                                                                             | Add        |
| Long lists                    | [TanStack Virtual](https://tanstack.com/virtual)                                                                                                                                                                                                                                                                                | Add        |
| Charts                        | [shadcn Charts](https://ui.shadcn.com/charts)                                                                                                                                                                                                                                                                                   | Add        |
| Interactive workflow charts   | [React Flow](https://reactflow.dev) (`@xyflow/react`)                                                                                                                                                                                                                                                                           | Add        |
| Steppers and multi-step forms | [Stepperize](https://stepperize.com) (`@stepperize/react`), headless, with a Zod schema per step and TanStack Form support                                                                                                                                                                                                      | Add        |
| Command palette               | [shadcn Command](https://ui.shadcn.com/docs/components/command) ([cmdk](https://cmdk.paco.me))                                                                                                                                                                                                                                  | Add        |
| Drag and drop                 | [dnd-kit](https://dndkit.com)                                                                                                                                                                                                                                                                                                   | Add        |
| Animation                     | [Motion](https://motion.dev)                                                                                                                                                                                                                                                                                                    | Add        |

### Content

| Job                                                                                             | Use                                                                                                                                                                                                                                                                                                                        | Status     |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Rich text editing                                                                               | [Tiptap](https://tiptap.dev) as the engine, with [emend](https://getemend.vercel.app)'s editor from the shadcn registry (`@emend/emend-editor-base`, built on Base UI). Add an emend AI variant (bubble menu, composer or assistant) when an app wants AI writing                                                          | Add        |
| Email templates                                                                                 | [React Email](https://react.email)                                                                                                                                                                                                                                                                                         | Add        |
| Localization                                                                                    | [Lingui](https://lingui.dev) (`@lingui/core`, `@lingui/react`, `@lingui/vite-plugin` with its native macro transform). ICU MessageFormat, strings written inline with a comment for translators                                                                                                                            | Add        |
| Integrating LLMs and agents (model calls, streaming, tool calls, structured output, chat hooks) | [Vercel AI SDK](https://ai-sdk.dev) (`ai` on the server, `@ai-sdk/react` on the client)                                                                                                                                                                                                                                    | Add        |
| AI chat UI                                                                                      | [shadcn AI components](https://ui.shadcn.com/docs/ai-elements) on the AI SDK's `useChat` for focused AI features; [assistant-ui](https://www.assistant-ui.com) (with its [Elements](https://www.assistant-ui.com/elements)) when multi-thread chat with history is central, or the chat fronts an agent on another backend | Choose one |
| Docs sites                                                                                      | [Fumadocs](https://fumadocs.dev) on TanStack Start (through Vite), styled with the app's theme                                                                                                                                                                                                                             | Add        |
| Render Markdown                                                                                 | [react-markdown](https://github.com/remarkjs/react-markdown)                                                                                                                                                                                                                                                               | Add        |

### CLIs and packages

| Job                       | Use                                                                   | Status  |
| ------------------------- | --------------------------------------------------------------------- | ------- |
| Commands and arguments    | [citty](https://github.com/unjs/citty)                                | Default |
| Prompts                   | [@clack/prompts](https://github.com/bombshell-dev/clack)              | Default |
| Terminal colors           | [picocolors](https://github.com/alexeyraspopov/picocolors)            | Default |
| Library bundling          | [Vite+](https://viteplus.dev/guide/pack) (`vp pack`, built on tsdown) | Default |
| Versioning and publishing | [beachball](https://microsoft.github.io/beachball/)                   | Default |
| Interactive terminal UI   | [Ink](https://github.com/vadimdemedes/ink)                            | Add     |
| Config files              | [c12](https://github.com/unjs/c12)                                    | Add     |

---

## Services

| Job                                              | Use                                                                                                                                                                                             | Status     |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Hosting and compute                              | [Cloudflare Workers](https://workers.cloudflare.com)                                                                                                                                            | Add        |
| Database                                         | [D1](https://developers.cloudflare.com/d1/) · [Neon](https://neon.tech) · [Convex](https://www.convex.dev)                                                                                      | Choose one |
| Background jobs                                  | [Queues](https://developers.cloudflare.com/queues/) + [Workflows](https://developers.cloudflare.com/workflows/) · [Trigger.dev](https://trigger.dev) · [Temporal](https://temporal.io)          | Choose one |
| Auth                                             | [Better Auth](https://www.better-auth.com) · [WorkOS](https://workos.com) · [Clerk](https://clerk.com)                                                                                          | Choose one |
| File storage                                     | [Cloudflare R2](https://developers.cloudflare.com/r2/) (through Uploadcn)                                                                                                                       | Add        |
| Transactional email                              | [Resend](https://resend.com)                                                                                                                                                                    | Add        |
| Errors                                           | [Sentry](https://sentry.io)                                                                                                                                                                     | Add        |
| Product analytics, session replay, feature flags | [PostHog](https://posthog.com)                                                                                                                                                                  | Add        |
| CI/CD                                            | [GitHub Actions](https://github.com/features/actions) + [GitHub Environments](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment) | Default    |
| Dependency updates                               | [Dependabot](https://docs.github.com/en/code-security/dependabot)                                                                                                                               | Default    |
| Realtime                                         | [Durable Objects](https://developers.cloudflare.com/durable-objects/)                                                                                                                           | Add        |
| Payments                                         | [Stripe](https://stripe.com)                                                                                                                                                                    | Add        |
| Notifications (email, push, in-app inbox)        | [Novu](https://novu.co)                                                                                                                                                                         | Add        |
| Calendars and scheduling                         | [Nylas](https://www.nylas.com)                                                                                                                                                                  | Add        |
| AI models                                        | [OpenRouter](https://openrouter.ai): one API key and billing for models from every major provider                                                                                               | Add        |
| LLM tracing and evals                            | [Langfuse](https://langfuse.com)                                                                                                                                                                | Add        |

---

## Buildkit

Our own packages and services, published as [`@buildkitgg/*`](https://buildkit.gg).

### Packages available now

| Package                                                    | Does                                                                                                  |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| [`@buildkitgg/shadcn-baseui-<style>`](https://buildkit.gg) | Locked shadcn components on Base UI, in eight styles (luma, lyra, maia, mira, nova, rhea, sera, vega) |
| [`@buildkitgg/shadcn-theme`](https://buildkit.gg)          | Theme tokens: colors, radius, typography, dark mode                                                   |
| [`@buildkitgg/shadcn-modals-manager`](https://buildkit.gg) | Modals and confirms with typed results (`await confirm()`)                                            |
| [`@buildkitgg/shadcn-alerts-manager`](https://buildkit.gg) | Inline alerts                                                                                         |
| [`@buildkitgg/tanstack-router`](https://buildkit.gg)       | Route-driven tabs and panels                                                                          |
| [`@buildkitgg/react-preferences`](https://buildkit.gg)     | User preferences                                                                                      |
| [`@buildkitgg/react-configuration`](https://buildkit.gg)   | Typed config with developer overrides                                                                 |
| [`@buildkitgg/dev-domains`](https://buildkit.gg)           | Local HTTPS domains that work across git worktrees                                                    |

### Packages coming

| Package                                          | Does                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| API layer (`defineApi`)                          | One file per resource defining its queries, mutations and invalidation, with lint rules that keep queries out of components                                                                                                                                                                                                                                                                                                                                        |
| Async state                                      | Loading, empty, error, offline and forbidden states as one component, with retry                                                                                                                                                                                                                                                                                                                                                                                   |
| Permissions                                      | `can()` on the server and `<Can>` in components, the same for Better Auth, WorkOS and Clerk                                                                                                                                                                                                                                                                                                                                                                        |
| Scaffolder (`@buildkitgg/scaffolder`)            | The engine for creating projects from templates and adding features later. A project is computed from a catalog of templates and add-ons; the scaffolder records what it generated, and adding a feature updates only files you haven't changed, merges JSON key by key, and reports conflicts instead of overwriting. Previews every change before writing. Buildkit's app templates and add-ons (auth, database, uploads, localization and more) are built on it |
| Form fields (`@buildkitgg/shadcn-tanstack-form`) | Ready-made form fields that connect TanStack Form to shadcn's Field, so each input shows its label, description, required state and errors without wiring. Covers text, textarea, number, select, combobox, checkbox, switch, radio group, slider, date and OTP, plus a submit button with pending state and server errors mapped onto fields                                                                                                                      |
| Copy to clipboard                                | `useCopy()` and `<CopyButton>` with copied and failed states                                                                                                                                                                                                                                                                                                                                                                                                       |
| tablecn adapters                                 | A TanStack Router adapter for tablecn's URL state, and a converter that turns its filters into Drizzle queries for server-side filtering                                                                                                                                                                                                                                                                                                                           |
| Lint config (`@buildkitgg/oxlint-config`)        | Oxlint config with a shared base plus rule sets that switch on with each feature: the API layer, localization, locked components, server functions and more. Our own rules ship as Oxlint plugins. The scaffolder adds a feature's rules when the feature is enabled                                                                                                                                                                                               |
| Endpoint mocking (`MockEndpoint`)                | A class that wraps MSW: one line creates a mock endpoint that returns the response you give it, with a built-in spy to assert calls, request bodies and params. Works the same in unit tests and Storybook, so there's no MSW boilerplate to copy around. Supports named scenarios (success, empty, error, slow), and unmocked calls fail instead of reaching the network                                                                                          |
| Storybook preset                                 | One package that sets Storybook up with our defaults, so `main` and `preview` are a couple of lines. It includes the Vitest and accessibility addons; light and dark mode and style switchers; viewports that match our breakpoints; and providers for router, Query, theme and preferences already wrapped around every story. `MockEndpoint` is wired in                                                                                                         |
| Flags and config devtool                         | An in-app panel for developers and testers: toggle feature flags, override config values, edit preferences and switch role, org or plan for the current session, and see where each value came from. Available in local dev and preview, never in production. The same overrides work in Playwright and Storybook                                                                                                                                                  |

### Services coming

| Service                          | Does                                                                                                                                                                                                                                         |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Feature flags with safe rollouts | Typed flags, targeting by user, org, role or plan, staged rollouts, a kill switch and automatic pause when errors rise                                                                                                                       |
| Copywriting MCP                  | Writes and reviews interface text (labels, buttons, empty states, errors, confirmations, toasts) against our voice and content guidelines. Any agent can call it. Modeled on the Fluent Agent MCP                                            |
| Customer branding                | Each customer sees the app with their own logo, colors, fonts and email sender, layered on our theme tokens. Often called white-labeling                                                                                                     |
| Blog                             | Posts written in Markdown or an editor, with drafts, scheduling, authors, tags, RSS, sitemaps and SEO metadata, served from the app's domain                                                                                                 |
| Feedback                         | An in-app widget where users report a bug or share an idea. It captures a screenshot, the page URL and console errors, and files an issue                                                                                                    |
| Link shortening                  | Branded short links and QR codes with click tracking                                                                                                                                                                                         |
| OAuth connections                | Users connect their Google, Slack, GitHub or other accounts. Turning it on adds connection tables to your database, and the service stores tokens encrypted, refreshes them, and gives server functions a ready-to-use client per connection |
| Webhooks                         | Send webhooks to your customers with signing, retries, delivery logs and replay; receive webhooks with signature checks and deduplication                                                                                                    |
| Dev tools                        | A toolbar on local dev and preview builds that brings comments, live presence, feature flag and config overrides, and role switching into the running app, like Vercel's preview toolbar                                                     |
| Visual regression testing        | Captures stories and pages on every PR, compares them with approved baselines, and lets reviewers approve or reject changes. Its own package and review app                                                                                  |
| CI checks                        | A ready-made pipeline that checks every PR: format, lint, typecheck, unused code, tests and Storybook                                                                                                                                        |

---

## Better Apps

Packages that declare the cloud resources an app uses, the services that deploy and run it, and backend features built
on them, published as `@better-apps/*`.

### Deploy and environments

| Package or service    | Does                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Capability packages   | Your code declares the resources it needs (database, storage, queues, realtime rooms) without naming a cloud, and uses them through one runtime API. Adapters implement them on Cloudflare, plus local adapters for tests                                                                                                                                                                                       |
| Vite plugin           | Writes the resources declared in the server bundle to a manifest the deploy service reads                                                                                                                                                                                                                                                                                                                       |
| Deploy CLI            | `better-apps deploy` and a hosted deploy service: one command, locally or in CI, that builds the app and deploys it to an environment with everything it uses. The service provisions the declared resources along with our services, sets secrets, runs migrations, and posts a diff of resource changes on every PR. Projects hold no cloud config; apps run on Cloudflare, deployed through Cloudflare's API |
| Deploy pipelines      | Ready-made pipelines for preview, staging and production: migrations before deploys, deploying to production with approval, gradual rollout and automatic rollback                                                                                                                                                                                                                                              |
| Preview environments  | A full copy of the app for every pull request: its own URL, database, storage and secrets, seeded with data and removed when the PR closes                                                                                                                                                                                                                                                                      |
| Environment variables | Our own secrets vault on Cloudflare and a CLI for it. Env vars and secrets are stored encrypted per app and environment (development, preview, staging, production), typed by each app's schema, and set on each deploy. Locally the CLI injects them at run time, so every git worktree and agent has them with no `.env` file to copy                                                                         |
| Managed storage       | Uploads that just work: R2 per environment, access rules, quotas, image variants. Uploadcn talks to it directly                                                                                                                                                                                                                                                                                                 |
| Custom domains        | Each customer can use their own domain (`app.theircompany.com`), with SSL issued and renewed automatically through Cloudflare for SaaS                                                                                                                                                                                                                                                                          |

### Collaboration

| Feature        | Does                                                                                                                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Comments       | Threaded comments pinned to a page, an element or a record, with @mentions, resolve and reopen, and notifications. Usable in your own app and on previews                                                    |
| Reactions      | Emoji reactions on any record, comment or message: counts, who reacted, live updates, and one reaction per person per emoji                                                                                  |
| Attachments    | Attach files to any record, comment or message. Built on managed storage and Uploadcn, with previews, image thumbnails, access that follows the record's permissions, and cleanup when the record is deleted |
| Live presence  | Who's here right now: avatars, live cursors and selections, kept in sync in realtime rooms                                                                                                                   |
| Approval flows | Request, approve or reject anything (a record, a design, a release, a visual diff) with assignees, status and history                                                                                        |
| Audit log      | A tamper-evident record of who did what, when and from where, written from server functions. Searchable by user, org and record, with an admin view and an export customers can request                      |

---

## Auth

Pick one auth provider per app.

|                                                | Pick it when                                             | Watch out for                                              |
| ---------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------- |
| [**Better Auth**](https://www.better-auth.com) | You want users in your own database and no per-user cost | You own security updates, email flows and abuse protection |
| [**WorkOS**](https://workos.com)               | You sell to companies that need SSO and directory sync   | Enterprise SSO is priced per connection                    |
| [**Clerk**](https://clerk.com)                 | Consumer apps where sign-up polish matters most          | Per-user pricing at scale; users live with the vendor      |

**Not sure?** Better Auth.

### Billing

Billing follows the auth provider:

| Auth        | Billing                                                                                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Better Auth | [Better Auth Stripe plugin](https://www.better-auth.com/docs/plugins/stripe): checkout, customer portal, webhooks, subscriptions synced to your database, seats and org billing |
| WorkOS      | [Stripe](https://stripe.com) through WorkOS's Stripe integration                                                                                                                |
| Clerk       | [Clerk Billing](https://clerk.com/docs/billing/overview)                                                                                                                        |

---

## Database

Pick one database per app.

|                                                 | Pick it when                                                    | Watch out for                           |
| ----------------------------------------------- | --------------------------------------------------------------- | --------------------------------------- |
| [**D1**](https://developers.cloudflare.com/d1/) | Most CRUD apps and internal tools                               | SQLite dialect; per-database size limit |
| [**Neon**](https://neon.tech)                   | You need Postgres: heavy relational work, pgvector, larger data | Connect from Workers through Hyperdrive |
| [**Convex**](https://www.convex.dev)            | Realtime apps where every client sees changes live              | Not SQL; switching later is a rewrite   |

**Not sure?** D1. Move to Neon when you need a Postgres feature.

---

## Background jobs

Pick one jobs system per app.

|                                                                        | Pick it when                                                                   | Watch out for                           |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------- |
| [**Queues + Workflows**](https://developers.cloudflare.com/workflows/) | Emails, webhooks, fan-out, simple multi-step flows                             | Per-step CPU and time limits            |
| [**Trigger.dev**](https://trigger.dev)                                 | Long-running tasks (AI pipelines, imports, media) and you want a run dashboard | Another vendor; deploys separately      |
| [**Temporal**](https://temporal.io)                                    | Business-critical workflows that wait days or months                           | Needs always-on workers outside Workers |

**Not sure?** Queues + Workflows. On Convex, use Convex's scheduler.

---

## By app type

Start from [the new app defaults](#new-app-defaults). Then pick one **audience** and one **kind of app**, and add both
rows.

### By audience

Who the users are decides auth, billing and how polished sign-up needs to be.

| Audience                           | Auth                                                                                                                                     | Billing                                                                           | Also add                                                                                                                        |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **B2C**: individual consumers      | [Clerk](https://clerk.com)                                                                                                               | [Stripe Checkout](https://docs.stripe.com/payments/checkout), per user            | [Motion](https://motion.dev) · [PostHog](https://posthog.com) session replay, [Novu](https://novu.co) push. Design mobile first |
| **B2B**: companies and their teams | [WorkOS](https://workos.com) ([Better Auth](https://www.better-auth.com) until the first enterprise customer)                            | [Stripe Billing](https://docs.stripe.com/billing) subscriptions, per organization | Orgs, roles and invites from the auth provider · [Novu](https://novu.co)                                                        |
| **Internal**: your own team        | [Better Auth](https://www.better-auth.com), or [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/applications/) alone | none                                                                              | [gridcn](https://gridcn.vercel.app), [cmdk](https://cmdk.paco.me)                                                               |

### By kind of app

What the app does decides the database, jobs and libraries.

| Kind of app                                                            | Database                                                                                | Jobs                                                                                                                                                                 | Also add                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Marketing or content site**                                          | none or [D1](https://developers.cloudflare.com/d1/)                                     | none                                                                                                                                                                 | [react-markdown](https://github.com/remarkjs/react-markdown), [Motion](https://motion.dev). Skip auth if it's public                                                                                                                                                                                                            |
| **Dashboard or CRUD app**                                              | [D1](https://developers.cloudflare.com/d1/), then [Neon](https://neon.tech) as it grows | [Queues](https://developers.cloudflare.com/queues/) + [Workflows](https://developers.cloudflare.com/workflows/)                                                      | [TanStack Table](https://tanstack.com/table) + [Virtual](https://tanstack.com/virtual), [shadcn Charts](https://ui.shadcn.com/charts), [gridcn](https://gridcn.vercel.app), [cmdk](https://cmdk.paco.me)                                                                                                                        |
| **AI-powered app** (chat, copilots, features that call LLMs or agents) | [Neon](https://neon.tech) ([pgvector](https://neon.tech/docs/extensions/pgvector))      | [Trigger.dev](https://trigger.dev)                                                                                                                                   | [Vercel AI SDK](https://ai-sdk.dev), [OpenRouter](https://openrouter.ai), [Langfuse](https://langfuse.com), [Durable Objects](https://developers.cloudflare.com/durable-objects/)                                                                                                                                               |
| **Marketplace or booking**                                             | [Neon](https://neon.tech)                                                               | [Queues](https://developers.cloudflare.com/queues/) + [Workflows](https://developers.cloudflare.com/workflows/); [Temporal](https://temporal.io) for complex payouts | [dnd-kit](https://dndkit.com) · [Stripe Connect](https://docs.stripe.com/connect), [Nylas](https://www.nylas.com), [Novu](https://novu.co)                                                                                                                                                                                      |
| **Realtime or collaborative**                                          | [Convex](https://www.convex.dev)                                                        | [Convex scheduler](https://docs.convex.dev/scheduling)                                                                                                               | [Tiptap](https://tiptap.dev) · [Durable Objects](https://developers.cloudflare.com/durable-objects/)                                                                                                                                                                                                                            |
| **CLI or library**                                                     | —                                                                                       | —                                                                                                                                                                    | [citty](https://github.com/unjs/citty), [@clack/prompts](https://github.com/bombshell-dev/clack), [picocolors](https://github.com/alexeyraspopov/picocolors), [Ink](https://github.com/vadimdemedes/ink), [c12](https://github.com/unjs/c12), [tsdown](https://tsdown.dev), [beachball](https://microsoft.github.io/beachball/) |

**Example:** a B2B dashboard uses WorkOS, Stripe subscriptions per organization, D1, Queues + Workflows, TanStack Table
and shadcn Charts.

---

## App structure

### Folders

A pnpm workspace. The app is a thin shell; domain logic lives in packages so it's easy to find and reuse.

```text
apps/
  web/                        TanStack Start app
    src/
      routes/                 File routes: loaders, search params, page composition. No business logic
      components/
        ui/                   One-line re-exports of Buildkit primitives. Nothing else
        layout/               App shell: AppShell, AppHeader, AppSidebar, PageHeader
        <Name>/               One app component per folder: Name.tsx, Name.stories.tsx, Name.test.tsx, index.ts
      api/                    queryOptions / mutationOptions, one file per resource
      server/                 Server functions, middleware, auth context
      lib/                    App-wide clients: env, telemetry, analytics, email
      mocks/                  MSW handlers and scenarios, shared by tests, stories and dev
    e2e/                      Playwright tests
packages/
  <domain>/                   One package per domain, such as projects or billing
    src/
      schema.ts               Drizzle tables and Zod schemas
      server/                 Server functions for this domain
      api/                    Query and mutation options
      components/             Domain UI built from Buildkit primitives
      mocks/                  MSW handlers for this domain
      index.ts                The package's public API
  db/                         Database client, migrations and seeds
  config/                     Shared tsconfig and lint config
docs/                         Guides and checklists
.agents/skills/               Skills
AGENTS.md                     Instructions
```

| Rule                                                                                                  | Why                                |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Apps import packages; packages never import apps                                                      | Packages stay reusable             |
| Domain packages import each other only through `index.ts`                                             | Each domain has one public surface |
| Routes compose; components render; `api` fetches; `server` decides                                    | Each kind of code has one home     |
| Tests and stories sit next to the code they cover                                                     | Easy to find, moves with the code  |
| Start in `apps/web/src`; move a domain into `packages/` once a second app or a second domain needs it | Don't split too early              |

### Layout

Every signed-in page is built from the same regions. Pages fill in the content; they never draw their own navigation.

| Region       | Holds                                                                                                        | Built with                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| App shell    | The frame around every signed-in page. Mounts the providers, command palette, modals, alerts and toasts once | `components/layout/AppShell` in the `_app` layout route                          |
| Header       | Logo, global search, notifications, org switcher, user menu                                                  | `AppHeader`                                                                      |
| Sidebar      | Main navigation. Collapses to an icon rail, and to a sheet on mobile                                         | [shadcn Sidebar](https://ui.shadcn.com/docs/components/sidebar)                  |
| Page header  | Page title, breadcrumbs, primary actions and page-level tabs                                                 | `PageHeader`                                                                     |
| Main content | The route's content. One main task per page                                                                  | The route component                                                              |
| Side panel   | Details for a selected item, filters, or an inspector                                                        | [shadcn Sheet](https://ui.shadcn.com/docs/components/sheet) or a resizable panel |

Layout routes in TanStack Router:

| Route         | Layout                                         |
| ------------- | ---------------------------------------------- |
| `__root.tsx`  | HTML document, theme, global providers         |
| `_app.tsx`    | The signed-in app shell. Checks auth           |
| `_auth.tsx`   | Centered card for sign-in, sign-up and invites |
| `_public.tsx` | Marketing and docs pages: top nav and footer   |

Each region loads independently, so a slow sidebar count never blocks the page. Every region handles its own loading,
empty and error states, works in light and dark, and has a mobile layout.

---

## AI guidance

Every app ships with instructions, guides, skills and checklists so the agent builds it our way.

| Layer        | What it is                                                   | Where it lives                                     |
| ------------ | ------------------------------------------------------------ | -------------------------------------------------- |
| Instructions | The rules below, always loaded                               | `AGENTS.md` (Claude and Copilot files point to it) |
| Guides       | Reference for one area, read before working in it            | `docs/*.md`                                        |
| Skills       | Step-by-step procedures for a task                           | `.agents/skills/<name>/SKILL.md`                   |
| Checklists   | Definition of done for a concern, used by skills and reviews | `docs/checklists/*.md`                             |

### Instructions

1. **Use what exists first.** Buildkit packages, then this list, then the app's own components and `src/api`. A new
   dependency needs a human decision.
2. **Everything gets telemetry.** Server functions, jobs, external calls and key user actions emit traces, logs and
   events. No personal data.
3. **Every data view handles every state.** Loading, empty, error with retry, offline; light and dark; mobile to
   desktop.
4. **Data goes through `src/api`.** Queries and mutations are defined there as `queryOptions` / `mutationOptions`. No
   inline `useQuery` functions or raw `fetch` in components.
5. **Components are locked.** Don't edit or copy shadcn primitives. Wrap them, and change the look through theme tokens.
6. **Validate every boundary with Zod:** server function inputs, external API responses, env vars and forms.
7. **Authorize every server function.** Check who the user is and what they can do; never trust the client.
8. **Put code where it can be found.** Follow the [folder structure](#folders), and build pages inside the
   [app layout](#layout).
9. **Update the docs in the same PR** as the change.
10. **Review every user-facing string** with the copywriting MCP.

### Guides

| Guide                          | Covers                                                                                                          |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Tech stack                     | This document, condensed                                                                                        |
| Utilities catalog              | The helpers we already have, by name. Read before writing a new one                                             |
| Component catalog              | Buildkit components, approved registry blocks, and when to use which                                            |
| Project structure and packages | The folder layout, what goes where, and when to split a domain into a package                                   |
| App layout                     | The app shell, header, sidebar, page header, main content and side panel, and which layout route each page uses |
| API mocking                    | Writing MSW handlers and scenarios once and using them in tests, stories and local dev                          |
| API layer                      | `src/api`, query keys, invalidation, prefetching in loaders, optimistic updates                                 |
| Connecting external APIs       | Typed clients, validated responses, timeouts and retries, secrets, webhooks, mocks                              |
| Data modeling and migrations   | Drizzle conventions, indexes, safe migrations, seeds                                                            |
| Auth and permissions           | The chosen provider, roles and orgs, protecting routes and server functions                                     |
| Config, flags and preferences  | Which layer a setting belongs in and how to add one                                                             |
| Telemetry                      | Errors, spans, product events, logs, AI traces, and what never to log                                           |
| Resilient UI                   | Loading, empty and error states, optimistic UI, long text, dark mode, responsive, keyboard                      |
| Design tokens and theming      | Styles, tokens, dark mode, when a design change is a token change                                               |
| Testing                        | What to test at each level, fixtures, mocks, visual baselines                                                   |
| Environments and deployments   | Preview, staging and production; secrets; migrations; rollbacks                                                 |
| Security                       | Headers and CSP, authorization, input validation, uploads, SSRF, secrets                                        |
| Writing documentation          | How to write and update guides, READMEs and specs                                                               |
| Interface copy                 | Voice and tone, capitalization, button and error wording, empty states, numbers and dates                       |
| Conventions                    | TypeScript, React, hooks and file layout                                                                        |

### Skills

**Build**

| Skill                            | Does                                                                                                  |
| -------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `new-app`                        | Scaffold an app; pick auth, database and jobs for the app type; set up environments and pipelines     |
| `add-feature`                    | A full slice: schema, migration, server function, `src/api`, route, UI, story, tests, telemetry, docs |
| `add-resource`                   | List, detail, create, edit and delete for an entity, with permissions                                 |
| `add-page`                       | A route with loader prefetch, search params, layout and every UI state                                |
| `add-form`                       | TanStack Form + Zod + shadcn Field, with server validation                                            |
| `add-data-table`                 | Filters, sort and pagination in the URL, queried on the server                                        |
| `connect-api`                    | An external API client with validation, mocks and telemetry                                           |
| `add-webhook`                    | Signature checks, idempotency, queueing and replay                                                    |
| `add-job`                        | A background job with retries and monitoring                                                          |
| `add-upload`                     | Uploadcn with access rules and image variants                                                         |
| `add-flag`                       | A typed feature flag, rollout and cleanup                                                             |
| `add-email` / `add-notification` | React Email + Resend; Novu workflows                                                                  |
| `add-payments`                   | Stripe checkout, subscriptions and webhooks                                                           |
| `add-i18n`                       | Messages, locale switching and localized URLs                                                         |
| `design-to-code`                 | Turn a design into components                                                                         |

**Quality**

| Skill                  | Does                                                                 |
| ---------------------- | -------------------------------------------------------------------- |
| `code-review`          | Review a change against our checklists                               |
| `security-review`      | Run the security checklist on a change or a whole app                |
| `resilience-pass`      | Walk every view through every state, theme, screen size and keyboard |
| `add-telemetry`        | Instrument a feature to the telemetry guide                          |
| `copy-review`          | Check every new or changed string with the copywriting MCP           |
| `accessibility-review` | Automated and manual accessibility checks                            |
| `performance-review`   | Bundle size, request waterfalls, prefetching, images                 |
| `write-tests`          | Pick the right test level and write the test                         |
| `migration-safety`     | Check a schema change is safe to deploy and roll back                |
| `reuse-scan`           | Find hand-written code that duplicates something we already have     |

**Planning and process**

| Skill                  | Does                                                                 |
| ---------------------- | -------------------------------------------------------------------- |
| `grill-me`             | A relentless interview to sharpen a plan before building             |
| `write-spec`           | Turn an idea into a spec: screens, data, states, acceptance criteria |
| `write-docs`           | Write or update documentation the way we do it                       |
| `split-into-packages`  | Propose package boundaries for a growing app                         |
| `propose-dependency`   | Make the case for adding a library that isn't on this list           |
| `debug`                | Reproduce, isolate, fix, add a regression test                       |
| `upgrade-stack`        | Move an app to a new stack version                                   |
| `release` / `incident` | Promote to production; triage and roll back                          |

### Checklists

| Checklist          | Covers                                                                                                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Definition of done | What every feature needs before it merges                                                                                                                              |
| Security           | CSP and security headers, authorization on every server function, input validation, CSRF, rate limits, upload limits, SSRF, no secrets in the client, dependency audit |
| Resilient UI       | Every state, both themes, three screen sizes, long content, keyboard and screen reader                                                                                 |
| Telemetry          | Spans, captured errors, named product events, no personal data                                                                                                         |
| Accessibility      | Focus order, labels, contrast, motion                                                                                                                                  |
| Release            | Steps and checks before promoting to production                                                                                                                        |
