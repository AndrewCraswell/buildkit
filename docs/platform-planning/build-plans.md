# Build plans

Designs for what we plan to build: Better Apps' deploy CLI, the services that run with it, and its collaboration and
feature-flag features; Buildkit's packages and services; the pipelines; and AI guidance. The recommendations themselves
are in [stack.md](stack.md); the scaffolder design is in [scaffolder-research.md](scaffolder-research.md), and the
deploy design in [better-apps-deploy.md](better-apps-deploy.md).

# CI/CD pipelines

Every template ships its pipelines. Workflows in the app repo are thin and call **versioned composite actions**, so
fixes and upgrades roll out centrally instead of being copied into every app. The preview, deploy and cleanup workflows
and their actions (for example `better-apps/actions/migrate@v1`) belong to Better Apps; the app-code checks in `ci.yml`
belong to Buildkit. The scaffolder generates the workflow set from the app's choices (data layer, jobs, packages vs
app).

## Pipelines

| Workflow                | Owner                                                  | Runs on                         | Steps                                                                                                                                                                                                                                               |
| ----------------------- | ------------------------------------------------------ | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci.yml`                | Buildkit                                               | Every PR                        | pnpm install (cached) → oxfmt check → oxlint → typecheck → knip → Vitest → build → **migration check** (schema changed ⇒ a migration was generated and committed)                                                                                   |
| `preview.yml`           | Better Apps                                            | Every PR push                   | `better-apps deploy --env preview` (the PR's own Worker and database, migrations applied) → seed → Playwright E2E + axe → VRT → comment URL + results on the PR                                                                                     |
| `storybook.yml`         | Buildkit                                               | PRs touching UI                 | Build Storybook → story tests (addon-vitest) → VRT (our visual regression service)                                                                                                                                                                  |
| `deploy-staging.yml`    | Better Apps                                            | Merge to `main`                 | `better-apps deploy --env staging` (build, migrations, deploy) → smoke tests → upload sourcemaps to Sentry → create Sentry release                                                                                                                  |
| `deploy-production.yml` | Better Apps                                            | Manual promote                  | Approval → `better-apps deploy --env production`: restore point (D1 Time Travel bookmark / Neon branch / Convex export) → migrations → canary (traffic split by the dispatch Worker) → smoke tests → watch error rate → auto-rollback on regression |
| `cleanup.yml`           | Better Apps                                            | PR closed                       | The deploy service removes the PR's Worker, database and bucket; delete any Neon branch                                                                                                                                                             |
| `release-packages.yml`  | Buildkit                                               | Merge to `main` (library repos) | beachball bump → tsdown build → npm publish with trusted publishing (OIDC)                                                                                                                                                                          |
| `scheduled.yml`         | Buildkit; the preview-resource sweeper is Better Apps' | Nightly                         | Backup export, dependency audit, preview-resource sweeper                                                                                                                                                                                           |

## Migration rules (enforced by the pipelines)

1. **Generated in the PR, reviewed as SQL.** `drizzle-kit generate` output is committed; CI fails if the schema changed
   without one.
2. **Applied before the code that needs them.** Migrate, then deploy.
3. **Expand, then contract.** Add columns/tables in one release, remove old ones in a later release. No destructive
   change ships alongside the code that stops using it.
4. **Backfills are jobs, not migrations.** Large data changes run through the chosen jobs system.
5. **Restore point before every production migration.**

Rule 1 is a `ci.yml` check (Buildkit). The deploy service applies rules 2 and 5 (Better Apps).

## Build artifacts

| Artifact                       | Destination                                                                                           |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Worker bundle + static assets  | Better Apps' deploy service: Cloudflare Workers for Platforms in v1 (static assets served by Workers) |
| Sourcemaps                     | Sentry (not deployed publicly)                                                                        |
| Storybook                      | R2, for our visual regression service                                                                 |
| Packages                       | npm (trusted publishing)                                                                              |
| Playwright traces, screenshots | GitHub Actions artifacts                                                                              |

## Secrets

Per-environment secrets live in Better Apps' vault (below); the deploy service sets them on the environment's Worker
during deploy. `@t3-oss/env-core` validates them at startup, so a missing secret fails the deploy, not a user request.

---

# Better Apps services

These belong to Better Apps, not Buildkit: the deploy CLI and the services that run with it (environments and preview
environments, custom domains, the environment variables vault, managed storage), plus the collaboration features and
feature flags. Buildkit keeps the application-code helpers and the scaffolder. Only the deploy service is paid; nothing
else here has a payment plan.

## Deploy CLI

**Goal:** one command (locally and in CI) that builds the app and deploys it to an environment with everything it needs.
It belongs to Better Apps, not Buildkit, and is a paid product: the `better-apps deploy` CLI plus a hosted deploy
service. The scaffolder stays in Buildkit. Full design in [better-apps-deploy.md](better-apps-deploy.md).

**Decided (2026-10-28):**

- **Not built on Void.**
- **Capability packages drive deploys.** Code declares the cloud resources it uses with open capability packages from
  Better Apps, for example `defineDatabase("main")`, `defineBucket("uploads")` or `defineRoom("presence")` (names not
  settled). App code, Better Apps features and the scaffolder's starter code all declare resources the same way. The
  Better Apps Vite plugin writes the declarations that reach the server bundle to a manifest.
- **Better Apps picks the cloud behind the scenes.** Users never configure a provider, and projects hold no cloud config
  (no Wrangler config, no `cloudflare.config.ts`). The capability packages and their Cloudflare adapters are open;
  what's charged for is the service. v1 deploys to Cloudflare only.
- **The service calls the Cloudflare API directly**, not the `cf` CLI or Wrangler.
- **Each environment builds separately** from the same commit, with the backend the service names.
- **Apps run in the customer's own Cloudflare account, for now.**

**How it deploys (v1, proposed):**

- **Where apps run:** the customer's own Cloudflare account (decided above). The earlier design put apps in Better Apps'
  account as Workers for Platforms user Workers behind a dispatch Worker; the Previews and Rollout bullets below still
  assume that and need rework.
- **Per environment:** diff the manifest against the environment's resources and post the diff on every PR (deleting
  data is always a decision); provision D1, KV, R2 and Queues by name; render the bindings; set secrets from our vault;
  take a D1 Time Travel bookmark and apply SQL migrations; keep the Durable Object migration journal; then upload.
- **Previews** (needs rework for customer accounts): one user Worker per PR, with its own Durable Objects and resources
  per the environment's policy, removed when the PR closes.
- **Custom domains:** each customer can use their own domain, with SSL issued and renewed through Cloudflare for SaaS
  custom hostnames (not researched yet).
- **Rollout** (needs rework for customer accounts): user Workers don't support gradual deployments, so a canary is a
  second Worker and the dispatch Worker splits traffic by percentage. Rolling back points it at the previous Worker.
- **Environments** are declared in the repo in `better-apps.environments.jsonc`, which names no cloud.
- **Ours on top:** provisioning our own services per environment (managed storage, flags, env vars and secrets). This is
  what the CI/CD pipelines call.
- **To verify (spike, about a day):** the pass/fail gate in [better-apps-deploy.md](better-apps-deploy.md) §6 (its
  hosted half needs rework for customer accounts):
  - the manifest lists exactly the declarations in the server bundle;
  - `vite dev` works with no cloud config file in the project;
  - a user Worker with D1, R2, a Queue and a Durable Object deploys into a dispatch namespace;
  - queue consumers and cron triggers on user Workers;
  - Durable Object migrations, per-PR previews, canary and rollback;
  - D1 migrations through the API;
  - Start SPA mode with server functions.
- **Sources:**
  [Workers for Platforms bindings](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/configuration/bindings/),
  [Workers for Platforms limits](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/reference/limits/),
  [Encore's application model](https://encore.dev/docs/ts/concepts/application-model) (prior art for declaring resources
  in code), [Void resource inference](https://void.cloud/reference/resource-inference).

## Environments and preview environments

| Environment    | Created                    | Data                                                                       | Deploy trigger                                          | Protection                                      |
| -------------- | -------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------- |
| **Preview**    | Per PR, destroyed on close | Fresh DB per PR (D1) / branch (Neon) / preview deployment (Convex), seeded | Every push to the PR                                    | None                                            |
| **Staging**    | Long-lived                 | Seeded or anonymized copy                                                  | Merge to `main`                                         | None                                            |
| **Production** | Long-lived                 | Real                                                                       | Manual approval; rebuilt from the approved commit in v1 | GitHub Environment reviewers, prod-only secrets |

Each environment has its own Worker, database, bucket, secrets and Sentry environment, provisioned by the deploy
service.

**Build per stage in v1; promote the same build later.** Promoting one artifact from staging to production is preferred
but not required for v1. What blocks it today:

1. **Client config baked in at build time.** Vite inlines `import.meta.env.VITE_*` values (API URLs, Sentry DSN, PostHog
   key) into the browser bundle, so a staging bundle carries staging values. Fix: no environment-specific `VITE_*`
   values; serve public config at runtime (injected into the HTML during SSR, or from a config endpoint).
2. **Worker versions don't move between Workers.** Staging and production are separate Workers, and an uploaded version
   belongs to one Worker. Fix: the deploy service uploads the same prebuilt bundle to each environment's Worker through
   the Cloudflare API (to verify).

Adopt rule 1 now (runtime public config), since it's cheap and makes promotion possible later without app changes.

## Environment variables: our own vault and CLI

**Decided:** Better Apps builds its own vault on Cloudflare and its own CLI. No third-party secrets backend.

**Why Cloudflare alone isn't enough:** Cloudflare secrets are write-only (values can't be read back; verify for Secrets
Store), so they can't feed local dev, worktrees or agents. Our vault holds the readable copy; Cloudflare holds what
deployed Workers read.

### Architecture

| Piece                 | Design                                                                                                                                                                                                            |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Storage               | One Durable Object per tenant project, holding every environment's values. Each tenant is isolated, strongly consistent, and scales on its own                                                                    |
| Encryption            | Envelope encryption: a master key in Cloudflare Secrets Store wraps a key per tenant, which wraps a key per project; values are encrypted with the project key. Rotating the master key re-wraps keys, not values |
| Access                | Users sign in through the platform; the CLI gets short-lived tokens scoped to one project and environment. CI and agents use machine tokens (GitHub OIDC in Actions)                                              |
| Permissions and audit | Our permissions package decides who can read or write which environment; every read and write goes to the platform audit log (values never logged)                                                                |
| Typing                | Each app's @t3-oss/env-core schema is the contract. Bindings are typed by the capability handles, so apps never read `env`                                                                                        |
| Deployed apps         | On deploy, values are pushed to Secrets Store (secrets) and Worker `vars` (plain config) for that environment, and to GitHub Environments where pipelines need them                                               |

### Environments

| Environment | Where values live | Delivered to                                                                                                                                             |
| ----------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| development | Vault             | Injected by `env run`; nothing written to disk                                                                                                           |
| preview     | Vault             | The preview Worker environment, shared by all PR previews. Per-PR values (that PR's database URL, preview URL) are generated by the pipeline, not stored |
| staging     | Vault             | The staging Worker, pushed on merge to `main`                                                                                                            |
| production  | Vault             | The production Worker, pushed on promote after approval. Only CI and named admins can read production                                                    |

### CLI commands (sketch)

- `env run -- <cmd>`: run with development values injected (dev server, tests, agents in any worktree)
- `env check [--env <name>]`: validate against the app's schema; fails on missing or invalid values
- `env diff --env <a> --env <b>`: which keys differ between environments (names only, never values)
- `env push --env <name>`: check, then write to Secrets Store, Worker vars and GitHub Environments. Called by the deploy
  service
- `env set` / `env unset` / `env rotate`: change a value and push it to the environments that use it
- `env import`: one-time import from existing `.env` files

### To settle

- **Secrets Store layout:** one store per environment if the beta allows more than one per account; otherwise one store
  with prefixed names bound to plain names per environment.
- **Write-only behavior** of Secrets Store values (assumed above).
- **Offline dev:** whether the CLI keeps an encrypted local cache so `env run` works without network.
- **Versioning:** keep previous values per key for rollback.

## Managed storage ("our UploadThing")

**Goal:** the app developer never thinks about buckets, CORS or presigned URLs. They drop in an Uploadcn component and
files work.

**It's the storage capability:** `@better-apps/storage` is the API. Declaring a bucket with it is what makes the deploy
service set up managed storage for each environment.

- **UI:** Uploadcn components and blocks, unchanged.
- **Adapter:** `@better-apps/uploadcn-adapter` (name not settled) implements Uploadcn's adapter for our service.
- **Service:** R2 under the hood, provisioned per environment by the deploy service when a bucket is declared. Presigned
  direct uploads, a file metadata table, access rules tied to the app's users/orgs (via `AuthContext`), quotas, and
  image variants (Cloudflare Images).
- **Hooks:** optional scanning and post-processing via the chosen jobs system.
- **Exit:** files are plain R2 objects; metadata is exportable.

It doesn't remove storage; it removes storage **decisions**. The bucket is still there, owned and operated by the
platform.

## Collaboration features

**Goal:** collaboration features we own, built as Better Apps features: comments, reactions, attachments, live presence,
approval flows and the audit log. Our own tools reuse them.

- **Building blocks:** presence and live cursors, threaded comments pinned to an element or range, mentions, and
  approval flows (request → approve/reject, with status and assignee).
- **Resources:** each feature declares what it needs with the capability packages, like any other code (Deploy CLI
  above). Presence and live documents are real-time rooms (`@better-apps/realtime`; Durable Objects on Cloudflare).
  Whether `partyserver` and `y-partyserver` implement the room adapter is open. Comments and approvals are tables in the
  app's database (D1 on Cloudflare), added through Better Apps' schema layer and scoped through `AuthContext`. How a
  feature reaches the app's `main` database is open ([better-apps-deploy.md](better-apps-deploy.md) §8). kibo-ui's
  Cursor is a visual starting point; it has no networking.
- **Attachments** build on managed storage (above).
- **Notifications aren't ours:** in-app notifications go through Novu, and email through Resend.
- **Wrapped for our tools:**
  - **Preview-environment comments:** reviewers comment directly on a PR's preview deploy, and threads sync to the PR.
  - **Design review:** comments and approvals on designer frames and Storybook stories.
  - **VRT approvals:** approve or reject visual diffs in the same flow.
  - **In apps:** the same package gives any app comments and approvals on its own records.

## Feature flags with safe rollouts

**Goal:** typed flags, gradual rollouts and automatic rollback, without a separate flags vendor. A Better Apps feature,
because it needs database tables. **Not on the agenda yet.**

- **Definitions in code:** typed flags with defaults, so a flag can't be read with the wrong type or a typo.
- **Targeting:** rules on environment, user ID, org ID, role and plan (from `AuthContext`), plus percentage rollouts
  using a stable hash of user or org.
- **Rings:** groups of users or orgs that a flag reaches one after another.
- **Rollouts and rollbacks:** staged percentages (1% → 10% → 50% → 100%), a kill switch, rollback, and auto-pause when
  Sentry error rates for flagged users rise.
- **Evaluation:** in the Worker, with flag state in KV for fast reads at the edge; SSR-safe so there is no flicker.
- **Data:** the feature's tables, declared through the capability packages like any other feature's.
- **Admin:** a flags page with an audit log of who changed what.
- **Buildkit's side, later:** once this feature exists, `@buildkitgg/feature-flags-core` syncs flag data and
  `@buildkitgg/react-feature-flags` gives React hooks on top. The dev tooling is the flags and config devtool below, not
  a separate package. Whether these build on `@buildkitgg/configuration-core`, which already has provider evaluation and
  developer overrides, is open.

---

# Buildkit services

## Copywriting MCP (interface text)

**Goal:** every user-facing string follows one voice, checked by a tool rather than by memory.

- **Model:** the Fluent Agent MCP (`https://chat.fluentui.dev/mcp/server`), which the agency repo already uses. Its
  `AGENTS.md` says to validate every customer-facing string with it. Ours does the same against our own content
  guidelines instead of Microsoft's.
