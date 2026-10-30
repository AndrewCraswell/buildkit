import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { CommandRunner } from "../node/catalogs.js"
import type { Envelope } from "../plan/envelope.js"
import { fixtureCatalog, settings } from "../testing/fixture.js"
import { scriptedPrompter, type ScriptedAnswer } from "../testing/prompter.js"
import { satisfiesRange } from "../upgrade/semver.js"
import { runScaffold } from "./scaffold.js"

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "scaffolder-scaffold-"))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

// A fetched package is imported natively, which can't load the TypeScript fixture, so it reads the fixture from here.
const fixtureKey = "__scaffoldFixture"
Object.assign(globalThis, { [fixtureKey]: { fixtureCatalog, settings } })

/** A catalog package's index.js: the fixture catalog at a version, with its settings unless `settings` is false. */
function catalogSource(version: string, options: { settings?: boolean; templates?: string[] } = {}): string {
  return `const { fixtureCatalog, settings } = globalThis[${JSON.stringify(fixtureKey)}]
const base = fixtureCatalog()
const templates = ${JSON.stringify(options.templates ?? null)}
export const catalog = {
  ...base,
  version: ${JSON.stringify(version)},
  templates: templates ? base.templates.filter((template) => templates.includes(template.id)) : base.templates
}
${options.settings === false ? "" : "export { settings }"}
`
}

/** A template package's index.js, with one template for the fixture catalog. */
function packSource(range: string): string {
  return `export default {
  extends: { catalog: "@fixture/catalog", versions: ${JSON.stringify(range)} },
  templates: [{
    id: "tower",
    title: "Tower",
    description: "The tower game",
    target: "web",
    modes: ["spa"],
    required: [],
    slots: { ui: { required: true, default: "@fixture/ui-basic" } }
  }],
  addons: []
}
`
}

/** npm, as far as the package store uses it, with each package published at the versions given. */
function fakeNpm(published: Record<string, Record<string, string>>): { run: CommandRunner; calls: string[][] } {
  const calls: string[][] = []
  const run: CommandRunner = async (_command, args, cwd) => {
    calls.push(args)
    const [verb, spec = "", field] = args
    const at = spec.indexOf("@", 1)
    const name = at === -1 ? spec : spec.slice(0, at)
    const range = at === -1 ? "latest" : spec.slice(at + 1)
    const sources = published[name]
    if (!sources) {
      return { code: 1, output: "npm ERR! 404 Not Found" }
    }
    const versions = Object.keys(sources)
    if (verb === "view") {
      if (field === "versions") {
        return { code: 0, output: JSON.stringify(versions) }
      }
      const matching =
        range === "latest" ? versions.slice(-1) : versions.filter((version) => satisfiesRange(version, range))
      return { code: 0, output: matching.length === 1 ? JSON.stringify(matching[0]) : JSON.stringify(matching) }
    }
    const source = sources[range]
    if (source === undefined) {
      return { code: 1, output: "npm ERR! notarget" }
    }
    const folder = join(cwd, "node_modules", ...name.split("/"))
    mkdirSync(folder, { recursive: true })
    writeFileSync(
      join(folder, "package.json"),
      JSON.stringify({ name, version: range, type: "module", main: "index.js" })
    )
    writeFileSync(join(folder, "index.js"), source)
    writeFileSync(
      join(cwd, "package-lock.json"),
      JSON.stringify({ packages: { [`node_modules/${name}`]: { integrity: `sha512-${name}-${range}` } } })
    )
    return { code: 0, output: "" }
  }
  return { run, calls }
}

async function scaffold(argv: string[], npm: { run: CommandRunner }, script: ScriptedAnswer[] = []) {
  const output: string[] = []
  const scripted = scriptedPrompter(script)
  const code = await runScaffold(argv, {
    version: "0.0.0",
    cacheDir: join(root, "cache"),
    defaultPackage: "@fixture/catalog",
    runCommand: npm.run,
    io: {
      stdout: (text) => output.push(text),
      stderr: (text) => output.push(text),
      isTTY: script.length > 0,
      cwd: root,
      prompter: scripted.prompter
    }
  })
  return { code, out: output.join(""), asked: scripted.asked }
}

/** Answers every question after the template with its default, and confirms. */
const defaults: ScriptedAnswer = (question) => {
  switch (question.kind) {
    case "confirm":
      return true
    case "multiselect":
      return (question.initial as string[] | undefined) ?? []
    case "select":
      return String(question.initial ?? question.options?.[0] ?? "")
    default:
      return String(question.initial ?? "")
  }
}

