import { readdir } from "node:fs/promises"
import path from "node:path"

const ignoredDirectories = new Set([
  "node_modules",
  "dist",
  "build",
  "out",
  "coverage",
  "storybook-static",
  "playwright-report",
  "test-results"
])
const configExtension = "(?:[cm]?[jt]s|[jt]sx)"
const storybookConfig = new RegExp(`^main\\.${configExtension}$`)
const playwrightConfig = new RegExp(`^playwright\\.config\\.${configExtension}$`)

type ProjectFiles = { cwd: string; storybook: string[]; playwright: string[] }

/** One bounded, read-only walk for both tools. Configs belong to their nearest package. */
export async function discoverProjects(root: string, workspaces?: string[]) {
  const projects: ProjectFiles[] = []
  const included = workspaces?.filter((pattern) => !pattern.startsWith("!"))
  const excluded = workspaces?.filter((pattern) => pattern.startsWith("!")).map((pattern) => pattern.slice(1)) ?? []
  let visited = 0
  const matches = (directory: string, pattern: string) => path.matchesGlob(directory, pattern.replace(/\/$/, ""))

  async function walk(directory: string, parent?: ProjectFiles) {
    if (++visited > 10000) {
      throw new Error("Too many directories to discover. Add an explicit dev-domains config.")
    }
    const cwd = path.relative(root, directory).replaceAll("\\", "/") || "."
    if (excluded.some((pattern) => matches(cwd, pattern) || matches(cwd, `${pattern.replace(/\/$/, "")}/**`))) {
      return
    }
    const entries = await readdir(directory, { withFileTypes: true })
    let project = parent
    if (cwd === "." || entries.some((entry) => entry.name === "package.json" && entry.isFile())) {
      project = undefined
      if (cwd === "." || !included || included.some((pattern) => matches(cwd, pattern))) {
        project = { cwd, storybook: [], playwright: [] }
        projects.push(project)
        if (projects.length > 1000) {
          throw new Error("Too many packages to discover. Add an explicit dev-domains config.")
        }
      }
    }
    for (const entry of entries) {
      if (entry.isFile() && project) {
        const file = path
          .relative(path.resolve(root, project.cwd), path.join(directory, entry.name))
          .replaceAll("\\", "/")
        if (path.basename(directory) === ".storybook" && storybookConfig.test(entry.name)) {
          project.storybook.push(file)
        }
        if (playwrightConfig.test(entry.name)) {
          project.playwright.push(file)
        }
      }
      if (
        entry.isDirectory() &&
        !ignoredDirectories.has(entry.name) &&
        (!entry.name.startsWith(".") || entry.name === ".storybook")
      ) {
        await walk(path.join(directory, entry.name), project)
      }
    }
  }
  await walk(path.resolve(root))
  return projects
    .sort((a, b) => a.cwd.localeCompare(b.cwd))
    .map((project) => ({
      ...project,
      storybook: project.storybook.sort(),
      playwright: project.playwright.sort()
    }))
}