- **Tools it exposes:** review a string or a diff of strings (returns issues and a rewrite); write copy for a given UI
  slot (button, empty state, error, confirmation, toast, tooltip) from a short intent; look up a guideline
  (capitalization, punctuation, numbers, dates, inclusive language).
- **Grounded in:** the interface copy guide, so the MCP and the guide never disagree. Rules like "no dot glyphs as
  separators" (from agency) live there.
- **Used by:** the `copy-review` skill, `code-review`, and a PR check over changed strings (extracted from i18n message
  files).
- **Per-app voice:** a small config (brand voice, banned words, product terms) layered on the shared guidelines.

## Flags and config devtool

One typed model, one devtool, for three layers that apps usually handle three different ways. It's the only flags
devtool: it shows your feature flags and app configuration and lets you override values. Better Apps' feature flags plug
in easily, and any other configuration source can be wired in too.

| Layer           | Who sets it                    | Package                                                               |
| --------------- | ------------------------------ | --------------------------------------------------------------------- |
| **Config**      | Developers, per environment    | `@buildkitgg/react-configuration`                                     |
| **Flags**       | Ops / product, per user or org | Better Apps' feature flags, through `@buildkitgg/react-feature-flags` |
| **Preferences** | End users                      | `@buildkitgg/react-preferences`                                       |

