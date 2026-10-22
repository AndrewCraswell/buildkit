# Releases

Beachball manages independent package versions and changelogs. Run `pnpm change` with public package changes and commit
the generated change file. Pull request CI checks release notes and runs `pnpm verify`.

## Prepare and publish

1. Merge a package change with its Beachball change file. After main CI succeeds, **Release changed packages** starts
   **Prepare release** automatically. Beachball bumps versions, updates changelogs and the lockfile, verifies the
   repository, and opens a release pull request. Git hooks run normally.
2. The pipeline starts release PR CI and automatically squash-merges its non-draft release PR after required checks
   pass. Branch protections still apply. The weekly shadcn pipeline follows the same flow. Ordinary and Dependabot PRs
   are not automatically merged. After a bot merge, the pipeline explicitly starts main CI and website deployment. For
   bot-created PRs, dispatched CI results are reported as required commit statuses linked to the successful jobs.
3. After main CI succeeds for the prepared versions, the pipeline starts **Publish packages**. It verifies and previews
   the packages, then publishes automatically. There is no manual approval gate.
4. pnpm publishes in dependency order, resolves workspace ranges, attaches provenance, and waits for each version to
   become installable before publishing dependents. The workflow saves its publication report even after a partial
   failure.

Only public `@buildkitgg/*` packages can publish. Private packages remain incubating. Publishing does not change
versions. Successful push or manually dispatched CI on main starts release preparation when Beachball change files are
pending, or publication when public package versions change with no pending change files. Dispatch only proceeds for the
verified commit at current main. Release branches can be deleted after merging.

Manual dispatch remains available for previews and retries. Run **Publish packages** on `main` with **dry_run** enabled
to preview, or disabled to publish. Select `*` for all public Buildkit packages, or an unscoped name such as
`fluentui-theme` to include that package and its dependencies. Pending Beachball files must be consumed by a merged
release PR first. Recursive publishing skips existing versions, so a partial release can be retried at the same commit.
Check the report and registry after an interrupted run. Never bump versions just to retry a failed upload.

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

The `npm` GitHub environment restricts deployments to `main` without required reviewers or approval gates. Repository
Actions settings allow release workflows to open and merge pull requests and dispatch subsequent workflows.

See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) for account setup and troubleshooting.
