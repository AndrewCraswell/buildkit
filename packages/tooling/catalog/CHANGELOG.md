# Change Log - @buildkitgg/catalog

<!-- This log was last generated on Fri, 30 Oct 2026 08:23:50 GMT and should not be manually modified. -->

<!-- Start content -->

## 0.2.1

Fri, 30 Oct 2026 08:23:50 GMT

### Patches

- Say buildkit create, not buildkit init, in the README. (ajcraswell@gmail.com)
- Bump @buildkitgg/scaffolder to v0.6.0

## 0.2.0

Thu, 29 Oct 2026 23:24:24 GMT

### Minor changes

- Apps format `package.json`, `tsconfig.json` and `buildkit.jsonc` with oxfmt like their other files, and no longer need
  `allowImportingTsExtensions`: generated files and starter configs import app modules without extensions. The
  translations check runs in CI before the build. (ajcraswell@gmail.com)
- Bump @buildkitgg/scaffolder to v0.5.0

## 0.1.0

Thu, 29 Oct 2026 17:55:35 GMT

### Minor changes

- First release: Buildkit's scaffolding catalog. A TanStack Start target with server-rendered and single-page modes, the
  `app` template, and add-ons for CI, a SQL database through Better Apps, Better Auth sign-in and Lingui localization,
  plus Better Apps deploy wiring. (ajcraswell@gmail.com)
- Bump @buildkitgg/scaffolder to v0.4.0
