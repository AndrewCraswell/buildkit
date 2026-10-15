import { execFileSync } from "node:child_process"
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

export function checkoutName(root: string, isPrimary: boolean): string | null {
  if (isPrimary) {
    return null
  }
  const canonical = root.replaceAll("\\", "/").replace(/\/+$/, "")
  const normalized = /^[a-z]:/i.test(canonical) ? canonical.toLowerCase() : canonical
  const name = path.posix
    .basename(normalized)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
  if (!name || name.length > 63) {
    throw new Error("Worktree names must resolve to a nonempty DNS label of at most 63 characters. Rename the folder.")
  }
  return name
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
    return { root: directory, worktree: null }
  }
  return { root, worktree: checkoutName(root, common === path.join(root, ".git")) }
}
