import { execFileSync, spawnSync } from "node:child_process"
import { existsSync, globSync, readFileSync, readdirSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, matchesGlob, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("../../../../", import.meta.url))
const base = process.env.BASE_BRANCH ? `origin/${process.env.BASE_BRANCH}` : "origin/main"
const read = (file) => JSON.parse(readFileSync(file, "utf8"))
const require = createRequire(import.meta.url)
const config = require(resolve(root, "beachball.config.js"))
const changed = execFileSync("git", ["diff", "--name-only", `${base}...HEAD`], { cwd: root, encoding: "utf8" })
  .trim()
  .split("\n")
  .filter(Boolean)
const pending =
  existsSync(resolve(root, "change")) && readdirSync(resolve(root, "change")).some((file) => file.endsWith(".json"))
const packages = globSync("packages/*/*/package.json", { cwd: root })
  .map((file) => ({ file, pkg: read(resolve(root, file)) }))
  .filter(({ pkg }) => !pkg.private && pkg.name.startsWith("@buildkitgg/"))
const relevant = packages.filter(({ file }) =>
  changed.some(
    (path) =>
      path.startsWith(dirname(file).replaceAll("\\", "/") + "/") &&
      !config.ignorePatterns.some((pattern) => matchesGlob(path, pattern))
  )
)
function previous(file) {
  try {
    return JSON.parse(
      execFileSync("git", ["show", `${base}:${file}`], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"]
      })
    )
  } catch {
    return undefined
  }
}
function increased(before, after) {
  if (!/^\d+\.\d+\.\d+$/.test(after)) {
    return false
  }
  if (!before) {
    return true
  }
  const old = before.split(".").map(Number)
  const next = after.split(".").map(Number)
  for (let index = 0; index < 3; index++) {
    if (next[index] !== old[index]) {
      return next[index] > old[index]
    }
  }
  return false
}
if (!pending && relevant.some(({ file, pkg }) => increased(previous(file)?.version, pkg.version))) {
  for (const { file, pkg } of relevant) {
    if (!increased(previous(file)?.version, pkg.version)) {
      throw new Error(`Prepared release must bump ${pkg.name}`)
    }
    const changelog = read(resolve(root, dirname(file), "CHANGELOG.json"))
    if (changelog.name !== pkg.name || !changelog.entries.some((entry) => entry.version === pkg.version)) {
      throw new Error(`Missing release notes for ${pkg.name}@${pkg.version}`)
    }
  }
  process.stdout.write(`Verified ${relevant.length} prepared package releases.\n`)
} else {
  const result = spawnSync(
    process.execPath,
    [require.resolve("beachball/bin/beachball.js"), "check", "--branch", base],
    { cwd: root, stdio: "inherit" }
  )
  process.exit(result.status ?? 1)
}
