# Maintenance

- [Usage](../README.md)
- [Architecture and extraction plan](../../../docs/behavior-packages.md)

Build with pnpm --filter @buildkitgg/theme-core build. Run focused tests and pnpm verify after coherent changes. Keep
stable snapshots, disposal, and server isolation covered. Pack compiled exports and declarations only. See
[release workflow](../../../docs/releases.md).
