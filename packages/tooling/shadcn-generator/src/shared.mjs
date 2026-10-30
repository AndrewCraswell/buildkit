import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
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
    // vp run starts tasks without pnpm's environment, so use the pnpm on PATH.
    return ["pnpm", args]
  }
  return /\.[cm]?js$/.test(entry) ? [process.execPath, [entry, ...args]] : [entry, args]
}
export function pnpm(args, cwd = root, options = {}) {
  const [command, commandArgs] = pnpmCommand(args)
  // Windows runs pnpm through its .cmd shim, which needs a shell.
  const shell = command === "pnpm" && process.platform === "win32"
  return execFileSync(command, commandArgs, { cwd, stdio: "inherit", shell, ...options })
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
