# Change Log - @buildkitgg/dev-domains

<!-- This log was last generated on Thu, 22 Oct 2026 20:48:42 GMT and should not be manually modified. -->

<!-- Start content -->

## 0.1.1

Thu, 22 Oct 2026 20:48:42 GMT

### Patches

- Refresh dependencies and verify compatibility with React 19.3 and Vitest 5. (ajcraswell@gmail.com)
- Update repository metadata for packages grouped by core, React, UI integrations, and tooling. (ajcraswell@gmail.com)

## 0.1.0

### Changed defaults

- App discovery uses the package's `dev` script. Other script names remain supported through explicit `script`
  configuration, but are no longer automatically preferred or selected.
- Suggested E2E endpoints no longer set `DEV_DOMAINS_OUTPUT_DIR`. Configure framework output and cache isolation in the
  application. Existing explicit `env` values remain supported.

### Fixes

- A dedicated test endpoint added in the wizard keeps the selected app command, including custom servers without a `dev`
  script.
- Installation, examples, and setup guidance use public commands and neutral project names. Contributor documentation
  holds runtime implementation details.

Existing saved configurations remain valid. This pre-1.0 minor release makes the discovery changes explicit; projects
that relied on the previous inferred values should save their intended scripts and environment settings in a config.

## 0.0.2

- Allow projects with different domains to share Portless without endpoint-name collisions. For example,
  `local.example.com` and `local.example.org` now remain separate routes on one proxy.
- Preserve explicit `proxy.domains` aliases and reject occupied complete hostnames without takeover.
- Assign backend ports automatically and leave other projects running when a server stops.
- Run server commands consistently on Windows, Linux, and macOS.

Existing configuration files and public APIs remain compatible. Shared projects still need the same proxy port and TLS
mode, and custom domains must resolve locally. No DNS or provider settings are changed automatically.

## 0.0.1

Initial public release.
