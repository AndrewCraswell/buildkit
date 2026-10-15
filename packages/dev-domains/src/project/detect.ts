import { glob, readFile } from "node:fs/promises"
import path from "node:path"
import { z } from "zod"
import { readConfigFile } from "../config/read.js"
import { type DevDomainsConfig } from "../config/schema.js"
import { slug } from "./identity.js"

const workspaceList = z.array(z.string())
const manifestSchema = z.object({
  name: z.string().optional(),
  packageManager: z.string().optional(),
  workspaces: z.union([workspaceList, z.object({ packages: workspaceList })]).optional(),
  scripts: z.record(z.string(), z.string()).default({}),
  dependencies: z.record(z.string(), z.string()).default({}),
  devDependencies: z.record(z.string(), z.string()).default({})
})
export async function readManifest(directory: string) {
  try {
    return manifestSchema.parse(JSON.parse(await readFile(path.join(directory, "package.json"), "utf8")))
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return manifestSchema.parse({})
    }
    throw new Error(`Cannot read package.json in ${directory}`, { cause: error })
  }
}

/** Discover candidates without executing package scripts or modifying files. */
export async function detectConfig(root: string): Promise<DevDomainsConfig> {
  const manifest = await readManifest(root)
  const project = slug(manifest.name?.replace(/^@/, "").replace("/", "-") || path.basename(root))
  const manager = manifest.packageManager?.split("@")[0]
  let packageManager: "npm" | "pnpm" | "yarn" | "bun" = "npm"
  if (manager === "pnpm" || manager === "yarn" || manager === "bun") {
    packageManager = manager
  } else {
    for (const [file, candidate] of [
      ["pnpm-lock.yaml", "pnpm"],
      ["yarn.lock", "yarn"],
      ["bun.lock", "bun"]
    ] as const) {
      try {
        await readFile(path.join(root, file))
        packageManager = candidate
        break
      } catch {
        /* No lockfile for this manager. */
      }
    }
  }
  const endpoints: DevDomainsConfig["endpoints"] = {}
  let workspaces = Array.isArray(manifest.workspaces) ? manifest.workspaces : manifest.workspaces?.packages
  const workspaceFile = path.join(root, "pnpm-workspace.yaml")
  try {
    await readFile(workspaceFile)
    workspaces = z.object({ packages: workspaceList.optional() }).parse(await readConfigFile(workspaceFile)).packages
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error
    }
  }
  const patterns = workspaces
    ? [
        "package.json",
        ...workspaces
          .filter((entry) => !entry.startsWith("!"))
          .map((entry) => `${entry.replace(/\/$/, "")}/package.json`)
      ]
    : ["package.json", "apps/*/package.json", "packages/*/package.json"]
  const excluded = [
    "**/node_modules/**",
    "**/.git/**",
    "**/dist/**",
    "**/.next/**",
    "**/coverage/**",
    ...(workspaces ?? [])
      .filter((entry) => entry.startsWith("!"))
      .map((entry) => `${entry.slice(1).replace(/\/$/, "")}/**`)
  ]
  const files: string[] = []
  for await (const file of glob(patterns, { cwd: root, exclude: excluded })) {
    files.push(file)
    if (files.length > 1000) {
      throw new Error("Too many packages to discover. Add an explicit dev-domains config.")
    }
  }
  for (const file of files.sort()) {
    const cwd = path.dirname(file).replaceAll("\\", "/")
    const pkg = await readManifest(path.join(root, cwd))
    const scripts = Object.entries(pkg.scripts)
    for (const [script, source] of scripts) {
      if (/\b(dev-domains|portless|turbo|run-p|concurrently)\b/.test(source)) {
        continue
      }
      const isStories = /\bstorybook\s+dev\b/.test(source)
      const isDev = script === "dev" || script === "dev:app" || script === "dev:raw"
      if (!isStories && !isDev) {
        continue
      }
      const preferred = ["dev:app", "dev:raw", "dev"].find(
        (candidate) =>
          pkg.scripts[candidate] && !/\b(dev-domains|portless|turbo|run-p|concurrently)\b/.test(pkg.scripts[candidate]!)
      )
      if (isDev && script !== preferred) {
        continue
      }
      const prefix = cwd === "." ? "" : `${slug(pkg.name?.split("/").at(-1) || path.basename(cwd))}-`
      const key = `${prefix}${isStories ? "stories" : "app"}`
      if (endpoints[key]) {
        throw new Error(`Detected duplicate endpoint ${key}. Use explicit configuration.`)
      }
      // Only simple commands can safely accept appended framework flags.
      const isSimple = !/[;&|#]/.test(source) && !/\s--(?:\s|$)/.test(source)
      let framework: "next" | "vite" | "storybook" | "custom" = "custom"
      if (isSimple && /^next\s+dev(?:\s|$)/.test(source)) {
        framework = "next"
      }
      if (isSimple && /^vite(?:\s|$)/.test(source)) {
        framework = "vite"
      }
      if (isSimple && /^storybook\s+dev(?:\s|$)/.test(source)) {
        framework = "storybook"
      }
      endpoints[key] = {
        kind: isStories ? "storybook" : "app",
        cwd,
        script,
        framework,
        name: `{project}-{worktree}${key === "app" ? "" : `-${key}`}`
      }
    }
  }
  return { project, packageManager, endpoints }
}
