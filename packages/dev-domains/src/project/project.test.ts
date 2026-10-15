import { execFileSync } from "node:child_process"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { detectConfig, readManifest } from "./detect.js"
import { checkoutName, projectIdentity, slug } from "./identity.js"

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

describe("project conventions", () => {
  it("keeps checkout identity stable and distinct", () => {
    expect(checkoutName("/repo", true)).toBe("main")
    expect(checkoutName("D:\\repo\\Feature", false)).toBe(checkoutName("d:/repo/feature/", false))
    expect(checkoutName("/a/feature", false)).not.toBe(checkoutName("/b/feature", false))
    expect(checkoutName("/a/Feature", false)).not.toBe(checkoutName("/a/feature", false))
    expect(slug("!!!")).toBe("app")
  })
  it("detects the repository root and non-git projects", async () => {
    const root = await directory()
    expect(await projectIdentity(root)).toMatchObject({ worktree: "main" })
    execFileSync("git", ["init", "--quiet", root])
    await mkdir(path.join(root, "nested"))
    expect(await projectIdentity(path.join(root, "nested"))).toMatchObject({ worktree: "main", root })
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
})
