import { createHash } from "node:crypto"
import { resolve } from "node:path"
import { root, tool, templatePath, readJson, writeJson, pnpm } from "./shared.mjs"

const requestedRevision = process.argv[2]
async function get(url) {
  const response = await fetch(url, { headers: { "User-Agent": "buildkit-upstream-update" } })
  if (!response.ok) {
    throw new Error(`${response.status}: ${url}`)
  }
  return response
}
const revision =
  requestedRevision ?? (await (await get("https://api.github.com/repos/shadcn-ui/ui/commits/main")).json()).sha
if (!/^[a-f0-9]{40}$/.test(revision)) {
  throw new Error("Expected a full upstream commit SHA")
}
const tree = await (await get(`https://api.github.com/repos/shadcn-ui/ui/git/trees/${revision}?recursive=1`)).json()
if (tree.truncated) {
  throw new Error("Upstream tree is truncated")
}
const base = "apps/v4/registry/bases/base/"
const paths = tree.tree
  .filter(
    ({ path, type }) =>
      type === "blob" &&
      ((path.startsWith(base) && /\/(ui|hooks|lib)\/[^/]+\.tsx?$/.test(path) && !path.endsWith("/_registry.ts")) ||
        /^apps\/v4\/registry\/styles\/style-[a-z]+\.css$/.test(path) ||
        ["apps/v4/registry/themes.ts", "apps/v4/app/globals.css", "LICENSE.md"].includes(path))
  )
  .map(({ path }) => path)
  .sort()
const files = {}
// Bound requests to avoid exhausting GitHub connections.
for (let i = 0; i < paths.length; i += 8) {
  await Promise.all(
    paths.slice(i, i + 8).map(async (path) => {
      files[path] = await (await get(`https://raw.githubusercontent.com/shadcn-ui/ui/${revision}/${path}`)).text()
    })
  )
}
const sources = Object.fromEntries(
  Object.keys(files)
    .filter((p) => p.startsWith(base))
    .sort()
    .map((p) => [p.slice(base.length), files[p]])
)
const styles = Object.fromEntries(
  Object.keys(files)
    .filter((p) => /\/style-[a-z]+\.css$/.test(p))
    .sort()
    .map((p) => [p.match(/style-([a-z]+)\.css$/)[1], files[p]])
)
if (!sources["ui/button.tsx"] || !styles.nova || !files["apps/v4/registry/themes.ts"]) {
  throw new Error("Incomplete upstream snapshot")
}
writeJson(resolve(tool, "upstream/snapshot.json"), {
  repository: "https://github.com/shadcn-ui/ui",
  revision,
  hashes: Object.fromEntries(
    Object.keys(files)
      .sort()
      .map((p) => [p, createHash("sha256").update(files[p]).digest("hex")])
  ),
  sources,
  styles,
  themes: files["apps/v4/registry/themes.ts"],
  globals: files["apps/v4/app/globals.css"]
})
if (!requestedRevision) {
  pnpm(["--filter", "@repo/shadcn-generator", "update", "shadcn", "--latest", "--save-exact"], root)
  pnpm(
    [
      "--filter",
      "@buildkitgg/shadcn-baseui-*",
      "--filter",
      "@buildkitgg/shadcn-modals-manager",
      "update",
      "@base-ui/react",
      "@shadcn/react",
      "--latest"
    ],
    root
  )
  const template = readJson(templatePath)
  template.dependencies = readJson(resolve(root, "packages/shadcn/shadcn-baseui-nova/package.json")).dependencies
  writeJson(templatePath, template)
}
process.stdout.write(
  `Pinned shadcn ${revision}: ${Object.keys(styles).length} styles, ${Object.keys(sources).length} source files. Run pnpm generate next.`
)
