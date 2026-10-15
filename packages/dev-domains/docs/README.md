# Development domains

## Configuration and CLI

The brand is Buildkit (`buildkit.gg`); consuming apps use their own domains. Interactive setup should discover workspace
apps and npm scripts, suggest dev server, Storybook, Playwright, auth, and webhook capabilities, then let users select
and rename them. Save explicit commands, working directories, domains, and capability settings in versioned
configuration. Show changes before writing; support noninteractive use for agents and CI. Avoid recursive script
wrappers. Stay close to Portless command semantics. Auth callbacks usually share the app endpoint.

## Domain patterns

| Endpoint   | Example                                         | Purpose               |
| ---------- | ----------------------------------------------- | --------------------- |
| App        | `<checkout>.local.example.com`                  | Local app             |
| Storybook  | `<checkout>-stories.local.example.com`          | Component workshop    |
| Playwright | `<checkout>-e2e.local.example.com`              | Dedicated test server |
| Auth       | App origin plus explicit callback path          | Authentication return |
| Webhooks   | Owned public tunnel hostname plus allowed paths | External delivery     |

Examples are configurable conventions, not provisioned DNS. Checkout identity must remain stable across branch changes
and include repository and service identity where necessary.

## Ports and ownership

Let Portless own proxy routing and upstream port allocation. A free-port probe alone does not reserve a port: another
process can bind before the child starts. Verify the pinned Portless version’s behavior; handle bind races with bounded
retries and require applications to respect assigned ports. Never stop another checkout’s server or steal an existing
route. Validate simultaneous repositories, services, and worktrees through one local HTTPS proxy. Spike custom domains
and native worktree naming before promising support. Track only owned processes and safely clean stale registrations.
Playwright needs its own route and build output; CI may use loopback. Domain isolation does not isolate databases.

## Webhooks

Include an optional public tunnel with an explicit local target and allowed paths. Keep credentials out of Git. Preserve
raw bodies and signature headers; apps remain responsible for signature verification. Display exposure and lifecycle
clearly.

A hosted receiver is a later optional service: authenticated forwarding, durable buffering, bounded retries, replay,
retention limits, and payload privacy need design before deployment.

## Delivery sequence

1. Monorepo foundation (implemented).
2. Config schema, detection, interactive setup, and noninteractive commands.
3. Portless lifecycle adapter and dev server, Storybook, Playwright, and auth endpoints.
4. Optional tunnel integration and cleanup.
5. Acceptance in two independent monorepos with concurrent worktrees, restart, collisions, and cleanup.
6. Confirm npm scope ownership, consumer validation, and release setup.
7. Optional hosted webhook receiver.

Provider-specific auth/API configuration remains deferred so apps choose their own services. Database and storage
provisioning are out of scope; Copacker previews defer those until Neon and Cloudflare migration. This package does not
perform that migration.
