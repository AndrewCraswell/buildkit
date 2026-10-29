import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { catalog } from "@buildkitgg/catalog"
import type { CatalogManifest, Envelope } from "@buildkitgg/scaffolder"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { runBuildkit } from "./index.js"

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "buildkit-cli-"))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

async function run(argv: string[], options: { catalog?: CatalogManifest } = {}) {
  const stdout: string[] = []
  const stderr: string[] = []
  const code = await runBuildkit(argv, {
    io: { stdout: (text) => stdout.push(text), stderr: (text) => stderr.push(text), isTTY: false, cwd: root },
    cacheDir: join(root, "cache"),
    ...(options.catalog ? { catalog: options.catalog } : {})
  })
  return { code, out: stdout.join(""), err: stderr.join("") }
}

function envelope(out: string): Envelope {
  const value: Envelope = JSON.parse(out)
  return value
}

function read(path: string): string {
  return readFileSync(join(root, "demo", path), "utf8")
}

function write(path: string, content: string) {
  writeFileSync(join(root, "demo", path), content)
}

const project = (path: string) => join(root, "demo", path)
const init = ["init", "app", "demo", "--mode", "ssr", "--yes", "--json"]

/** The catalog as an earlier release: its router starter has no `defaultPreload`. */
function previousCatalog(): CatalogManifest {
  return {
    ...catalog,
    version: `${catalog.version}-previous`,
    targets: catalog.targets.map((target) => ({
      ...target,
      base: (ctx) =>
        target
          .base(ctx)
          .map((contribution) =>
            contribution.kind === "file" && contribution.path === "src/router.tsx"
              ? { ...contribution, content: contribution.content.replace('    defaultPreload: "intent",\n', "") }
              : contribution
          )
    }))
  }
}

describe("buildkit init", () => {
  it("creates a TanStack Start app that check accepts, and planning it again changes nothing", async () => {
    const result = await run(init)
    expect(result.code).toBe(0)
    expect(envelope(result.out)).toMatchObject({ status: "applied", required: ["@buildkit/ci"] })
    const expected = ["buildkit.jsonc", ".buildkit/lock.json", "src/start.ts", "src/router.tsx", "vite.config.ts"]
    expect(expected.filter((path) => !existsSync(project(path)))).toEqual([])
    expect(JSON.parse(read("package.json")).devDependencies["@buildkitgg/cli"]).toBe(catalog.version)
    expect(read("buildkit.jsonc")).not.toMatch(/cloudflare|wrangler/i)
    expect((await run(["check", "--cwd", "demo"])).code).toBe(0)
    expect(envelope((await run(["sync", "--cwd", "demo", "--dry-run", "--json"])).out).status).toBe("unchanged")
    expect(JSON.parse((await run(["explain", "src/start.ts", "--cwd", "demo", "--json"])).out)).toMatchObject({
      kind: "path",
      class: "seed",
      contributors: ["tanstack-start"]
    })
  })

  it("describes the questionnaire as JSON", async () => {
    const result = await run(["catalog", "--json"])
    expect(result.code).toBe(0)
    const description = JSON.parse(result.out)
    expect(description.templates.map((template: { template: string }) => template.template)).toEqual(["app"])
    expect(description.slots.map((slot: { id: string }) => slot.id)).toEqual(["database", "auth"])
  })
})

