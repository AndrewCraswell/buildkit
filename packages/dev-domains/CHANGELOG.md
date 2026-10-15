# Changelog

## 0.0.2

- Allow projects with different domains to share Portless without endpoint-name collisions. For example,
  `local.copacker.ai` and `local.spawnkit.cloud` now remain separate routes on one proxy.
- Preserve explicit `proxy.domains` aliases and reject occupied complete hostnames without takeover.
- Reserve an OS-assigned port through route registration, retry bounded bind failures, and clean only owned routes.
- Execute framework commands directly with argument arrays on Windows, Linux, and macOS.

Existing configuration files and public APIs remain compatible. Shared projects still need the same proxy port and TLS
mode, and custom domains must resolve locally. No DNS or provider settings are changed automatically.

## 0.0.1

Initial public release.
