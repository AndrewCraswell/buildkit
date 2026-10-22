# Releases

All style packages share a public API and release together. Changes to that API require review of the API Extractor
reports.

Run `pnpm update:shadcn`, `pnpm generate`, and `pnpm validate` from the repository root. Validation builds the packages
and checks isolated consumers with each style installed through the shared alias, including modal and alert managers.

The weekly shadcn workflow updates the pinned upstream snapshot and dependencies. Compatible updates use Beachball and
the publishing workflow. API changes or failed validation require a review PR. Initial publication and npm trusted
publisher setup are required for each new package name.

Use a patch for compatible implementation updates, a minor for additive APIs, and a breaking release for incompatible
APIs or peer requirements. Do not accept API baselines automatically during updates.
