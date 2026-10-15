# Changelog

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
- Reserve an OS-assigned port through route registration, retry bounded bind failures, and clean only owned routes.
- Execute framework commands directly with argument arrays on Windows, Linux, and macOS.

Existing configuration files and public APIs remain compatible. Shared projects still need the same proxy port and TLS
mode, and custom domains must resolve locally. No DNS or provider settings are changed automatically.

## 0.0.1

Initial public release.