describe("buildkit add", () => {
  it("asks for a database before sign-in, and adds both when the choice is given", async () => {
    await run(init)
    const asked = await run(["add", "auth", "--cwd", "demo", "--yes", "--json"])
    expect(asked.code).toBe(1)
    const [decision] = envelope(asked.out).decisions ?? []
    expect(decision?.id).toBe("slot:database")
    const argv = decision?.choices[0]?.argv ?? []
    expect(argv.slice(0, 2)).toEqual(["buildkit", "add"])
    const added = await run([...argv.slice(1), "--cwd", "demo", "--yes", "--json"])
    expect(added.code).toBe(0)
    const result = envelope(added.out)
    expect(result.status).toBe("applied")
    const expected = ["src/auth/auth.server.ts", "src/auth/identity.server.ts", "src/db/db.server.ts", ".env.example"]
    expect(expected.filter((path) => !existsSync(project(path)))).toEqual([])
    expect(read(".env.example")).toContain("BETTER_AUTH_SECRET=")
    expect(result.nextSteps?.join("\n")).toContain("BETTER_AUTH_SECRET")
    expect(result.notices?.filter((notice) => notice.code === "unpublished-package").length).toBeGreaterThan(0)
    const config = read("buildkit.jsonc")
    expect(config).toContain("@buildkit/better-auth")
    expect(config).toContain("@buildkit/sql")
  })

  it("adds localization without touching your starter files or your package.json keys", async () => {
    await run(init)
    const router = `${read("src/router.tsx")}\n// My note.\n`
    write("src/router.tsx", router)
    const manifest = JSON.parse(read("package.json"))
    write(
      "package.json",
      `${JSON.stringify({ ...manifest, scripts: { ...manifest.scripts, mine: "echo mine" } }, null, 2)}\n`
    )
    const result = await run(["add", "i18n", "--set", "i18n.locales=en,fr", "--cwd", "demo", "--yes", "--json"])
    expect(result.code).toBe(0)
    expect(envelope(result.out).status).toBe("applied")
    expect(read("src/router.tsx")).toBe(router)
    const updated = JSON.parse(read("package.json"))
    expect(updated.scripts.mine).toBe("echo mine")
    expect(updated.dependencies["@lingui/core"]).toBe(catalog.versions?.["@lingui/core"])
    expect(read("src/generated/buildkit/client.ts")).toContain("withI18n")
    expect(read("src/generated/buildkit/server.ts")).toContain("localeMiddleware")
    expect(read("src/locales/fr.po")).toContain("Language: fr")
    expect(read("buildkit.jsonc")).toContain('"@buildkit/i18n": { "locales": ["en", "fr"] }')
    expect((await run(["check", "--cwd", "demo"])).code).toBe(0)
  })
})

describe("buildkit upgrade", () => {
  it("moves an app made with an earlier catalog version to the installed one, keeping your edits", async () => {
    const previous = previousCatalog()
    expect((await run(init, { catalog: previous })).code).toBe(0)
    expect(read("src/router.tsx")).not.toContain("defaultPreload")
    const styles = `${read("src/styles.css")}\n.mine {\n  color: red;\n}\n`
    write("src/styles.css", styles)
    const listed = await run(["upgrade", "--list", "--cwd", "demo", "--json"])
    expect(listed.code).toBe(0)
    expect(envelope(listed.out)).toMatchObject({
      status: "planned",
      upgrade: { catalog: { from: previous.version, to: catalog.version } }
    })
    const upgraded = await run(["upgrade", "--cwd", "demo", "--yes", "--json"])
    expect(upgraded.code).toBe(0)
    expect(envelope(upgraded.out).status).toBe("applied")
    expect(read("src/router.tsx")).toContain('defaultPreload: "intent"')
    expect(read("src/styles.css")).toBe(styles)
    expect(JSON.parse(read(".buildkit/lock.json")).catalog.version).toBe(catalog.version)
    expect((await run(["check", "--cwd", "demo"])).code).toBe(0)
  })

  it("never overwrites a starter file you edited when the old version can't be rendered", async () => {
    const previous = previousCatalog()
    await run(init, { catalog: previous })
    const router = read("src/router.tsx").replace(
      "export function getRouter() {",
      "// Mine.\nexport function getRouter() {"
    )
    write("src/router.tsx", router)
    const upgraded = await run(["upgrade", "--cwd", "demo", "--yes", "--json"])
    const result = envelope(upgraded.out)
    expect(result.status).not.toBe("applied")
    expect(result.conflicts?.map((conflict) => conflict.path) ?? []).toContain("src/router.tsx")
    expect(read("src/router.tsx")).toBe(router)
  })
})
