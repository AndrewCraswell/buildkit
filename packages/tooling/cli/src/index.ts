import { readFileSync } from "node:fs"
import { catalog, settings } from "@buildkitgg/catalog"
import { runCli, type CliOptions } from "@buildkitgg/scaffolder/cli"
import { z } from "zod"

const { version } = z
  .object({ version: z.string() })
  .parse(JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")))

/**
 * The `buildkit` CLI's options: Buildkit's catalog and file names on the scaffolder's project commands. Pass overrides
 * to embed the CLI, such as `io` to capture its output or `cacheDir` for earlier catalog versions.
 */
export function buildkitOptions(overrides: Partial<CliOptions> = {}): CliOptions {
  return {
    name: "buildkit",
    version,
    description: "Create, extend and upgrade Buildkit apps",
    catalog,
    settings,
    ...overrides
  }
}

/**
 * Runs one `buildkit` command, such as `["create", "app", "my-app"]`, and returns its exit code: 0 done, 1 needs a
 * decision, 2 usage or internal error, 3 conflict, 4 drift, 5 locked, 130 cancelled.
 */
export function runBuildkit(argv: readonly string[], overrides: Partial<CliOptions> = {}): Promise<number> {
  return runCli(argv, buildkitOptions(overrides))
}
