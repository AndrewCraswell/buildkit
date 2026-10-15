import { execFileSync } from "node:child_process"
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { detectConfig } from "./detect.js"
import { discoverProjects } from "./discovery.js"
import { checkoutName, projectIdentity, slug } from "./identity.js"
import { readManifest } from "./manifest.js"
import { detectPackageManager } from "./package-manager.js"

const directories: string[] = []
async function directory() {
  const value = await mkdtemp(path.join(os.tmpdir(), "buildkit-detect-"))
  directories.push(value)
  return value
}
afterEach(async () => {
  await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})
async function manifest(root: string, value: unknown) {
  await mkdir(root, { recursive: true })
  await writeFile(path.join(root, "package.json"), JSON.stringify(value))
}

async function configFile(root: string, file: string) {
  const target = path.join(root, file)
  await mkdir(path.dirname(target), { recursive: true })
  // Discovery must never execute tool configuration.
  await writeFile(target, 'throw new Error("Tool config was executed")')
}

describe("project conventions", () => {
  it("uses folder names without hashes and represents the primary checkout separately", () => {
    expect(checkoutName("/repo", true)).toBeNull()
    expect(checkoutName("D:\\repo\\Feature", false)).toBe(checkoutName("d:/repo/feature/", false))
    expect(checkoutName("/a/feature", false)).toBe("feature")
    expect(checkoutName("/a/feature", false)).toBe(checkoutName("/b/feature", false))
    expect(checkoutName("/a/Feature", false)).toBe(checkoutName("/a/feature", false))
    expect(checkoutName("/a/fix_ui", false)).toBe(checkoutName("/a/fix-ui", false))
    expect(() => checkoutName(`/a/${"x".repeat(64)}`, false)).toThrow("63 characters")
    expect(slug("!!!")).toBe("app")
  })
  it("detects the repository root and non-git projects", async () => {
    const root = await directory()
    expect(await projectIdentity(root)).toMatchObject({ worktree: null })
    execFileSync("git", ["init", "--quiet", root])
    await mkdir(path.join(root, "nested"))
    expect(await projectIdentity(path.join(root, "nested"))).toMatchObject({ worktree: null, root })
  })
  it("detects monorepo servers while skipping wrappers, dependencies, and builds", async () => {
    const root = await directory()
    await manifest(root, { name: "@org/shop", packageManager: "pnpm@12.0.0", scripts: { dev: "turbo dev" } })
    await manifest(path.join(root, "apps/web"), {
      name: "@shop/web",
      scripts: {
        dev: "dev-domains run web-app",
        "dev:app": "next dev",
        storybook: "storybook dev",
        build: "vite build"
      }
    })
    await manifest(path.join(root, "apps/admin"), { scripts: { dev: "vite" } })
    await manifest(path.join(root, "node_modules/ignored"), { scripts: { dev: "vite" } })
    const config = await detectConfig(root)
    expect(config.project).toBe("org-shop")
    expect(config.packageManager).toBe("pnpm")
    expect(Object.keys(config.endpoints)).toEqual(["admin-app", "web-app", "web-stories"])
    expect(config.endpoints["web-app"]).toMatchObject({ framework: "next", script: "dev:app" })
    expect(config.endpoints["admin-app"]).toMatchObject({ framework: "vite" })
  })
  it("uses lockfiles and leaves compound commands explicit", async () => {
    const root = await directory()
    await manifest(root, { scripts: { dev: "setup && vite" } })
    await writeFile(path.join(root, "yarn.lock"), "")
    expect(await detectConfig(root)).toMatchObject({
      packageManager: "yarn",
      endpoints: { app: { framework: "custom" } }
    })
    await writeFile(path.join(root, "package.json"), "broken")
    await expect(readManifest(root)).rejects.toThrow("Cannot read")
  })
  it("prefers an explicitly selected package manager over stale lockfiles", async () => {
    const root = await directory()
    await manifest(root, { packageManager: "npm@11.0.0", scripts: { dev: "vite" } })
    await writeFile(path.join(root, "pnpm-lock.yaml"), "")
    expect((await detectConfig(root)).packageManager).toBe("npm")
  })
  it("rejects ambiguous workspace endpoint names", async () => {
    const root = await directory()
    for (const child of ["apps/a", "apps/b"]) {
      await manifest(path.join(root, child), { name: "same", scripts: { dev: "vite" } })
    }
    await expect(detectConfig(root)).rejects.toThrow("duplicate endpoint")
  })
  it("honors declared pnpm workspace packages and exclusions", async () => {
    const root = await directory()
    await manifest(root, { name: "demo" })
    await writeFile(path.join(root, "pnpm-workspace.yaml"), 'packages:\n  - sites/*\n  - "!sites/ignored"\n')
    await manifest(path.join(root, "sites/web"), { scripts: { "dev:app": "vite", "dev:raw": "vite", dev: "vite" } })
    await manifest(path.join(root, "sites/ignored"), { scripts: { dev: "vite" } })
    await manifest(path.join(root, "examples/fixture"), { scripts: { dev: "vite" } })
    expect(Object.keys((await detectConfig(root)).endpoints)).toEqual(["web-app"])
  })

  it.each([
    ["bun.lockb", "bun"],
    ["bun.lock", "bun"],
    ["package-lock.json", "npm"],
    ["npm-shrinkwrap.json", "npm"],
    ["pnpm-lock.yaml", "pnpm"],
    ["yarn.lock", "yarn"]
  ])("detects %s with package-manager-detector", async (file, manager) => {
    const root = await directory()
    await writeFile(path.join(root, file), "")
    expect(await detectPackageManager(root)).toBe(manager)
  })
  it("uses devEngines metadata and prevents unrelated parent package-manager leakage", async () => {
    const root = await directory()
    await manifest(root, { packageManager: "pnpm@12.0.0" })
    const child = path.join(root, "child")
    await manifest(child, {})
    expect(await detectPackageManager(child)).toBe("npm")
    await manifest(child, { devEngines: { packageManager: { name: "yarn", version: "4.0.0" } } })
    await writeFile(path.join(child, "pnpm-lock.yaml"), "")
    expect(await detectPackageManager(child)).toBe("yarn")
  })
  it("rejects competing lockfiles but allows multiple markers for the same manager", async () => {
    const root = await directory()
    await writeFile(path.join(root, "bun.lock"), "")
    await writeFile(path.join(root, "bun.lockb"), "")
    expect(await detectPackageManager(root)).toBe("bun")
    await writeFile(path.join(root, "yarn.lock"), "")
    await expect(detectPackageManager(root)).rejects.toThrow("Conflicting package manager files")
    await manifest(root, { packageManager: "pnpm@12.0.0" })
    expect(await detectPackageManager(root)).toBe("pnpm")
    await manifest(root, { packageManager: "deno@2.0.0" })
    await expect(detectPackageManager(root)).rejects.toThrow("not supported")
  })
  it("detects installation metadata when no declaration or lockfile exists", async () => {
    const root = await directory()
    await mkdir(path.join(root, "node_modules/.pnpm"), { recursive: true })
    expect(await detectPackageManager(root)).toBe("pnpm")
  })

  it.each(["ts", "mts", "cts", "js", "mjs", "cjs", "tsx", "jsx"])(
    "discovers both tools from .%s configs without executing them",
    async (extension) => {
      const root = await directory()
      await manifest(root, { scripts: { dev: "vite" } })
      await configFile(root, `tools/ui kit/.storybook/main.${extension}`)
      await configFile(root, `tests/playwright.config.${extension}`)
      const config = await detectConfig(root)
      expect(config.endpoints.stories).toMatchObject({
        kind: "storybook",
        command: ["storybook", "dev", "--config-dir", "tools/ui kit/.storybook"],
        framework: "storybook"
      })
      expect(config.endpoints["app-e2e"]).toMatchObject({ kind: "e2e", script: "dev", framework: "vite" })
    }
  )
  it("discovers packages outside conventional folders without attributing their configs to parents", async () => {
    const root = await directory()
    await manifest(root, { scripts: { dev: "next dev" } })
    await configFile(root, ".storybook/main.ts")
    await manifest(path.join(root, "products/shop"), { scripts: { dev: "vite" } })
    await configFile(root, "products/shop/.storybook/main.mjs")
    await configFile(root, "products/shop/playwright.config.ts")
    const config = await detectConfig(root)
    expect(Object.keys(config.endpoints)).toEqual(["app", "stories", "shop-app", "shop-stories", "shop-app-e2e"])
    expect(config.endpoints["shop-app-e2e"]?.cwd).toBe("products/shop")
  })
  it("prunes generated and hidden directories, workspace exclusions, and symlink cycles", async () => {
    const root = await directory()
    await manifest(root, { workspaces: { packages: ["sites/*", "!sites/ignored"] } })
    await manifest(path.join(root, "sites/web"), { scripts: { dev: "vite" } })
    await configFile(root, "sites/web/playwright.config.ts")
    for (const name of [
      "node_modules",
      "dist",
      "build",
      "out",
      "coverage",
      "storybook-static",
      "playwright-report",
      "test-results",
      ".git",
      ".next",
      ".turbo",
      "sites/ignored",
      "examples/other"
    ]) {
      await manifest(path.join(root, name), { scripts: { dev: "vite" } })
      await configFile(root, `${name}/.storybook/main.ts`)
      await configFile(root, `${name}/playwright.config.ts`)
    }
    await symlink(root, path.join(root, "cycle"), process.platform === "win32" ? "junction" : "dir")
    expect(Object.keys((await detectConfig(root)).endpoints)).toEqual(["web-app", "web-app-e2e"])
  })
  it("ignores empty config folders and associates configs with the nearest package even when excluded", async () => {
    const root = await directory()
    await manifest(root, { workspaces: [], scripts: { dev: "vite" } })
    await mkdir(path.join(root, ".storybook"))
    await manifest(path.join(root, "unlisted"), {})
    await configFile(root, "unlisted/playwright.config.ts")
    await configFile(root, "unlisted/.storybook/main.ts")
    expect(Object.keys((await detectConfig(root)).endpoints)).toEqual(["app"])
    expect(await discoverProjects(root, [])).toEqual([{ cwd: ".", storybook: [], playwright: [] }])
  })
  it("requires a clear Storybook command when several configurations exist", async () => {
    const root = await directory()
    await configFile(root, "one/.storybook/main.ts")
    await configFile(root, "two/.storybook/main.ts")
    await expect(detectConfig(root)).rejects.toThrow("Multiple Storybook configs")
    await manifest(root, { scripts: { workshop: "storybook dev --config-dir one/.storybook" } })
    expect((await detectConfig(root)).endpoints.stories?.script).toBe("workshop")
    await manifest(root, { scripts: { one: "storybook dev", two: "storybook dev" } })
    await expect(detectConfig(root)).rejects.toThrow("Multiple Storybook dev scripts")
  })
  it.each([
    { devDependencies: { "@playwright/test": "1.0.0" } },
    { dependencies: { "@playwright/test": "1.0.0" } },
    { scripts: { e2e: "playwright test" } }
  ])("recognizes Playwright signals but always runs the app server %#", async (tooling) => {
    const root = await directory()
    await manifest(root, { ...tooling, scripts: { ...tooling.scripts, dev: "vite" } })
    expect((await detectConfig(root)).endpoints["app-e2e"]).toMatchObject({ script: "dev", kind: "e2e" })
  })
  it("does not infer E2E servers from browser dependencies or test-only projects", async () => {
    const root = await directory()
    await manifest(root, { devDependencies: { playwright: "1.0.0" }, scripts: { dev: "vite" } })
    expect(Object.keys((await detectConfig(root)).endpoints)).toEqual(["app"])
    await manifest(root, { scripts: { dev: "playwright test" } })
    await configFile(root, "playwright.config.ts")
    expect((await detectConfig(root)).endpoints).toEqual({})
    await manifest(root, { scripts: { dev: "storybook dev" } })
    expect(Object.keys((await detectConfig(root)).endpoints)).toEqual(["stories"])
  })
})
