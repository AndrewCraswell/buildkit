# Maintenance

- [Package usage](README.md)
- [Migration from the standalone kit](migration.md)
- [Upstream inventory](../../packages/shadcn/shadcn-baseui-nova/upstream.json)
- [Theming and stylesheet options](theming.md)
- [Framework integration](integration.md)
- [Releases and version policy](releasing.md)

Components and styles are generated from one pinned upstream snapshot. See [style selection and generation](styles.md)
for the update commands and validation gates. All style packages expose the same API.

## Component documentation

Individual components are documented by [shadcn](https://ui.shadcn.com/docs/components). Buildkit Storybook covers style
selection and manager integrations. The private `apps/shadcn-catalog` app retains package contract tests without
duplicating upstream stories.
