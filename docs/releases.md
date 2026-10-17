# Releases

Beachball manages independent package versions and changelogs. Run `pnpm change` with public package changes and commit
the generated change file. Pull request CI checks release notes and runs `pnpm verify`.

## Prepare and publish

1. Run **Prepare release** from GitHub Actions on `main`. It bumps versions, updates changelogs and the lockfile,
   verifies the repository, and opens a release pull request. Git hooks run normally. Review and merge that PR. GitHub
   suppresses PR workflow triggers for the built-in workflow token, so preparation runs verification itself; CI runs
   again on the merge to `main`.
2. Wait for main CI to pass. Run **Publish package** on `main`, entering the package directory, such as
   `shadcn-baseui-kit`. Review the selected commit and approve the `npm` environment deployment.
3. The workflow verifies, packs with pnpm (resolving workspace dependencies), saves the tarball as a workflow artifact,
   and publishes that exact archive with npm provenance. Publish dependencies before their adapters.

Only public `@buildkitgg/*` packages can publish. Private packages remain incubating. Publishing is manual and does not
change versions. An already-published version is rejected by npm; inspect the registry after an interrupted run before
retrying. Never bump versions just to retry a failed upload. Release branches can be deleted after merging.

## npm setup

Configure each existing npm package's trusted publisher with owner `AndrewCraswell`, repository `buildkit`, workflow
`publish.yml`, and environment `npm`. No npm token is stored in GitHub. The workflow uses GitHub's OIDC identity.

New packages require an initial authenticated publication before npm allows trusted-publisher configuration. Review the
API and packed consumer first, remove `private` in a reviewed change, and perform that initial release using npm's
interactive authentication. Then configure its trusted publisher. Do not remove `private` merely to test the workflow.

The `npm` GitHub environment restricts deployments to `main` and requires maintainer approval. Repository Actions
settings allow the preparation workflow to open pull requests; its token has write permissions only in that workflow.

See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) for account setup and troubleshooting.
