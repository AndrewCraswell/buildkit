import { access, realpath, writeFile } from "node:fs/promises"
import path from "node:path"
import { detectConfig } from "../project/detect.js"
import { projectIdentity } from "../project/identity.js"
import { readConfigFile } from "./read.js"
import { configSchema, type DevDomainsConfig } from "./schema.js"

const filenames = [
  "dev-domains.config.ts",
  "dev-domains.config.mts",
  "dev-domains.config.js",
  "dev-domains.config.mjs",
  "dev-domains.config.json",
  "dev-domains.json"
]
export async function findConfig(cwd: string, boundary: string) {
  let directory = cwd
  while (true) {
    const matches = []
    for (const name of filenames) {
      try {
        await access(path.join(directory, name))
        matches.push(path.join(directory, name))
      } catch {
        /* Not present. */
      }
    }
    if (matches.length > 1) {
      throw new Error(`Multiple dev-domains configs in ${directory}; keep one.`)
    }
    if (matches[0]) {
      return matches[0]
    }
    const parent = path.dirname(directory)
    if (directory === boundary || directory === parent) {
      return undefined
    }
    directory = parent
  }
}

export async function loadProject(cwd: string, explicitFile?: string) {
  const identity = await projectIdentity(cwd)
  const file = explicitFile
    ? await realpath(path.resolve(cwd, explicitFile))
    : await findConfig(await realpath(cwd), identity.root)
  let input: unknown
  const root = file ? path.dirname(file) : identity.root
  if (file) {
    input = await readConfigFile(file)
  } else {
    input = await detectConfig(root)
  }
  const result = configSchema.safeParse(input)
  if (!result.success) {
    throw new Error(
      `Invalid dev-domains configuration:\n${result.error.issues.map((issue) => `${issue.path.join(".") || "config"}: ${issue.message}`).join("\n")}`
    )
  }
  return { config: result.data, root, worktree: identity.worktree, file }
}

export async function saveConfig(root: string, config: DevDomainsConfig) {
  configSchema.parse(config)
  if (await findConfig(root, root)) {
    throw new Error("A configuration already exists. Edit it instead of overwriting it.")
  }
  const file = path.join(root, "dev-domains.json")
  await writeFile(file, `${JSON.stringify(config, null, 2)}\n`, { flag: "wx" })
  return file
}
