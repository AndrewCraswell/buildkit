# shadcn generation tooling

Private tooling for the generated Base UI style packages. Run `pnpm update:shadcn`, `pnpm generate`, and `pnpm validate`
from the repository root. See [style packaging](../../../docs/shadcn/styles.md).

The snapshot retains upstream source verbatim. The pinned `shadcn` package supplies style, icon, and direction
transforms. `ts-morph` rewrites ESM module paths, routes class merging to the shared runtime, and localizes semantic UI
labels. Unknown static labels and unsupported component shapes stop generation for review. Neutral color values and
Tailwind token mappings are derived from the same upstream revision. Buildkit does not maintain a semantic-class
mapping.

To fetch a specific revision without updating dependencies:

```sh
pnpm --filter @repo/shadcn-generator update:shadcn <full-commit-sha>
```

The consumer validation starts a temporary local npm registry serving actual packed artifacts. External dependencies
still come from npm. This exercises npm dependency aliases with pnpm's isolated linker rather than relying on workspace
hoisting. The generated browser fixtures remain under `dist/style-consumers` for inspection.
