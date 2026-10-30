import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it } from "vite-plus/test"
import { findConfig, loadProject, saveConfig } from "./load.js"
import { configSchema, defineConfig } from "./schema.js"

const directories: string[] = []
async function directory() {
  const value = await mkdtemp(path.join(os.tmpdir(), "buildkit-config-"))
  directories.push(value)
  return value
}
afterEach(async () => {
  await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})
const input = { project: "demo", endpoints: { app: { command: ["node", "server.js"] } } }

describe("configuration contracts", () => {
  it("keeps typed inputs intact and applies runtime defaults", () => {
    expect(defineConfig(input)).toBe(input)
    expect(configSchema.parse(input)).toMatchObject({
      domain: "localhost",
      proxy: { port: 443, https: true },
      endpoints: { app: { cwd: ".", framework: "custom" } }
    })
  })
  it.each([
    { ...input, project: "UPPERCASE" },
    { ...input, domain: "https://example.com" },
    { ...input, unknown: true },
    { ...input, endpoints: {} },
    { ...input, endpoints: { app: { script: "dev", command: ["node"] } } },
    { ...input, endpoints: { app: {} } },
    { ...input, proxy: { domains: ["example.com"] } },
    { ...input, endpoints: { app: { command: ["node"], env: { PORT: "3000" } } } },
    { ...input, endpoints: { app: { command: ["node"], auth: ["//evil.test"] } } },
    { ...input, endpoints: { app: { command: ["node"], tunnel: { command: ["tunnel"], paths: ["/../admin"] } } } }
  ])("rejects invalid or ambiguous configuration %#", (value) => {
    expect(configSchema.safeParse(value).success).toBe(false)
  })
  it("loads JSON and TypeScript through c12 without modifying environment", async () => {
    const root = await directory()
    await saveConfig(root, input)
    const project = await loadProject(root)
    expect(project.config.project).toBe("demo")
    await expect(saveConfig(root, input)).rejects.toThrow("already exists")
    await writeFile(path.join(root, "dev-domains.config.ts"), `export default ${JSON.stringify(input)}`)
    await expect(findConfig(root, root)).rejects.toThrow("Multiple")
    await rm(path.join(root, "dev-domains.json"))
    expect((await loadProject(root, "dev-domains.config.ts")).config.project).toBe("demo")
    expect(await readFile(path.join(root, "dev-domains.config.ts"), "utf8")).toContain("export default")
  })
  it("finds parent config only inside the checkout boundary", async () => {
    const root = await directory()
    const child = path.join(root, "app")
    await mkdir(child)
    await saveConfig(root, input)
    expect(await findConfig(child, root)).toBe(path.join(root, "dev-domains.json"))
    expect(await findConfig(child, child)).toBeUndefined()
  })
  it("reports invalid files and detects defaults when no config exists", async () => {
    const root = await directory()
    await writeFile(
      path.join(root, "package.json"),
      JSON.stringify({ name: "demo", scripts: { dev: "node server.js" } })
    )
    expect((await loadProject(root)).config.endpoints.app?.script).toBe("dev")
    await writeFile(path.join(root, "dev-domains.json"), JSON.stringify({ project: "demo" }))
    await expect(loadProject(root)).rejects.toThrow("Invalid dev-domains configuration")
  })
})
