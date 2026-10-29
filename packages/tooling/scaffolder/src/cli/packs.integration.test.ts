import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { CommandRunner } from "../node/catalogs.js"
import type { Envelope } from "../plan/envelope.js"
import { fixtureCatalog, settings } from "../testing/fixture.js"
import { scriptedPrompter, type ScriptedAnswer } from "../testing/prompter.js"
import { satisfiesRange } from "../upgrade/semver.js"
import { runCli } from "./create.js"

let root: string
let output: string[]

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "scaffolder-packs-"))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

/** A template package's index.js: one or more templates for the fixture catalog, and an add-on whose file has the version. */
function packSource(version: string, options: { range?: string; templates?: string[] } = {}): string {
  const templates = (options.templates ?? ["tower"]).map((id) => ({
    id,
    title: id[0]!.toUpperCase() + id.slice(1),
    description: `The ${id} game`,
    target: "web",
    modes: ["spa"],
    required: ["@acme/tower/turrets"],
    slots: { ui: { required: true, default: "@fixture/ui-basic" } }
  }))
  return `export default {
  extends: { catalog: "@fixture/catalog", versions: ${JSON.stringify(options.range ?? "^1.0.0")} },
  templates: ${JSON.stringify(templates)},
  addons: [{
    id: "@acme/tower/turrets",
    version: ${JSON.stringify(version)},
    title: "Turrets",
    description: "Turret logic",
    contribute: () => [{ kind: "file", path: "src/turrets.ts", content: ${JSON.stringify(`export const turrets = "${version}"\n`)}, ownership: "seed" }]
  }]
}
`
}

/** npm, as far as the package store uses it, with `@acme/tower` published at the versions given. */
function fakeNpm(published: Record<string, string>): { run: CommandRunner; calls: string[][] } {
  const calls: string[][] = []
  const run: CommandRunner = async (_command, args, cwd) => {
    calls.push(args)
    const [verb, spec = "", field] = args
    if (!spec.startsWith("@acme/tower")) {
      return { code: 1, output: "npm ERR! 404 Not Found" }
    }
    const versions = Object.keys(published)
    if (verb === "view") {
      if (field === "versions") {
        return { code: 0, output: JSON.stringify(versions) }
      }
      const range = spec.slice("@acme/tower@".length)
      const matching =
        range === "latest" ? versions.slice(-1) : versions.filter((version) => satisfiesRange(version, range))
      return { code: 0, output: matching.length === 1 ? JSON.stringify(matching[0]) : JSON.stringify(matching) }
    }
    const version = spec.slice(spec.lastIndexOf("@") + 1)
    const source = published[version]
    if (source === undefined) {
      return { code: 1, output: "npm ERR! notarget" }
    }
    const folder = join(cwd, "node_modules/@acme/tower")
    mkdirSync(folder, { recursive: true })
    writeFileSync(
      join(folder, "package.json"),
      JSON.stringify({ name: "@acme/tower", version, type: "module", exports: "./index.js" })
    )
    writeFileSync(join(folder, "index.js"), source)
    writeFileSync(
      join(cwd, "package-lock.json"),
      JSON.stringify({ packages: { "node_modules/@acme/tower": { integrity: `sha512-${version}` } } })
    )
    return { code: 0, output: "" }
  }
  return { run, calls }
}

