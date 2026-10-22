# Change Log - @buildkitgg/shadcn-modals-manager

<!-- This log was last generated on Thu, 22 Oct 2026 20:48:35 GMT and should not be manually modified. -->

<!-- Start content -->

## 0.2.0

Thu, 22 Oct 2026 20:48:35 GMT

### Minor changes

- Use the application-selected component kit as a required peer dependency so managers inherit the installed style.
  BREAKING: apps must explicitly install a named style through the kit dependency alias; the kit is no longer a
  transitive dependency. See docs/shadcn/migration.md. (41898282+github-actions[bot]@users.noreply.github.com)
- Bump @buildkitgg/react-modals to v0.1.1
- Bump @buildkitgg/fluentui-modals-manager to v0.1.1

### Patches

- Refresh dependencies and verify compatibility with React 19.3 and Vitest 5. (ajcraswell@gmail.com)
- Update repository metadata for packages grouped by core, React, UI integrations, and tooling. (ajcraswell@gmail.com)

## 0.1.0

Sat, 17 Oct 2026 21:18:16 GMT

### Minor changes

- Introduce typed modal management with guarded dismissal, async forms, and interchangeable UI adapters.
  (ajcraswell@gmail.com)
- Bump @buildkitgg/react-modals to v0.1.0
- Bump @buildkitgg/fluentui-modals-manager to v0.1.0