The **devtool panel** (in dev and preview environments) lets you:

- toggle any flag and override any config value for your session
- edit preferences and reset them to defaults
- impersonate a role, org or plan to see what they'd see
- see where each value came from (default, environment, rule, override)

The same overrides are available to Playwright and Storybook, so a test or story can set "flag X on, role = admin" in
one line.

---

# Buildkit packages

| Package                                              | Design                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Async state**                                      | Loading, empty and error states as one pattern for every data view. Model it on @elsecase's AsyncState: statuses `idle · loading · refreshing · empty · success · error · offline · forbidden`; optional content per state; `onRetry` that ignores double clicks; keeps old content while refreshing; screen-reader announcements; `data-status` for styling. Ours adds a `fromQuery(query, isEmpty)` helper for TanStack Query, Suspense support, translatable copy, and shadcn Empty + Skeleton defaults                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Permissions (RBAC)**                               | No library unifies Better Auth, Clerk and WorkOS, so we build a thin one. One adapter per provider maps its session to `{ userId, orgId, roles[], permissions[] }`; permissions are named `resource:action` (Clerk and Better Auth already use this shape); `can()` on the server, `<Can>`/`useCan()` on the client. Optional CASL backing for ownership rules ("edit own posts"); a hook for WorkOS FGA or OpenFGA when per-resource checks are needed. Not a policy engine                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Endpoint mocking (`MockEndpoint`)**                | A class that wraps and orchestrates MSW so mocking an endpoint is one line, not copied boilerplate. Rebuild it from scratch: the original (`school-data-sync` in skilling-ui) is no longer available. Sketch: `const getUser = new MockEndpoint('GET', '/api/users/:id').returns(user)`; `.returns()`, `.returnsOnce()`, `.fails(status, body)`, `.delays(ms)`, `.respondWith(fn)` for dynamic responses; a built-in spy (`getUser.calls`, `.lastRequest` with parsed body, params and query; `expect(getUser).toHaveBeenCalledWith(...)`-style matchers or `.called(n)`); typed from the `src/api` request and response types; registers itself with the active MSW server or worker and resets between tests; the same endpoint objects plug into Storybook (`parameters.msw`) and Vitest (`msw/node`). Also patterns already used in `D:\msft\SkillingUI\apps\vrt-dashboard\src\tests`: shared handlers plus scenario sets (`happy`, `empty`, `error`), a `delay` option, default handlers that return 401 for third-party endpoints so nothing hits the real network, and `server.use()` overrides per test. Package shape: `defineMocks(resource, { scenarios })` typed from the `src/api` response types; one setup each for Vitest (`msw/node`), Storybook (`parameters.msw`) and the browser in dev; `onUnhandledRequest: 'error'` |
| **Theme base defaults**                              | Add to `@buildkitgg/shadcn-theme`'s base layer: `color-scheme: light dark`, `text-wrap: balance` on headings, `text-wrap: pretty` on paragraphs. App templates use Tailwind v4 (`@tailwindcss/vite`), `@import "tailwindcss"` (Preflight) and the style's `tailwind.css`; no separate reset. Precompiled `styles.css` is only for pages without Tailwind. Going Tailwind-free in apps was rejected because registry blocks must work without Buildkit wrapping them                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Copy to clipboard**                                | One `useCopy()` hook and `<CopyButton>`: copy text, rich HTML or images, with a copied/failed state that resets, a toast option, a fallback when the Clipboard API is unavailable or permission is denied, accessible announcements, and telemetry. Rebuilt by hand about ten times in the last month                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **API layer** (`defineApi` + lint rules)             | One file per resource declaring its queries and mutations over server functions, with tag-based invalidation, generating TanStack Query `queryOptions`/`mutationOptions` for components and loaders. RTK Query's structure on TanStack Query. Ships with lint rules that ban inline `useQuery`/`useMutation` query functions outside `src/api`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Lint config** (`@buildkitgg/oxlint-config`)        | Publish the repo's private `@repo/oxlint-config` (today a single `base.json`). Structure: `base` (current rules) plus one rule set per feature, each a separate export that the app's TypeScript lint config extends: the `lint` block of `vite.config.ts` under Vite+, or `oxlint.config.ts` (`.oxlintrc.json` can't extend a package) (`api-layer`: no inline `queryFn`/`fetch` in components; `i18n`: no global Lingui `i18n` or core `t` on the server (enforces the localization add-on's per-request rule); `components`: `components/ui` is re-exports only; `server`: server functions declare a schema and auth policy). Custom rules ship as Oxlint JS plugins, which are alpha and not subject to semver, so pin oxlint. Scaffolder add-ons add their rule set to `extends` when enabled                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Form fields** (`@buildkitgg/shadcn-tanstack-form`) | The TanStack Form + shadcn version of `@1js/fluentui-rhf-inputs` (`D:/msft/fluentui-rhf-inputs`: controlled Fluent inputs for React Hook Form, each inside a Fluent `Field`). Built on TanStack Form's form composition: `createFormHookContexts` + `createFormHook` registering field components, so apps write `form.AppField name="email" children={(f) => <f.TextField label="Email" />}`. Each field renders shadcn `Field`, `FieldLabel`, `FieldDescription` and `FieldError` from the locked Buildkit primitives, with ARIA wiring and Zod (Standard Schema) validation. Form-level pieces: `SubmitButton` (pending and disabled state), server-function errors mapped onto fields, a form-level error through the alerts manager, and a leave-with-unsaved-changes guard. Works inside Buildkit's typed modal forms                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Icon library per style**                           | Buildkit's style packages are built with `lucide-react`, so icons inside our components stay Lucide whatever the app picks. Extend the shadcn generator to build each style once per supported icon library (Lucide, Tabler, Hugeicons, Phosphor, Remix Icon), selected the same way as the style. Confirm shadcn's exact `iconLibrary` values against its schema                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **tablecn adapters**                                 | A TanStack Router implementation of tablecn's `UrlStateAdapter` (`read`, `write(patch)`, `subscribe`, `readServer`; about 20 lines), and a converter from its filter model (`@querycn/filter-core`) to Drizzle queries. tablecn targets TanStack Table v9                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

## Localization add-on (scaffolder)

**Decided:** no `@buildkitgg/i18n` package. Localization is Lingui only. The add-on writes its wiring into the app as
code you own (seed files in `src/i18n/` plus `scripts/i18n.ts`), and `buildkit upgrade` merges template fixes into it.
TanStack Start only in v1. Full design in [scaffolder-research.md](scaffolder-research.md) §4.7.

- **Vite (verified):** `lingui({ macroTransform: true })` in `@lingui/vite-plugin` rewrites macros natively, with no
  Babel or SWC, and works on Vite 8 with Rolldown. `@lingui/vite-plugin` 6.10.1 supports Vite `^6.3.0 || ^7 || ^8`.
  Lingui needs Node 22.19+.
- **Starting point (verified):** Lingui's official TanStack Start example (`lingui/js-lingui/examples/tanstack-start`).
  Request middleware in `src/start.ts` detects the locale and creates the instance; the router reads it with
  `getGlobalStartContext()`; a router wrapper sets `Wrap`, `dehydrate` and `hydrate` so the client builds the same
  instance. Ours adds localized URLs through the router's `rewrite` and the native `macroTransform`.
- **What the add-on writes into the app:** the locale options in one file (`src/i18n/locales.ts`), a preset Lingui
  config, the middleware and router wrapper above, and one CLI: `i18n extract` (extract with clean, then compile),
  `i18n check` (fail CI on missing translations or invalid ICU), `i18n translate` (AI translation using comments as
  context).
- **On TanStack Start and Workers:**
  - **Catalogs:** imported as modules (`import(\`./locales/${locale}.po\`)`); Vite bundles each locale as a chunk in the
    Worker. No filesystem needed.
  - **Locale detection:** request middleware checks the URL prefix, then the cookie, then `Accept-Language`, and passes
    `{ locale, i18n }` on through the middleware context.
  - **Per-request instance (critical):** never use Lingui's global `i18n` or the core `t` macro on the server; a Worker
    serves concurrent requests, so a global instance leaks locales between users. Create one with `setupI18n()` per
    request, provide it through `I18nProvider`, and use the `useLingui()` macro in components. The `i18n` rule set of
    `@buildkitgg/oxlint-config` enforces this.
  - **CSRF:** once an app has `src/start.ts`, Start stops adding its CSRF middleware, so the template adds it back
    first.
  - **URLs:** TanStack Router's `rewrite` strips and adds the locale prefix, so app links stay locale-free. On the
    server it reads the request's locale from `getGlobalStartContext()`.
  - **Document:** set `<html lang dir>` from the locale, including RTL.
  - **Formatting:** Workers ship full `Intl` data; Workers run in UTC, so date formatting needs the user's time zone.
  - **Caching:** prefer locale in the URL so caches vary by URL; cookie or header-only locales need `Vary`.
  - **SPA mode:** pages are static, so detection runs in the browser before the first render, and cookie and header
    detection are ignored with a notice.
- **Sources:** [Lingui installation](https://lingui.dev/installation),
  [`@lingui/vite-plugin` package.json](https://github.com/lingui/js-lingui/blob/main/packages/vite-plugin/package.json),
  [Lingui's TanStack Start example](https://github.com/lingui/js-lingui/tree/main/examples/tanstack-start),
  [Start middleware](https://tanstack.com/start/latest/docs/framework/react/guide/middleware).

## Scaffolder (`@buildkitgg/scaffolder`)

**Decided:**

- Extract SpawnKit's generator engine into `@buildkitgg/scaffolder`. Buildkit's app catalog and SpawnKit's game catalog
  both build on it.
- No backwards compatibility for SpawnKit: it has never been released, so it moves straight onto the engine, and its
  state formats and catalog URLs can change freely.

**What SpawnKit already has** (`D:\spawn`: `packages/templates`, `packages/cli`):

- **Catalog:** base templates plus add-ons with compatibility rules, shared by the CLI and the dashboard.
- **Planning:** `createProjectPlan(options)` returns every file the project should contain; `init --add a,b` writes it;
  `--dry-run --json` previews it.
- **Ownership record:** `.spawn/state.json` stores the options and the exact generated files.
- **Adding later (`add`):** a three-way merge between the old plan, the new plan and the current files. Untouched files
  update; JSON merges by key; files changed by both sides are reported as conflicts.
- **Safe apply:** the user approves a fingerprint of the reviewed plan; applying fails if the project changed since; a
  lock and a recovery journal guard writes; symlinked or out-of-project paths are refused.

**What moves into the engine:** planning, the ownership record, the three-way merge, fingerprinted review and safe
apply, a catalog format (templates, add-ons, compatibility, options), and CLI building blocks (`init`, `add`,
`--dry-run`, `--json`). Catalogs stay with their products.

**Framework-neutral by design:** the engine knows nothing about TanStack, React or games. An add-on declares neutral
contributions (dependencies, files, env vars, scripts, and entries for named extension points such as "vite plugin",
"root provider", "request middleware"). A **framework adapter** maps those extension points to real files: TanStack
Start's root route today, something else if the framework is swapped. Swapping frameworks means a new adapter, plus a
framework integration for each runtime package and a new template set for each add-on that writes app code (such as
localization). The add-ons' logic doesn't change.

**Templates and the wizard (owner, 2026-10-28):** a template installs its required add-ons without asking, offers its
optional add-ons, and asks slot questions such as "Add a database?", then "Which database?". The CLI wizard and its
flags are generated from the catalog, so a new add-on needs no CLI code. Design in
[scaffolder-research.md](scaffolder-research.md) §4.11.

**No hosts or cloud config:** the scaffolder never decides where an app runs. Add-ons add capability packages and write
their declarations as app code, and the Start target wires the Better Apps Vite plugin. Better Apps' deploy service does
the rest (Deploy CLI above).

**Add to the engine:**

- **Extension points:** generated files the scaffolder owns and users don't edit (for example a list of Vite plugins,
  root providers, request middleware and router wrappers), imported by the user's own `vite.config.ts` and root route.
  Adding a feature then changes only owned files, so hand-edited config doesn't cause conflicts.
- **Text-file merging:** for files that aren't JSON, a line-based three-way merge (like git's) before falling back to a
  conflict.
- **Upgrades:** re-running the plan with a newer catalog version, through the same merge, so template fixes reach
  existing apps.
- **Agent mode:** `--json` output and plan files an agent can review and approve; the `new-app` and `add-*` skills call
  the CLI instead of editing by hand.

**Entry point:** `buildkit init`. Using `vp create @buildkitgg` (Vite+) as a front door is deferred.

**Buildkit's catalog (first add-ons):** auth (one of three), database (one of three), jobs (one of three), uploads,
localization (Lingui; wiring written as app code), Storybook preset, MSW endpoint mocking, flags and config devtool,
CI/CD pipelines.

**Read so far:** `catalog`, `composition`, `extensions`, `addition`, `kits` and `index` in `packages/templates`, and
`add`, `composition`, `scaffold` and `cli` in `packages/cli`.

Engine comparison and full design: [scaffolder-research.md](scaffolder-research.md). Phase 0 plan (building the engine):
[scaffolder-phase-0.md](scaffolder-phase-0.md). Phase 1 plan (SpawnKit on the engine):
[scaffolder-phase-1.md](scaffolder-phase-1.md). Phase 2 plan (Buildkit's catalog and the `buildkit` CLI):
[scaffolder-phase-2.md](scaffolder-phase-2.md).

---

# AI guidance

## Enforcement (make the rules mechanical)

| Rule                                                  | Mechanism                                                                         |
| ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| No inline queries / raw `fetch` in components         | Lint rule (ships with `defineApi`)                                                |
| `src/components/ui/` is re-exports only               | CI check                                                                          |
| No dependencies outside the registry without approval | CI check against `stack.json`; agent hook that asks before `pnpm add`             |
| Server functions validate input and check auth        | Lint rule or wrapper (`defineServerFn` that requires a schema and an auth policy) |
| Security headers / CSP present                        | Middleware in the template + smoke test in the pipeline                           |
| Schema change has a migration                         | CI (see CI/CD pipelines above)                                                    |
| Every data component has a story per state            | Storybook coverage check                                                          |
| Docs updated with the change                          | PR template checkbox; review skill flags it                                       |
| Typecheck + lint after every agent edit               | Agent hooks                                                                       |

## Build order

1. Golden rules (`AGENTS.md`), tech stack guide, utilities and component catalogs — the agent can't reuse what it can't
   find.
2. Project structure, API layer, resilient UI and telemetry guides, with the add-feature skill tying them together.
3. Security checklist and the enforcement that backs it.
4. The rest of the build skills, then quality and process skills, as real apps need them.
