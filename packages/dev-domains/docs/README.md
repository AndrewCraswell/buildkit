# Architecture and contribution guide

The [package README](../README.md) is the user-facing contract and configuration reference.

| Module              | Responsibility                                                            |
| ------------------- | ------------------------------------------------------------------------- |
| `src/config`        | Zod schema, typed `defineConfig`, bounded c12 discovery, exclusive writes |
| `src/project`       | Read-only manifest discovery and stable checkout identity                 |
| `src/domains`       | Pure template/origin resolution and directory boundaries                  |
| `src/runtime`       | Command adaptation, process lifecycle, pinned Portless bridge             |
| `src/webhooks`      | Restricted loopback gateway and independently owned tunnel                |
| `src/cli`           | Citty commands and Clack interactive presentation                         |
| `src/playwright.ts` | Structural integration without importing Playwright                       |

Dependencies point from presentation to operations to domain/configuration helpers. Keep provider SDKs out of the core.
Public exports are the config helper/types/schema and Playwright helper; runtime modules are internal. Portless owns
certificates, proxy state, routing, and upstream allocation. Buildkit does not maintain a competing proxy or port
registry. Cleanup removes only routes owned by the exact Portless child PID.

The Windows bootstrap passes user configuration through the environment because Portless 0.15.8 joins Windows child
commands through cmd.exe. Buildkit uses argument arrays and cross-spawn. Never put user values into that bootstrap
expression or add --force. Review this boundary when updating the pinned Portless dependency.

Runtime dependencies each have one job: Portless for networking, c12 for loading, Zod for contracts, Citty for command
parsing, Clack for prompts, and cross-spawn for portable execution. Node supplies HTTP, files, crypto, and terminal
colors.

## Verification

Run root `pnpm verify` for formatting, lint, types, unused code, coverage, and builds. Run
`pnpm --filter @buildkit/dev-domains test:integration` for real routing, concurrent repositories and linked worktrees,
takeover refusal, cancellation, and cleanup. These tests use isolated state, unprivileged HTTP, and no hosts/certificate
changes. They do not stop the developer's shared proxy.

Full verification runs on Linux. Focused runtime tests run on Linux, Windows, and macOS. HTTP tests do not prove OS
certificate trust or privileged port setup; those remain manual platform checks delegated to Portless.

## Boundaries

No npm publication, hosted receiver, provider credentials, DNS provisioning, or database/storage migration is performed.
Packages stay private until npm scope ownership and release automation are configured. Copacker database and storage
previews remain deferred until its Neon and Cloudflare migration.
