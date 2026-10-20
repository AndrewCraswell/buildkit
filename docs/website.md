# Buildkit.gg website

The static landing page lives in `apps/site`. VitePress renders guides and API reference at `/docs/`; Storybook is
deployed at `/storybook/`. The landing page shares its package catalog with Storybook. API Extractor discovers typed
exports; API Documenter renders their signatures and source comments. VitePress renders the generated Markdown.

## Local development

Run `pnpm --filter @buildkitgg/site dev` and `pnpm --filter @buildkitgg/behavior-storybook storybook` in separate
terminals. For reference docs, run `pnpm check:api`, `pnpm --filter @buildkitgg/docs generate`, then
`pnpm --filter @buildkitgg/docs dev`. The landing page links to these local servers during development.

## GitHub Pages

The `Publish Buildkit website` workflow verifies the repository, builds the website, reference docs, and Storybook,
uploads one artifact, and deploys from `main` using the `github-pages` environment. It uses GitHub's Pages OIDC
deployment, without a personal access token. CI and package publishing also run API checks through `pnpm verify`.

Before the first deployment, select **GitHub Actions** as the repository's Pages source. Configure **buildkit.gg** as
the custom domain in Pages settings, verify domain ownership, and apply the DNS records described in
[GitHub's custom-domain instructions](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).
Enable HTTPS once GitHub has issued the certificate. Custom-workflow deployments use the repository's domain setting; a
checked-in CNAME file does not configure it.

The workflow reads the configured Pages base path, so assets and Storybook links also work at the default `/buildkit/`
project URL. Canonical and social URLs target buildkit.gg. No DNS changes or live deployment are performed by a local
build.

## Documentation boundaries

Public API signatures and doc comments are extracted from compiled declarations. These models can feed a reference
renderer without maintaining signature lists by hand. Package guides are generated from package READMEs. Reference pages
and their search index are generated during the build and ignored by Git. Usage guides and examples still need authored
explanations. CLI commands must be documented from command metadata or `--help`, rather than inferred from TypeScript
exports. Storybook's dev-domains section explains the CLI and Node integration; it does not execute terminal commands in
a page.

The reference site groups router-core, react-routing, React Router, and TanStack Router under **Routing**. Each
integration keeps its guide and API reference together. The generated dev-domains CLI reference belongs to the
dev-domains package navigation. See the [reference site development guide](../apps/docs/README.md) for the shared
navigation definition.

## Domain and visual identity

GitHub Pages is the host. Cloudflare will manage DNS for the purchased `buildkit.gg` domain once the Pages deployment
exists. Configure the custom domain in GitHub, then point the apex and `www` records at GitHub Pages using Cloudflare.
Keep records DNS-only during GitHub domain and certificate verification, then verify HTTPS and the canonical redirect.
Use the Cloudflare `cf` CLI for configuration in this repository. A local build does not change DNS.

The marketing app uses shadcn Vega components with a blue theme; the reference site uses matching blue accents. The
marketing page is prerendered to static HTML and includes a live, isolated example of the Buildkit theme packages.
