import { readFile } from "node:fs/promises"
import path from "node:path"
import { z } from "zod"

export const workspaceList = z.array(z.string())
const manifestSchema = z.object({
  name: z.string().optional(),
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
