# Releases

Beachball manages independent package versions and changelogs. Run `pnpm change` with public package changes and commit
the generated change file. Pull request CI checks release notes and runs `pnpm verify`.

## Prepare and publish

1. Run **Prepare release** from GitHub Actions on `main`. It bumps versions, updates changelogs and the lockfile,
   verifies the repository, and opens a release pull request. Git hooks run normally. Review and merge that PR. GitHub
   suppresses PR workflow triggers for the built-in workflow token, so preparation runs verification itself; CI runs
   again on the merge to `main`.
2. Wait for main CI to pass. Run **Publish packages** on `main`. Keep **dry_run** enabled to preview. Select `*` for all
   public Buildkit packages, or an unscoped package name such as `fluentui-theme` to include that package and its
   dependencies. Pending Beachball change files must be consumed by a merged release PR before publication.
3. Run again with **dry_run** disabled. The workflow verifies and previews before requesting approval of the `npm`
   environment deployment. Approve the exact commit and selection you reviewed.
4. pnpm publishes in dependency order, resolves workspace ranges, attaches provenance, and waits for each version to
   become installable before publishing dependents. The workflow saves its publication report even after a partial
   failure.

Only public `@buildkitgg/*` packages can publish. Private packages remain incubating. Publishing is manual and does not
change versions. Recursive publishing skips existing versions, so a partial release can be retried at the same commit.
Check the report and registry after an interrupted run. Never bump versions just to retry a failed upload. Release
branches can be deleted after merging. The workflow rejects stale commits if main advances before publishing.

## npm setup

Configure each existing npm package's trusted publisher with owner `AndrewCraswell`, repository `buildkit`, workflow
`publish.yml`, and environment `npm`. No npm token is stored in GitHub. The workflow uses GitHub's OIDC identity.

New packages require an initial authenticated publication before npm allows trusted-publisher configuration. Review the
API and packed consumer first, remove `private` in a reviewed change, and perform that initial release using npm's
interactive authentication. Then configure its trusted publisher and complete a CI publication within npm's activation
window. Do not remove `private` merely to test the workflow. See the
[npm trust command](https://docs.npmjs.com/cli/v11/commands/npm-trust/) for authenticated setup.

Beachball handles versioning in the release PR; pnpm handles registry uploads. Beachball's automatic Git push is not
used because it bypasses Git hooks. Both release workflows preserve normal repository checks. Release jobs use fresh
installs without dependency caches.

The `npm` GitHub environment restricts deployments to `main` and requires maintainer approval. Repository Actions
settings allow the preparation workflow to open pull requests; its token has write permissions only in that workflow.

See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) for account setup and troubleshooting.
