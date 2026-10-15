import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { realpath } from "node:fs/promises"
import path from "node:path"

export function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .slice(0, 32)
      .replace(/^-+|-+$/g, "") || "app"
  )
}

export function checkoutName(root: string, isMain: boolean): string {
  if (isMain) {
    return "main"
  }
  const canonical = root.replaceAll("\\", "/").replace(/\/+$/, "")
  const normalized = /^[a-z]:/i.test(canonical) ? canonical.toLowerCase() : canonical
  return `${slug(path.posix.basename(normalized))}-${createHash("sha256").update(normalized).digest("hex").slice(0, 8)}`
}

export async function projectIdentity(cwd: string) {
  const directory = await realpath(cwd)
  const git = (...args: string[]) =>
    execFileSync("git", ["-C", directory, "rev-parse", ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5000
    }).trim()
  let root: string
  let common: string
  try {
    root = await realpath(git("--show-toplevel"))
    common = await realpath(git("--path-format=absolute", "--git-common-dir"))
  } catch {
    return { root: directory, worktree: "main" }
  }
  return { root, worktree: checkoutName(root, common === path.join(root, ".git")) }
}
