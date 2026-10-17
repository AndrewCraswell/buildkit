# Buildkit Storybook

Run `pnpm --filter @buildkitgg/behavior-storybook storybook` after building the libraries, then open
http://127.0.0.1:6009/.

Getting started introduces the package directory and architecture. Core, React, Themes, and Components contain package
overviews and focused examples. Preferences have their own playground. All 64 component examples reuse the existing
shadcn-baseui-kit catalog, grouped by function. The package-local workshop remains available on port 6008.

Maintain package guides in src/documentation and example wrappers in src/components. Keep release status accurate,
examples focused, and persistent demo keys separate. Document resets and lifecycle ownership. Never represent
unpublished packages as available npm releases.
