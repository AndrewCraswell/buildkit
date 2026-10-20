import { readFile } from "node:fs/promises"
import path from "node:path"
import { z } from "zod"
import { readConfigFile } from "../config/read.js"
import { type DevDomainsConfig } from "../config/schema.js"
import { discoverProjects } from "./discovery.js"
import { slug } from "./identity.js"
import { readManifest, workspaceList } from "./manifest.js"
import { detectPackageManager } from "./package-manager.js"

const wrappers = /\b(dev-domains|portless|turbo|run-p|concurrently)\b/
const storybookDev = /\bstorybook\s+dev\b/
const playwrightTest = /\bplaywright\s+test\b/

function frameworkFor(source: string): "next" | "vite" | "storybook" | "custom" {
  if (/[;&|#]/.test(source) || /\s--(?:\s|$)/.test(source)) {
    return "custom"
  }
  if (/^next\s+dev(?:\s|$)/.test(source)) {
    return "next"
  }
  if (/^vite(?:\s|$)/.test(source)) {
    return "vite"
  }
  if (/^storybook\s+dev(?:\s|$)/.test(source)) {
    return "storybook"
  }
  return "custom"
}

/** Discover runnable candidates without importing tool configs or executing scripts. */
export async function detectConfig(root: string): Promise<DevDomainsConfig> {
  const manifest = await readManifest(root)
  const project = slug(manifest.name?.replace(/^@/, "").replace("/", "-") || path.basename(root))
  const packageManager = await detectPackageManager(root)
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
  const endpoints: DevDomainsConfig["endpoints"] = {}
  for (const files of await discoverProjects(root, workspaces)) {
    const { cwd } = files
    const pkg = await readManifest(path.join(root, cwd))
    const scripts = Object.entries(pkg.scripts).filter(([, source]) => !wrappers.test(source))
    const prefix = cwd === "." ? "" : `${slug(pkg.name?.split("/").at(-1) || path.basename(cwd))}-`
    const add = (service: string, endpoint: DevDomainsConfig["endpoints"][string]) => {
      const key = `${prefix}${service}`
      if (endpoints[key]) {
        throw new Error(`Detected duplicate endpoint ${key}. Use explicit configuration.`)
      }
      endpoints[key] = {
        cwd,
        primaryName: `{project}${key === "app" ? "" : `-${key}`}`,
        name: `{project}-{worktree}${key === "app" ? "" : `-${key}`}`,
        ...endpoint
      }
    }
    const dev = scripts.find(
      ([script, source]) => script === "dev" && !storybookDev.test(source) && !playwrightTest.test(source)
    )
    if (dev) {
      const [script, source] = dev
      add("app", { kind: "app", script, framework: frameworkFor(source) })
    }

    const stories = scripts.filter(([, source]) => storybookDev.test(source))
    if (stories.length > 1) {
      throw new Error(`Multiple Storybook dev scripts in ${cwd}. Choose a script in an explicit dev-domains config.`)
    }
    const story = stories[0]
    if (story) {
      add("stories", { kind: "storybook", script: story[0], framework: frameworkFor(story[1]) })
    } else if (files.storybook.length) {
      if (files.storybook.length > 1) {
        throw new Error(
          `Multiple Storybook configs in ${cwd}. Choose a config directory in an explicit dev-domains config.`
        )
      }
      // Use the installed binary directly; discovery never downloads or runs it.
      add("stories", {
        kind: "storybook",
        framework: "storybook",
        command: ["storybook", "dev", "--config-dir", path.posix.dirname(files.storybook[0]!)]
      })
    }

    const hasPlaywright =
      files.playwright.length > 0 ||
      "@playwright/test" in pkg.dependencies ||
      "@playwright/test" in pkg.devDependencies ||
      scripts.some(([, source]) => playwrightTest.test(source))
    if (hasPlaywright && dev) {
      add("app-e2e", {
        kind: "e2e",
        script: dev[0],
        framework: frameworkFor(dev[1])
      })
    }
  }
  return { project, packageManager, endpoints }
}
