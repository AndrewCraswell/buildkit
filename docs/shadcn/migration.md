# Migrate from the standalone kit

The standalone `@buildkitgg/shadcn-baseui-kit` distribution is retired. Existing published versions remain available.
New component updates are released in the named style packages.

## Select a style

Replace the existing dependency with an alias, using Nova to retain the previous style family:

```sh
pnpm add @buildkitgg/shadcn-baseui-kit@npm:@buildkitgg/shadcn-baseui-nova
```

Choose another named style if desired. Keep existing component and stylesheet imports unchanged. Install this dependency
in each consuming application, including apps that previously obtained the kit transitively through the modal manager.

## Upgrade the modal manager

```sh
pnpm add @buildkitgg/shadcn-modals-manager
```

The manager now requires the application's aliased kit as a peer dependency. This installation change is breaking and is
released as a minor version while the manager is below 1.0. The React and modal APIs remain unchanged. The alert manager
remains private and is not part of this release.

## Verify the application

Run your application's type check and production build, then check composed components and CSS overrides. The catalog is
regenerated from current upstream source: choosing Nova preserves the style family, not an exact visual snapshot of the
retired distribution. Custom selectors depending on internal markup or classes may need adjustment.

Import one kit stylesheet at the app entry. Use `styles-no-reset.css` when the application already supplies its own
reset. Design tools can resolve the installed alias's `tokens.json` export; values describe package defaults, not
application CSS overrides.

No registry connection, component-source edits, or renderer adapters are required for this migration.
