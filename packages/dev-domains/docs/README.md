# Architecture and contribution guide

The [package README](../README.md) is the user-facing contract and configuration reference.

For package consumers, start with:

- [Motivation and philosophy](../README.md#motivation-and-philosophy)
- [Installation and first run](../README.md#installation)
- [Zero-configuration behavior](../README.md#zero-configuration-behavior)
- [Domain naming and normalization](../README.md#domain-naming)
- [Configuration schema](../README.md#configuration-schema)
- [Commands and troubleshooting](../README.md#command-reference)

| Module              | Responsibility                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------- |
| `src/config`        | Zod schema, typed `defineConfig`, bounded c12 discovery, exclusive writes                 |
| `src/project`       | Shared tool-config discovery, manifests, package-manager detection, and checkout identity |
| `src/domains`       | Pure template/origin resolution and directory boundaries                                  |
| `src/runtime`       | Command adaptation, process lifecycle, pinned Portless bridge                             |
| `src/webhooks`      | Restricted loopback gateway and independently owned tunnel                                |
| `src/cli`           | Citty commands and Clack interactive presentation                                         |
| `src/playwright.ts` | Structural integration without importing Playwright                                       |
| `src/node.ts`       | Read resolved endpoint addresses from Node.js tooling without starting servers            |

Dependencies point from presentation to operations to domain/configuration helpers. Keep provider SDKs out of the core.
Public exports are the config helper/types/schema, Node endpoint helper, and Playwright helper; runtime modules are
internal. Portless owns certificates, proxy state, and the locked route registry. Buildkit registers complete hostnames
through Portless's public `RouteStore`, reserves OS-assigned ports until registration, and starts framework commands
with argument arrays through cross-spawn. There is no competing proxy or persistent port registry.

The CLI process owns its exact registered hostnames. Normal exit, startup failure, and cancellation remove only those
routes with an owner-PID check. The process runner owns and terminates its child process tree. A hard OS kill can leave
an orphaned server; Portless prunes the dead owner's routes, but an orphan may need manual termination. Buildkit never
stops the shared proxy or forces a route takeover. Keep Portless pinned and test its registry and proxy interfaces
before upgrading it.

The proxy adapter validates the live proxy's port, TLS mode, and response identity. HTTPS probes verify its certificate
using Portless's local CA. Startup suffixes do not restrict exact routing or per-hostname SNI certificates.

Runtime dependencies each have one job: Portless for networking, c12 for loading, Zod for contracts, Citty for command
parsing, Clack for prompts, package-manager-detector for package-manager discovery and script commands, and cross-spawn
for portable execution. Node supplies HTTP, files, crypto, and terminal colors.

## Verification

Run root `pnpm verify` for formatting, lint, types, unused code, coverage, and builds. Run
`pnpm --filter @buildkitgg/dev-domains test:integration` for real routing, concurrent repositories and linked worktrees,
takeover refusal, cancellation, and cleanup. These tests use isolated state, unprivileged HTTP, and no hosts/certificate
changes. They do not stop the developer's shared proxy.

Full verification runs on Linux. Focused runtime tests run on Linux, Windows, and macOS. HTTP tests do not prove OS
certificate trust or privileged port setup; those remain manual platform checks delegated to Portless.

## Boundaries

Version `0.0.2` is a compatible patch: canonical domains and explicit alias lists are preserved, while projects no
longer need matching proxy suffix lists. Publishing is a maintainer operation; the CLI does not publish packages,
provision DNS, configure provider credentials, or create cloud resources. Hosted webhook receivers, durable delivery,
and database/storage isolation are outside the package's scope.
