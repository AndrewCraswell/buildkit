# @buildkit/dev-domains

Stable local domains for every app and checkout, built on [Portless](https://github.com/vercel-labs/portless).
Interactive setup, zero-config discovery, typed configuration, Storybook, Playwright, auth callback URLs, and optional
webhook tunnels.

Requires Node 24+. Windows, macOS, and Linux are supported. This package is not yet published to npm. Build it with
`pnpm --filter @buildkit/dev-domains build` in this repository; the CLI is `node packages/dev-domains/dist/cli/main.js`.
Use `pnpm --filter @buildkit/dev-domains pack` to install a local tarball in another project. Commands below assume the
package is installed and `dev-domains` is on PATH (for example, through `pnpm exec`).

## Zero configuration

Run `dev-domains` in your project. A single detected server starts immediately; multiple servers produce a picker.
Noninteractive sessions must specify an endpoint when there is more than one. Run `dev-domains detect` to see candidates
or `dev-domains urls` to see exact URLs without starting servers or creating files.

| Convention                | Default                                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Project root              | Current Git checkout root; current directory outside Git                                                                 |
| Project name              | Root package name, otherwise directory name, normalized to a DNS label                                                   |
| Package manager           | Root `packageManager`, then pnpm/yarn/bun lockfile, otherwise npm                                                        |
| App scripts               | `dev:app` or `dev:raw` before `dev`                                                                                      |
| Storybook                 | Scripts containing `storybook dev`                                                                                       |
| Workspace discovery       | Declared pnpm/npm/yarn workspaces; otherwise root plus apps/_ and packages/_; excludes dependencies and generated output |
| Root app                  | `https://<project>-<checkout>.localhost`                                                                                 |
| Workspace app             | `https://<project>-<checkout>-<package>-app.localhost`                                                                   |
| Storybook                 | `https://<project>-<checkout>-<package>-stories.localhost` (no package segment at root)                                  |
| Main checkout             | `main`                                                                                                                   |
| Linked checkout           | Readable checkout directory plus a short hash of its canonical path                                                      |
| Proxy                     | Shared Portless HTTPS proxy on port 443; upstream ports assigned dynamically                                             |
| Auth, E2E, public tunnels | Opt-in; no paths, public exposure, or test isolation guessed                                                             |

Branch changes do not change the checkout URL. Moving a checkout does. Windows drive paths normalize case and
separators; POSIX paths remain case-sensitive. Two independent clones with the same project name both use `main`: rename
a project or endpoint if they must run concurrently. Name conflicts fail rather than replacing another server.

Scripts wrapping `dev-domains`, `portless`, Turbo, or detected aggregate runners are skipped. Simple Next.js, Vite, and
Storybook commands receive explicit loopback and assigned-port flags; Vite and Storybook use the exact port. Other
commands must honor `PORT` or use `{port}` in an explicit command array. Compound scripts are treated as custom
commands. Review detection before relying on it: discovery never executes scripts or edits manifests.

Portless may need administrator access to bind port 443, trust local certificates, and synchronize hosts. Run
`dev-domains setup` interactively once. `dev-domains doctor` reports DNS and trust problems. Local domains do not become
public merely by using this CLI. On Windows, Portless also requires OpenSSL on PATH.

## Guided setup

```sh
dev-domains init
dev-domains init --yes --project shop --domain local.example.com
dev-domains init --yes --dry-run
```

Setup follows Spawn's compact guided flow with a blue Buildkit accent. Select servers, rename domain templates, choose
callback paths, add a test server or webhook tunnel, review domains, and save `dev-domains.json`. Existing files are
never overwritten. Cancellation writes nothing. `NO_COLOR` and noninteractive terminals are supported.

## Typed configuration

```ts
// dev-domains.config.ts
import { defineConfig } from "@buildkit/dev-domains"

export default defineConfig({
  project: "shop",
  domain: "local.example.com",
  packageManager: "pnpm",
  endpoints: {
    app: {
      cwd: "apps/web",
      script: "dev:raw",
      framework: "next",
      name: "{worktree}",
      env: { APP_URL: "{origin}", AUTH_REDIRECT_URI: "{origin}/callback" },
      auth: ["/callback"]
    },
    stories: {
      kind: "storybook",
      cwd: "apps/web",
      script: "storybook",
      framework: "storybook",
      name: "{worktree}-stories"
    }
  }
})
```

`defineConfig` supplies TypeScript checking and runtime validation. JSON receives identical runtime validation. Generate
editor metadata with `dev-domains schema > dev-domains.schema.json` and reference it using `$schema` in JSON.

Configuration is loaded by **c12**. Discovery walks from `--cwd` to the checkout boundary and stops at the nearest
config. Supported names: `dev-domains.config.ts`, `.mts`, `.js`, `.mjs`, `.json`, or `dev-domains.json`. Multiple files
in one directory are an error. `--config` selects a file relative to `--cwd`. Endpoint directories are relative to the
config and must stay inside its root, including resolved symlinks.

Precedence is **explicit config file → nearest config → detected defaults**. Explicit configurations are complete:
detected endpoints are not silently merged in. There is no home config, implicit `.env` loading, package.json config,
remote extension downloading, or environment-specific override merging. JavaScript/TypeScript config is executable code;
use only trusted repositories. `detect` reads manifests without loading executable config.

## Configuration reference

| Field                | Meaning                                                                               |
| -------------------- | ------------------------------------------------------------------------------------- |
| `project`            | Required lowercase DNS label                                                          |
| `domain`             | Local suffix; `localhost` by default                                                  |
| `packageManager`     | `npm`, `pnpm`, `yarn`, or `bun`; default `npm` in explicit config                     |
| `proxy`              | `port` (443), `https` (true), `syncHosts` (true), optional shared `domains` list      |
| `endpoints`          | Nonempty map of DNS-label keys                                                        |
| `endpoint.kind`      | `app`, `storybook`, or `e2e`; default `app`                                           |
| `endpoint.cwd`       | Directory relative to config; default `.`                                             |
| `endpoint.name`      | DNS label template; explicit-config default `{project}-{worktree}-{service}`          |
| `endpoint.script`    | Package script name, mutually exclusive with `command`                                |
| `endpoint.command`   | Executable and argument array; never a shell command string                           |
| `endpoint.framework` | `next`, `vite`, `storybook`, or `custom`; explicit-config default `custom`            |
| `endpoint.env`       | Child environment variables with templates; secrets should remain in your environment |
| `endpoint.auth`      | Callback path list for `urls`; does not configure an auth provider                    |
| `endpoint.tunnel`    | Command array, exact allowed POST `paths`, optional stable HTTPS `publicUrl`          |

Templates: `{project}`, `{worktree}`, `{service}`, `{root}`, `{hostname}`, `{origin}`; commands and environment also
accept `{port}`. Names use only the first four. Tunnel commands use `{url}` for the local gateway. Unknown variables
fail. Resolved names must be a single DNS label. Names longer than 63 characters receive a stable truncated prefix and
hash.

Servers receive `PORT`, `HOST=127.0.0.1`, `DEV_DOMAINS_ORIGIN`, `DEV_DOMAINS_HOSTNAME`, and `DEV_DOMAINS_WORKTREE`.
`PORT`, `HOST`, `PORTLESS*`, and `BUILDKIT_*` are reserved in `endpoint.env`. Frameworks retain responsibility for their
allowed-host and development-origin configuration. Add local hosts to Next.js `allowedDevOrigins`, for example.

## Several projects and custom domains

Prefer unique project-prefixed names when sharing a machine. Portless can serve several suffixes from one proxy, but
registers every app name under each configured suffix. Configure the same ordered `proxy.domains` list in participating
projects and include each project's `domain`. Project origins may use any suffix in that list.

An existing proxy is never forcibly restarted or taken over. Coordinate proxy configuration changes with other users and
agents first. The runner rejects incompatible port/TLS/domain settings. For custom domains, use Portless's hosts sync or
arrange DNS to resolve to loopback and set `syncHosts: false`. This package does not provision DNS records.

Portless 0.15.8 is pinned. It probes free ports; a probe is not an atomic reservation. Buildkit retries at most three
runs only after an explicit `EADDRINUSE`/address-in-use failure. Custom servers must fail on conflicts rather than
silently use another port. Commands may restart, so keep startup idempotent. Route conflicts never use `--force`.

## Playwright

Configure a separate `kind: 'e2e'` endpoint. Its script must launch a server, not `playwright test`.

```ts
import { defineConfig } from "@playwright/test"
import { playwrightServer } from "@buildkit/dev-domains/playwright"

export default defineConfig({
  ...(await playwrightServer("app-e2e")),
  testDir: "./tests"
})
```

The helper sets `baseURL`, starts the named server, and refuses reuse of an existing server. Separate domains/ports do
not separate build output, databases, storage, or credentials. Setup adds `DEV_DOMAINS_OUTPUT_DIR` for E2E; configure
your framework to consume it (for Next.js, `distDir: process.env.DEV_DOMAINS_OUTPUT_DIR || '.next'`). In CI, use an
isolated Portless state directory and unprivileged HTTP proxy, or your existing loopback Playwright server
configuration. Trusted HTTPS and certificate setup remain Portless responsibilities.

## Webhooks

```ts
tunnel: {
  command: ['cloudflared', 'tunnel', '--url', '{url}'],
  paths: ['/api/webhooks/payments'],
  // publicUrl: 'https://hooks.example.com', // separately configured stable tunnel
}
```

Start the app, then run `dev-domains tunnel app` in another terminal. The gateway binds an OS-assigned loopback port and
keeps the socket open. Only POST requests matching exact configured paths reach the app; query strings are preserved.
Raw bytes and signature headers are preserved, hop-by-hop headers are stripped, and payloads are not logged or stored.
Bodies are limited to 1 MiB and target requests to 15 seconds. The app must validate provider signatures. Closing the
command terminates its tunnel tree and gateway; the app and shared proxy continue running.

Install and authenticate your tunnel executable separately. Quick tunnels change URL on restart; stable provider
registrations need a stable tunnel configured with that provider. `publicUrl` describes it and does not create it. Do
not put credentials in commands or config. A hosted durable receiver, replay, storage, and provider-specific auth/API
setup remain outside this release.

## Commands

| Command                        | Purpose                                                      |
| ------------------------------ | ------------------------------------------------------------ |
| `dev-domains [run] [endpoint]` | Run one server; pick if ambiguous in a terminal              |
| `init [--yes] [--dry-run]`     | Detect, configure, and save defaults                         |
| `detect`                       | JSON defaults without loading executable config              |
| `urls`                         | JSON origins, auth callbacks, and configured webhook origins |
| `setup`                        | Start Portless with project settings                         |
| `status`                       | List active routes                                           |
| `doctor`                       | Diagnose proxy, DNS, and trust                               |
| `tunnel [endpoint]`            | Explicit public webhook exposure                             |
| `schema`                       | Print configuration JSON Schema                              |

Project commands accept `--cwd`; runtime commands also accept `--config`. Use `--help` for flags. No package scripts are
rewritten. Exit codes propagate; Ctrl+C stops owned processes and removes owned routes. The shared proxy stays
available. After a hard crash, Portless handles stale routes on restart.

## Contributing

See [architecture and tests](docs/README.md) and the root [contributor guide](../../CONTRIBUTING.md). MIT licensed.
Buildkit's domain is **buildkit.gg**; projects do not depend on a Buildkit hosted service.
