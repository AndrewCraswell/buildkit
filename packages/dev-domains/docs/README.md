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

Port reservations are released immediately before the child starts, because framework CLIs generally accept a port
rather than an inherited socket. Other Buildkit launchers avoid registered ports; an unrelated process can still bind
during the handoff. The launcher retries at most three times, only for an explicit address-in-use failure. Hostname
conflicts never trigger a takeover.

Discovery makes one bounded walk for Storybook and Playwright configs. It skips dependencies, generated output, hidden
directories other than `.storybook`, and symlinks. It stops above 1,000 packages or 10,000 visited directories. c12
loads only the chosen local file, with rc files, implicit dotenv, package.json config, remote extensions, and
environment merging disabled. These implementation choices belong here, not in consumer setup instructions.

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

Version `0.1.0` deliberately changes inferred defaults: only `dev` is selected as the app script, and suggested E2E
endpoints do not invent framework output-directory environment variables. Saved explicit configurations stay valid. The
pre-1.0 minor version makes the discovery changes visible. Publishing is a maintainer operation; the CLI does not
publish packages, provision DNS, configure provider credentials, or create cloud resources. Hosted webhook receivers,
durable delivery, and database/storage isolation are outside the package's scope.

## Consumer-independence audit

Review scope: every production module, public export, CLI workflow, configuration default, README example, package
metadata, and contributor documentation. The baseline was the published 0.0.2 release.

| Area                         | Finding and disposition                                                                                                                                                                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App detection                | Removed preference for repository-specific `dev:app` and `dev:raw` names. `dev` is a documented convention, not a required universal standard. Any script can be selected explicitly.                                                                                                       |
| E2E output                   | Removed automatically injected `DEV_DOMAINS_OUTPUT_DIR`: the package does not configure any framework to read it. Output and resource isolation belong to the application.                                                                                                                  |
| Wizard E2E command           | Fixed the assumption that a manually configured server has a `dev` script. A suggested test endpoint preserves the actual server command.                                                                                                                                                   |
| Examples and fixtures        | Replaced real consumer domains with neutral example/test domains. The root README no longer describes its private template provenance.                                                                                                                                                      |
| Consumer documentation       | Moved route registration, reservation handoff, retry counts, discovery walk limits, and configuration-loader internals here. Kept observable constraints and supported configuration in the README.                                                                                         |
| CLI guidance                 | Setup completion now prints the public npm invocation instead of assuming the binary is globally available.                                                                                                                                                                                 |
| Providers                    | No application-specific auth provider, OAuth client, cloud account, storage, database, deployment, or DNS provisioning is implemented. `auth` describes paths; tunnel commands are supplied by users. Cloudflared is an optional example, not a dependency or default.                      |
| Frameworks                   | Next.js, Vite, and Storybook have explicit adapters. Other servers must accept the assigned port/host through environment variables or configured arguments. Framework-specific allowed hosts and caches remain application settings.                                                       |
| Playwright                   | Detection is evidence that tests exist, not knowledge of their server topology. Suggested E2E endpoints reuse the package's dev server; no Playwright config is executed or its `webServer` imported. Cross-package, production-build, and remote test targets need explicit configuration. |
| Monorepos                    | Workspace declarations control discovery; no `apps/` or `packages/` folder layout is hard-coded. Without workspace declarations, discovery searches nested packages; use explicit configuration to exclude unrelated projects.                                                              |
| Project root                 | Git checkout boundaries and the selected non-Git directory are deliberate discovery rules. Nested standalone applications can use their own config. Saved endpoint directories must remain within the config root.                                                                          |
| Package managers             | npm, pnpm, Yarn, and Bun use package-manager-detector. Zero-config and the wizard detect the manager. A manually authored config currently defaults to npm when omitted; other managers must be explicit. This is a documented API limitation, not provider coupling.                       |
| Naming                       | Project/service/worktree templates are configurable. `.localhost`, HTTPS, and port 443 are defaults, not real consumer domains. The 32-character discovered-label cap and normalization can produce collisions; the README documents overrides and collision errors.                        |
| Process and network defaults | IPv4 loopback, one server per invocation, shared proxy settings, normal-exit cleanup, and inherited environment are supported runtime boundaries. No fixed application port or preferred checkout name is used.                                                                             |
| Webhooks                     | POST-only exact paths, 1 MiB requests, and a 15-second upstream timeout are current capability limits. GET verification, custom limits, hosted reception, delivery persistence, and replay are not implemented. Do not describe this as a general hosted webhook service.                   |
| Wizard scope                 | The wizard selects detected endpoints and adds callbacks, test servers, and tunnels. Arbitrary extra API/worker/other service endpoints can be configured manually; a broader preset checklist is not implemented.                                                                          |
| Technical prerequisites      | Node 24+, Windows OpenSSL, certificate trust, and framework/tunnel installations are actual prerequisites and remain in consumer documentation. Repository tools and contributor architecture stay in engineering docs.                                                                     |

Regression tests cover conventional and nonconventional scripts, declared and nonstandard workspace layouts, custom
commands, optional test-server suggestions, and independent domains. Do not add prose assertion tests for this audit.
