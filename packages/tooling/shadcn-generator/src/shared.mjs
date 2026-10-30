import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { createRequire } from "node:module"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

export const root = fileURLToPath(new URL("../../../../", import.meta.url))
export const tool = resolve(root, "packages/tooling/shadcn-generator")
export const templatePath = resolve(tool, "package-template.json")
export const readJson = (file) => JSON.parse(readFileSync(file, "utf8"))
export function write(file, content) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, content)
}
export const writeJson = (file, value) => write(file, JSON.stringify(value, null, 2) + "\n")
export function pnpmCommand(args) {
  const entry = process.env.npm_execpath
  if (!entry) {
    throw new Error("Run this command through pnpm.")
  }
  return /\.[cm]?js$/.test(entry) ? [process.execPath, [entry, ...args]] : [entry, args]
}
export function pnpm(args, cwd = root, options = {}) {
  const [command, commandArgs] = pnpmCommand(args)
  return execFileSync(command, commandArgs, { cwd, stdio: "inherit", ...options })
}
// Runs a package's bin with Node: vp run starts tasks without pnpm's environment, and no shell is needed.
export function runBin(packageName, binName, args, cwd) {
  const manifest = createRequire(resolve(cwd, "package.json")).resolve(`${packageName}/package.json`)
  const { bin } = readJson(manifest)
  const entry = resolve(dirname(manifest), typeof bin === "string" ? bin : bin[binName])
  return execFileSync(process.execPath, [entry, ...args], { cwd, stdio: "inherit" })
}
export function snapshot() {
  return readJson(resolve(tool, "upstream/snapshot.json"))
}
export function variants(data = snapshot()) {
  return Object.keys(data.styles)
    .sort()
    .map((style) => ({
      style,
      directory: resolve(root, `packages/shadcn/shadcn-baseui-${style}`)
    }))
}