async function run(argv: string[], npm: { run: CommandRunner }, script: ScriptedAnswer[] = []) {
  output = []
  const scripted = scriptedPrompter(script)
  const code = await runCli(argv, {
    name: "fixture",
    version: "0.0.0",
    catalog: fixtureCatalog(),
    settings,
    cacheDir: join(root, "cache"),
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

const envelope = (out: string): Envelope => JSON.parse(out) as Envelope
const lock = () => JSON.parse(readFileSync(join(root, "demo/.fixture/lock.json"), "utf8"))

describe("template packages", () => {
  it("creates a project from a package, keeps using that version, and upgrades it", async () => {
    const npm = fakeNpm({ "1.0.0": packSource("1.0.0") })
    const created = await run(["init", "@acme/tower", "demo", "--yes", "--json"], npm)
    expect(created.code).toBe(0)
    expect(envelope(created.out).notices?.[0]?.text).toBe(
      "The template comes from @acme/tower@1.0.0 on npm, not from fixture. Applying it runs code from its author."
    )
    expect(readFileSync(join(root, "demo/src/turrets.ts"), "utf8")).toBe('export const turrets = "1.0.0"\n')
    expect(readFileSync(join(root, "demo/fixture.jsonc"), "utf8")).toContain('"template": "@acme/tower#tower"')
    expect(lock().catalog.packs).toEqual({ "@acme/tower": { version: "1.0.0", integrity: "sha512-1.0.0" } })

    // Later commands load the recorded version from the cache, without asking npm.
    npm.calls.length = 0
    const schema = JSON.parse((await run(["schema", "--cwd", "demo", "--json"], npm)).out) as {
      config: { properties: { addons: { properties: Record<string, unknown> } } }
    }
    expect(Object.keys(schema.config.properties.addons.properties)).toContain("@acme/tower/turrets")
    const added = await run(["add", "i18n", "--cwd", "demo", "--yes", "--json"], npm)
    expect(envelope(added.out).status).toBe("applied")
    expect(npm.calls).toEqual([])

    const newer = fakeNpm({ "1.0.0": packSource("1.0.0"), "1.1.0": packSource("1.1.0") })
    expect(envelope((await run(["check", "--cwd", "demo", "--json"], newer)).out).status).not.toBe("error")
    const upgraded = await run(["upgrade", "--cwd", "demo", "--yes", "--json"], newer)
    expect(envelope(upgraded.out).upgrade?.packs).toEqual([{ name: "@acme/tower", from: "1.0.0", to: "1.1.0" }])
    expect(readFileSync(join(root, "demo/src/turrets.ts"), "utf8")).toBe('export const turrets = "1.1.0"\n')
    expect(lock().catalog.packs["@acme/tower"].version).toBe("1.1.0")

    // A version that needs another catalog isn't an upgrade.
    const incompatible = fakeNpm({ "1.1.0": packSource("1.1.0"), "2.0.0": packSource("2.0.0", { range: "^2.0.0" }) })
    const stayed = await run(["upgrade", "--cwd", "demo", "--yes", "--json"], incompatible)
    expect(envelope(stayed.out).status).toBe("unchanged")

    // Offline, the project keeps the version it has.
    const offline: CommandRunner = async () => ({ code: 1, output: "npm ERR! network" })
    const unchecked = await run(["upgrade", "--cwd", "demo", "--dry-run", "--json"], { run: offline })
    expect(envelope(unchecked.out).notices?.[0]?.text).toContain("@acme/tower stays at 1.1.0")
  })

  it("upgrades past prereleases and versions it can't load", async () => {
    await run(["init", "@acme/tower", "demo", "--yes", "--json"], fakeNpm({ "1.0.0": packSource("1.0.0") }))
    const newer = fakeNpm({
      "1.0.0": packSource("1.0.0"),
      "1.1.0": packSource("1.1.0"),
      "1.2.0-rc.1": packSource("1.2.0-rc.1"),
      "1.3.0": "export default {}\n"
    })
    // Some npm versions nest the version list in another array.
    const nested: CommandRunner = async (command, args, cwd) => {
      const result = await newer.run(command, args, cwd)
      return args[0] === "view" && args[2] === "versions" ? { ...result, output: `[${result.output}]` } : result
    }
    for (const npm of [newer, { run: nested }]) {
      const listed = await run(["upgrade", "--cwd", "demo", "--list", "--json"], npm)
      expect(envelope(listed.out).upgrade?.packs).toEqual([{ name: "@acme/tower", from: "1.0.0", to: "1.1.0" }])
      expect(envelope(listed.out).notices).toContainEqual({
        code: "template-package-skipped",
        text: expect.stringContaining("@acme/tower@1.3.0 was skipped: @acme/tower@1.3.0 isn't a template package")
      })
    }
    const upgraded = await run(["upgrade", "--cwd", "demo", "--yes", "--json"], newer)
    expect(envelope(upgraded.out).upgrade?.packs).toEqual([{ name: "@acme/tower", from: "1.0.0", to: "1.1.0" }])
  })

  it("applies a saved plan for a package's template", async () => {
    const npm = fakeNpm({ "1.0.0": packSource("1.0.0", { templates: ["tower", "siege"] }) })
    const saved = await run(["init", "@acme/tower#siege", "demo", "--json", "--out", "plans"], npm)
    expect(envelope(saved.out).status).toBe("planned")
    const applied = await run(["init", "--plan", "plans/plan.json", "--json"], npm)
    expect(envelope(applied.out).status).toBe("applied")
    expect(readFileSync(join(root, "demo/fixture.jsonc"), "utf8")).toContain('"template": "@acme/tower#siege"')
  })

  it("reads npm's JSON past the warnings around it", async () => {
    const npm = fakeNpm({ "1.0.0": packSource("1.0.0") })
    const noisy: CommandRunner = async (command, args, cwd) => {
      const result = await npm.run(command, args, cwd)
      return args[0] === "view"
        ? {
            ...result,
            output: `npm warn config production Use --omit=dev instead.\n${result.output}\nnpm notice A new npm is available!\n`
          }
        : result
    }
    expect((await run(["init", "@acme/tower", "demo", "--yes", "--json"], { run: noisy })).code).toBe(0)
    const garbled: CommandRunner = async (command, args, cwd) =>
      args[0] === "view" ? { code: 0, output: "npm warn config\nnot json\n" } : npm.run(command, args, cwd)
    const refused = await run(["init", "@acme/tower", "other", "--json"], { run: garbled })
    expect(envelope(refused.out).error).toMatchObject({ code: "E_PACKAGE_UNAVAILABLE" })
    expect(envelope(refused.out).error?.message).toContain("npm printed something other than JSON")
  })

  it("refuses a cached package whose integrity doesn't match the lock", async () => {
    const npm = fakeNpm({ "1.0.0": packSource("1.0.0") })
    await run(["init", "@acme/tower", "demo", "--yes", "--json"], npm)
    const record = join(root, "cache/packs/@acme/tower/1.0.0/integrity.json")
    writeFileSync(record, JSON.stringify({ name: "@acme/tower", version: "1.0.0", integrity: "sha512-other" }))
    const result = await run(["sync", "--cwd", "demo", "--json"], npm)
    expect(envelope(result.out).error).toMatchObject({ code: "E_PACKAGE_UNAVAILABLE" })
    expect(envelope(result.out).error?.message).toContain("failed its integrity check")

    // A cache file that isn't JSON is the cache's problem, not an internal error.
    for (const file of ["integrity.json", "node_modules/@acme/tower/package.json"]) {
      const cached = join(root, "cache/packs/@acme/tower/1.0.0", file)
      const original = readFileSync(cached, "utf8")
      writeFileSync(record, JSON.stringify({ name: "@acme/tower", version: "1.0.0", integrity: "sha512-1.0.0" }))
      writeFileSync(cached, "{")
      const corrupt = await run(["sync", "--cwd", "demo", "--json"], npm)
      expect({ file, error: envelope(corrupt.out).error }).toMatchObject({
        file,
        error: { code: "E_PACKAGE_UNAVAILABLE", message: expect.stringContaining("can't be read") }
      })
      writeFileSync(cached, original)
    }

    // status reads only the lock and the files, so it never loads the package.
    npm.calls.length = 0
    expect(JSON.parse((await run(["status", "--cwd", "demo", "--json"], npm)).out)).toMatchObject({
      catalog: { id: "@fixture/catalog" }
    })
    expect(npm.calls).toEqual([])

    // A lock record without its integrity can't be checked, so it isn't loaded.
    const path = join(root, "demo/.fixture/lock.json")
    const edited = lock()
    delete edited.catalog.packs["@acme/tower"].integrity
    writeFileSync(path, JSON.stringify(edited))
    const unchecked = await run(["add", "i18n", "--cwd", "demo", "--yes", "--json"], npm)
    expect(envelope(unchecked.out).error).toMatchObject({ code: "E_PACKAGE_UNAVAILABLE" })
    expect(envelope(unchecked.out).error?.message).toContain("without its integrity")
  })

  it("explains packages it can't use, and never fetches a built-in name", async () => {
    const npm = fakeNpm({ "1.0.0": packSource("1.0.0"), "2.0.0": packSource("2.0.0", { range: "^2.0.0" }) })
    const cases: [string[], string][] = [
      [["init", "@acme/tower@2.0.0", "a"], "E_CATALOG_MISMATCH"],
      [["init", "@acme/tower@1.0.0#siege", "b"], "E_UNKNOWN_TEMPLATE"],
      [["init", "@acme/nothing", "c"], "E_PACKAGE_UNAVAILABLE"],
      [["init", "@acme/tower@^9", "d"], "E_PACKAGE_UNAVAILABLE"],
      [["init", "@acme", "e"], "E_USAGE"]
    ]
    for (const [argv, code] of cases) {
      const result = await run([...argv, "--json"], npm)
      expect({ argv, code: envelope(result.out).error?.code }).toEqual({ argv, code })
    }
    npm.calls.length = 0
    expect(envelope((await run(["init", "tower", "f", "--json"], npm)).out).error?.code).toBe("E_UNKNOWN_TEMPLATE")
    expect(npm.calls).toEqual([])
    expect(existsSync(join(root, "a"))).toBe(false)
  })

  it("asks which template when a package has several, and describes them", async () => {
    const npm = fakeNpm({ "1.0.0": packSource("1.0.0", { templates: ["tower", "siege"] }) })
    const unattended = await run(["init", "@acme/tower", "demo", "--json"], npm)
    expect(envelope(unattended.out).error?.message).toContain("Pick one: @acme/tower#tower, @acme/tower#siege.")
    // Picks siege, takes each default the wizard offers, and applies.
    const answer: ScriptedAnswer = (question) => {
      if (question.message === "Which template?") {
        return "siege"
      }
      if (question.kind === "confirm") {
        return true
      }
      return question.kind === "multiselect" ? [] : String(question.initial ?? question.options?.[0])
    }
    const asked = await run(
      ["init", "@acme/tower", "demo"],
      npm,
      Array.from({ length: 8 }, () => answer)
    )
    expect(asked.code).toBe(0)
    expect(asked.asked[0]).toMatchObject({ kind: "select", message: "Which template?", options: ["tower", "siege"] })
    expect(readFileSync(join(root, "demo/fixture.jsonc"), "utf8")).toContain('"template": "@acme/tower#siege"')

    const described = await run(["catalog", "@acme/tower", "--json"], npm)
    const description = JSON.parse(described.out) as { templates: { template: string }[] }
    expect(description.templates.map((template) => template.template)).toEqual([
      "@acme/tower#tower",
      "@acme/tower#siege"
    ])
    expect((await run(["catalog", "@acme/tower"], npm)).out).toContain("@fixture/catalog@1.0.0 with @acme/tower@1.0.0")
  })

  it("checks a package in a folder before it's published", async () => {
    const folder = join(root, "tower")
    mkdirSync(folder)
    writeFileSync(
      join(folder, "package.json"),
      JSON.stringify({ name: "@acme/tower", version: "0.1.0", type: "module", exports: "./index.js" })
    )
    writeFileSync(join(folder, "index.js"), packSource("0.1.0"))
    const npm = fakeNpm({})
    const checked = await run(["catalog", "check", "tower", "--json"], npm)
    expect(envelope(checked.out).notices?.[0]?.text).toBe(
      "@acme/tower@0.1.0 works with @fixture/catalog@1.0.0. Every option set of @acme/tower#tower plans."
    )
    writeFileSync(join(folder, "index.js"), packSource("0.1.0").replace('"target":"web"', '"target":"native"'))
    writeFileSync(
      join(folder, "package.json"),
      JSON.stringify({ name: "@acme/tower", version: "0.1.1", type: "module", exports: "./broken.js" })
    )
    writeFileSync(join(folder, "broken.js"), packSource("0.1.1").replace('"target":"web"', '"target":"native"'))
    const broken = await run(["catalog", "check", "tower", "--json"], npm)
    expect(envelope(broken.out).error).toMatchObject({ code: "E_INVALID_PACK" })
    writeFileSync(join(folder, "broken.js"), "export default { templates: [] }\n")
    writeFileSync(
      join(folder, "package.json"),
      JSON.stringify({ name: "@acme/tower", version: "0.1.2", type: "module", exports: "./other.js" })
    )
    writeFileSync(join(folder, "other.js"), "export default { templates: [] }\n")
    expect(envelope((await run(["catalog", "check", "tower", "--json"], npm)).out).error?.message).toContain(
      "isn't a template package"
    )
    expect(envelope((await run(["catalog", "frob", "--json"], npm)).out).error?.code).toBe("E_USAGE")

    // A folder without a package.json, or with a module that won't import, isn't a template package.
    expect(envelope((await run(["catalog", "check", "nowhere", "--json"], npm)).out).error).toMatchObject({
      code: "E_INVALID_PACK",
      message: expect.stringContaining("can't be read")
    })
    writeFileSync(
      join(folder, "package.json"),
      JSON.stringify({ name: "@acme/tower", version: "0.1.3", type: "module", exports: "./unfinished.js" })
    )
    writeFileSync(join(folder, "unfinished.js"), "export default {\n")
    expect(envelope((await run(["catalog", "check", "tower", "--json"], npm)).out).error).toMatchObject({
      code: "E_INVALID_PACK",
      message: expect.stringContaining("can't be imported")
    })

    // Nested export conditions resolve as Node resolves them, not to index.js.
    writeFileSync(
      join(folder, "package.json"),
      JSON.stringify({
        name: "@acme/tower",
        version: "0.1.4",
        type: "module",
        exports: { ".": { types: "./nested.d.ts", require: "./nested.cjs", node: { import: "./nested.js" } } }
      })
    )
    writeFileSync(join(folder, "index.js"), "export default {}\n")
    writeFileSync(join(folder, "nested.js"), packSource("0.1.4"))
    expect(envelope((await run(["catalog", "check", "tower", "--json"], npm)).out).notices?.[0]?.text).toContain(
      "@acme/tower@0.1.4 works with @fixture/catalog@1.0.0"
    )
  })
})
