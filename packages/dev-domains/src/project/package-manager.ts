import { readdir } from "node:fs/promises"
import path from "node:path"
import { LOCKS } from "package-manager-detector/constants"
import { detect } from "package-manager-detector/detect"
import { configSchema, type ResolvedConfig } from "../config/schema.js"

export async function detectPackageManager(root: string): Promise<ResolvedConfig["packageManager"]> {
  const options = { cwd: root, stopDir: path.resolve(root) }
  let result = await detect({ ...options, strategies: ["packageManager-field", "devEngines-field"] })
  if (!result) {
    const entries = await readdir(root, { withFileTypes: true })
    const markers = entries.filter((entry) => entry.isFile() && Object.hasOwn(LOCKS, entry.name))
    if (new Set(markers.map((entry) => LOCKS[entry.name])).size > 1) {
      throw new Error(
        `Conflicting package manager files: ${markers
          .map((entry) => entry.name)
          .sort()
          .join(", ")}. Set packageManager in package.json or an explicit dev-domains config.`
      )
    }
    result = await detect({ ...options, strategies: ["lockfile", "install-metadata"] })
  }
  if (!result) {
    return "npm"
  }
  const manager = configSchema.shape.packageManager.safeParse(result.name)
  if (!manager.success) {
    throw new Error(`Package manager ${result.name} is not supported. Use npm, pnpm, Yarn, or Bun.`)
  }
  return manager.data
}