const envelope = (out: string): Envelope => JSON.parse(out) as Envelope
const lock = (folder = "demo", stateDir = ".fixture") =>
  JSON.parse(readFileSync(join(root, folder, stateDir, "lock.json"), "utf8"))

describe("scaffold", () => {
  it("creates a project from a catalog package, with the product's settings and the package's integrity", async () => {
    const npm = fakeNpm({ "@fixture/catalog": { "1.0.0": catalogSource("1.0.0") } })
    const result = await scaffold(["@fixture/catalog#app", "demo", "--mode", "ssr", "--yes", "--json"], npm)
    expect(result.code).toBe(0)
    expect(existsSync(join(root, "demo/fixture.jsonc"))).toBe(true)
    expect(lock().catalog).toMatchObject({
      id: "@fixture/catalog",
      version: "1.0.0",
      integrity: "sha512-@fixture/catalog-1.0.0"
    })
    // npm installs into the cache, never the project.
    expect(existsSync(join(root, "cache/packs/@fixture/catalog/1.0.0/node_modules/@fixture/catalog"))).toBe(true)
  })

  it("uses a catalog's only template, and asks which one on a terminal when there are several", async () => {
    const only = fakeNpm({ "@fixture/catalog": { "1.0.0": catalogSource("1.0.0", { templates: ["app"] }) } })
    expect((await scaffold(["@fixture/catalog", "demo", "--mode", "ssr", "--yes", "--json"], only)).code).toBe(0)

    // Another version, since the cache keeps the first.
    const several = fakeNpm({ "@fixture/catalog": { "2.0.0": catalogSource("2.0.0") } })
    const unattended = await scaffold(["@fixture/catalog", "other", "--json"], several)
    expect(envelope(unattended.out).error).toMatchObject({
      code: "E_USAGE",
      message: "@fixture/catalog has more than one template. Pick one: @fixture/catalog#app, @fixture/catalog#bare."
    })
    const asked = await scaffold(["@fixture/catalog", "picked", "--mode", "ssr"], several, [
      "app",
      ...Array<ScriptedAnswer>(20).fill(defaults)
    ])
    expect(asked.asked[0]?.message).toBe("Which template?")
    expect(asked.code).toBe(0)
    expect(readFileSync(join(root, "picked/fixture.jsonc"), "utf8")).toContain('"template": "app"')
  })

  it("names the project's files for scaffold when the catalog package exports no settings", async () => {
    const npm = fakeNpm({ "@fixture/catalog": { "1.0.0": catalogSource("1.0.0", { settings: false }) } })
    const result = await scaffold(["@fixture/catalog#app", "demo", "--mode", "ssr", "--yes", "--json"], npm)
    expect(result.code).toBe(0)
    expect(existsSync(join(root, "demo/scaffold.jsonc"))).toBe(true)
    expect(lock("demo", ".scaffold").catalog.version).toBe("1.0.0")
  })

  it("creates a project from a template package with the catalog version it extends", async () => {
    const npm = fakeNpm({
      "@acme/tower": { "1.0.0": packSource("^1.0.0") },
      "@fixture/catalog": { "1.0.0": catalogSource("1.0.0"), "2.0.0": catalogSource("2.0.0") }
    })
    const result = await scaffold(["@acme/tower", "demo", "--yes", "--json"], npm)
    expect(result.code).toBe(0)
    expect(readFileSync(join(root, "demo/fixture.jsonc"), "utf8")).toContain('"template": "@acme/tower#tower"')
    expect(lock().catalog).toMatchObject({
      version: "1.0.0",
      packs: { "@acme/tower": { version: "1.0.0", integrity: "sha512-@acme/tower-1.0.0" } }
    })
    // create finds the template package scaffold already fetched.
    expect(npm.calls.filter(([verb, spec]) => verb === "install" && spec === "@acme/tower@1.0.0")).toHaveLength(1)
  })

  it("creates from the default catalog without a package, taking a template or a folder first", async () => {
    const npm = fakeNpm({ "@fixture/catalog": { "1.0.0": catalogSource("1.0.0") } })
    expect((await scaffold(["app", "demo", "--mode", "ssr", "--yes", "--json"], npm)).code).toBe(0)
    expect(readFileSync(join(root, "demo/fixture.jsonc"), "utf8")).toContain('"template": "app"')
    const folderFirst = await scaffold(["other", "--json"], npm)
    expect(envelope(folderFirst.out).error?.message).toBe(
      "@fixture/catalog has more than one template. Pick one: @fixture/catalog#app, @fixture/catalog#bare."
    )
    const asked = await scaffold(["picked", "--mode", "ssr", "--yes"], npm, ["app"])
    expect(asked.code).toBe(2)
    expect(asked.asked).toEqual([])
  })

  it("takes the template from --preset in either form, and never asks with --yes", async () => {
    const npm = fakeNpm({ "@fixture/catalog": { "1.0.0": catalogSource("1.0.0") } })
    for (const [folder, preset] of [
      ["spaced", ["--preset", "saas"]],
      ["inline", ["--preset=saas"]]
    ] as const) {
      const result = await scaffold(["@fixture/catalog", folder, ...preset, "--yes", "--json"], npm)
      expect(result.code).toBe(0)
      expect(readFileSync(join(root, folder, "fixture.jsonc"), "utf8")).toContain('"template": "app"')
    }
    // On a terminal, --yes still never makes a decision for you.
    const unasked = await scaffold(["@fixture/catalog", "demo", "--yes"], npm, ["app"])
    expect(unasked.asked).toEqual([])
    expect(unasked.code).toBe(2)
    expect(unasked.out).toContain("has more than one template")
  })

  it("applies a saved plan with the catalog version it records, never a newer one", async () => {
    const npm = fakeNpm({ "@fixture/catalog": { "1.0.0": catalogSource("1.0.0") } })
    const saved = await scaffold(["@fixture/catalog#app", "demo", "--mode", "ssr", "--json", "--out", "plans"], npm)
    expect(saved.code).toBe(0)
    const newer = fakeNpm({ "@fixture/catalog": { "1.0.0": catalogSource("1.0.0"), "2.0.0": catalogSource("2.0.0") } })
    const applied = await scaffold(["@fixture/catalog", "--plan=plans/plan.json", "--json"], newer)
    expect(applied.code).toBe(0)
    expect(lock().catalog.version).toBe("1.0.0")
    expect(newer.calls.some(([verb]) => verb === "view")).toBe(false)
    expect(newer.calls.some(([verb, spec]) => verb === "install" && spec === "@fixture/catalog@2.0.0")).toBe(false)
  })

  it("applies a template package's saved plan with the package and catalog versions it records", async () => {
    const npm = fakeNpm({
      "@acme/tower": { "1.0.0": packSource("^1.0.0") },
      "@fixture/catalog": { "1.0.0": catalogSource("1.0.0") }
    })
    const saved = await scaffold(["@acme/tower", "demo", "--json", "--out", "plans"], npm)
    expect(saved.code).toBe(0)
    const newer = fakeNpm({
      "@acme/tower": { "1.0.0": packSource("^1.0.0"), "1.1.0": packSource("^1.0.0") },
      "@fixture/catalog": { "1.0.0": catalogSource("1.0.0"), "1.5.0": catalogSource("1.5.0") }
    })
    const applied = await scaffold(["@acme/tower", "--plan", "plans/plan.json", "--json"], newer)
    expect(applied.code).toBe(0)
    expect(lock().catalog).toMatchObject({ version: "1.0.0", packs: { "@acme/tower": { version: "1.0.0" } } })
    expect(newer.calls.some(([verb]) => verb === "view" || verb === "install")).toBe(false)
  })

  it("reports what it can't use, and prints usage", async () => {
    const npm = fakeNpm({ "@acme/empty": { "1.0.0": "export const nothing = 1\n" } })
    const cases: [string[], string][] = [
      [["@acme/missing", "demo", "--json"], "E_PACKAGE_UNAVAILABLE"],
      [["@acme/empty", "demo", "--json"], "E_INVALID_PACK"],
      [["@acme", "demo", "--json"], "E_USAGE"]
    ]
    for (const [argv, code] of cases) {
      expect({ argv, code: envelope((await scaffold(argv, npm)).out).error?.code }).toEqual({ argv, code })
    }
    expect((await scaffold(["--help"], npm)).out).toContain("Usage: scaffold [package]")
    expect((await scaffold(["--version"], npm)).out).toBe("0.0.0\n")
  })
})
