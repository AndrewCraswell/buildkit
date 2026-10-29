import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { CatalogManifest } from "../manifest/types.js"
import type { Envelope } from "../plan/envelope.js"
import { describeCatalog } from "../resolve/questions.js"
import { fixtureCatalog, settings } from "../testing/fixture.js"
import { scriptedPrompter, type ScriptedAnswer } from "../testing/prompter.js"
import type { CliOptions } from "./commands.js"
import { createCli, runCli } from "./create.js"
import { cancelled } from "./prompter.js"

let root: string
let stdout: string[]
let stderr: string[]

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "scaffolder-cli-"))
  stdout = []
  stderr = []
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function options(
  extra: {
    tty?: boolean
    script?: ScriptedAnswer[]
    catalog?: CatalogManifest
    hooks?: CliOptions["hooks"]
    runCommand?: CliOptions["runCommand"]
  } = {}
) {
  const scripted = scriptedPrompter(extra.script ?? [])
  const cli: CliOptions = {
    name: "fixture",
    version: "0.0.0",
    catalog: extra.catalog ?? fixtureCatalog(),
    settings,
    cacheDir: join(root, "cache"),
    io: {
      stdout: (text) => stdout.push(text),
      stderr: (text) => stderr.push(text),
      isTTY: extra.tty ?? false,
      cwd: root,
      prompter: scripted.prompter
    },
    ...(extra.hooks ? { hooks: extra.hooks } : {}),
    ...(extra.runCommand ? { runCommand: extra.runCommand } : {})
  }
  return { cli, ...scripted }
}

async function run(argv: string[], extra: Parameters<typeof options>[0] = {}) {
  const { cli, asked, notes } = options(extra)
  stdout = []
  stderr = []
  const code = await runCli(argv, cli)
  return { code, asked, notes, out: stdout.join(""), err: stderr.join("") }
}

function envelope(out: string): Envelope {
  const value: Envelope = JSON.parse(out)
  return value
}

function files(folder = join(root, "demo")): string[] {
  if (!existsSync(folder)) {
    return []
  }
  return readdirSync(folder, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
}

const init = ["init", "app", "demo", "--mode", "ssr"]

describe("init", () => {
  it("explains a missing destination parent", async () => {
    const result = await run(["init", "app", "missing/demo", "--yes"])
    expect(result.code).toBe(2)
    expect(result.err).toContain("doesn't exist")
  })

  it("refuses a non-empty destination, and --dry-run runs the same check", async () => {
    mkdirSync(join(root, "demo"))
    writeFileSync(join(root, "demo/notes.txt"), "x\n")
    for (const flag of ["--yes", "--dry-run"]) {
      const result = await run([...init, flag, "--json"])
      expect(result.code).toBe(2)
      expect(envelope(result.out).error?.code).toBe("E_DESTINATION")
    }
    const adopted = await run([...init, "--adopt", "--yes", "--json"])
    expect(adopted.code).toBe(0)
    expect(readFileSync(join(root, "demo/notes.txt"), "utf8")).toBe("x\n")
  })

  it("--dry-run writes nothing, and init applies and reports applied", async () => {
    const dry = await run([...init, "--dry-run", "--json"])
    expect(dry.code).toBe(0)
    expect(envelope(dry.out).status).toBe("planned")
    expect(files()).toEqual([])
    const applied = await run([...init, "--yes", "--json"])
    expect(envelope(applied.out)).toMatchObject({ status: "applied", required: ["@fixture/lint"] })
    expect(existsSync(join(root, "demo/fixture.jsonc"))).toBe(true)
  })

  it("never applies without --yes or a reviewed plan when it can't prompt", async () => {
    const result = await run([...init, "--json", "--out", "plans"])
    expect(envelope(result.out)).toMatchObject({
      status: "planned",
      notices: [expect.objectContaining({ code: "not-applied" })]
    })
    expect(files()).toEqual([])
    expect(existsSync(join(root, "plans/plan.json"))).toBe(true)
    expect(readdirSync(join(root, "plans/patches"), { recursive: true }).length).toBeGreaterThan(0)
    const approved = await run(["init", "--plan", "plans/plan.json", "demo", "--json"])
    expect(envelope(approved.out).status).toBe("applied")
    const again = await run(["init", "--plan", "plans/plan.json", "demo", "--json"])
    expect(envelope(again.out).status).toBe("unchanged")
    const shown = await run(["plan", "show", "plans/plan.json"])
    expect(shown.out).toContain("Planned")
  })

  it("rejects usage errors with exit 2 and writes nothing", async () => {
    const accepted: string[] = []
    for (const argv of [
      ["init", "app", "demo", "--frobnicate"],
      ["init", "app", "demo", "extra", "--yes"],
      ["init", "app", "--yes"],
      ["nope"],
      [],
      ["init", "app", "demo", "--set", "broken", "--yes"],
      ["init", "app", "demo", "--diff", "some", "--out", "--yes"],
      ["init", "app", "demo", "--preset", "nope", "--yes"],
      ["init", "bare", "demo", "--preset", "saas", "--yes"]
    ]) {
      const result = await run(argv)
      if (result.code !== 2) {
        accepted.push(`${argv.join(" ")}: exit ${result.code}`)
      }
    }
    expect(accepted).toEqual([])
    expect(files()).toEqual([])
    const name = await run(["init", "app", "Demo App", "--yes", "--json"])
    expect(envelope(name.out).error?.code).toBe("E_INVALID_OPTIONS")
  })

  it("--yes never makes a decision for you", async () => {
    const result = await run(["init", "bare", "demo", "--yes", "--json"])
    expect(result.code).toBe(1)
    expect(envelope(result.out).decisions?.[0]).toMatchObject({
      id: "slot:ui",
      choices: [{ argv: ["fixture", "init", "bare", "demo", "--ui", "ui-basic"] }, expect.anything()]
    })
    expect(files()).toEqual([])
  })

  it("a failure never reports success", async () => {
    const result = await run([...init, "--yes"], {
      hooks: {
        afterWrite(path) {
          if (path === "package.json") {
            throw new Error("disk full")
          }
        }
      }
    })
    expect(result.code).toBe(2)
    expect(result.out).not.toContain("Applied")
    expect(result.err).toContain("disk full")
    expect(files().filter((file) => !file.includes(".fixture"))).toEqual([])
  })
})

describe("the wizard", () => {
  it("asks only the open questions, in catalog order, and never about required add-ons", async () => {
    const result = await run(["init"], {
      tty: true,
      script: [
        "app",
        "demo",
        "ssr",
        true,
        "@fixture/db-postgres",
        "@fixture/ui-fancy",
        ["@fixture/i18n"],
        "dark",
        "en, fr",
        "postgres://local",
        true
      ]
    })
    expect(result.code).toBe(0)
    expect(result.asked.map((question) => [question.kind, question.message])).toEqual([
      ["select", "Which template?"],
      ["text", "Project name?"],
      ["select", "Which mode?"],
      ["confirm", "Add a database?"],
      ["select", "Which database?"],
      ["select", "Which UI kit?"],
      ["multiselect", "Add any of these?"],
      ["select", "Fancy UI: Theme"],
      ["text", "Localization: Locales"],
      ["password", "DATABASE_URL: Connection string"],
      ["confirm", "Apply these changes?"]
    ])
    expect(result.asked.find((question) => question.message === "Add any of these?")?.initial).toEqual([
      "@fixture/storybook"
    ])
    expect(result.asked.at(-1)?.initial).toBe(false)
    expect(result.notes[0]).toContain("Changes:")
    expect(result.notes[0]).toContain("Always included:\n  @fixture/lint")
    const config = readFileSync(join(root, "demo/fixture.jsonc"), "utf8")
    expect(config).toContain('"@fixture/ui-fancy": {"theme":"dark"}')
    expect(config).toContain('"@fixture/i18n": {"locales":["en","fr"]}')
    expect(config).toContain('"declined": ["@fixture/sentry","@fixture/storybook"]')
  })

  it("an optional slot asks yes or no first, and a slot with one fitting choice isn't asked", async () => {
    const result = await run(["init", "app", "demo", "--mode", "spa", "--ui", "ui-basic", "--with", "storybook"], {
      tty: true,
      script: [true, true]
    })
    expect(result.asked.map((question) => question.message)).toEqual(["Add a database?", "Apply these changes?"])
    expect(readFileSync(join(root, "demo/fixture.jsonc"), "utf8")).toContain("@fixture/db-sqlite")
    const declined = await run(["init", "app", "other", "--mode", "spa", "--ui", "ui-basic", "--with", "storybook"], {
      tty: true,
      script: [false, true]
    })
    expect(declined.code).toBe(0)
    expect(readFileSync(join(root, "other/fixture.jsonc"), "utf8")).toContain("slot:database")
  })

  it("a preset's answers skip their questions", async () => {
    const result = await run(["init", "--preset", "saas", "demo"], {
      tty: true,
      script: ["@fixture/ui-basic", "en", "postgres://local", true]
    })
    expect(result.asked.map((question) => question.message)).toEqual([
      "Which UI kit?",
      "Localization: Locales",
      "DATABASE_URL: Connection string",
      "Apply these changes?"
    ])
    expect(readFileSync(join(root, "demo/fixture.jsonc"), "utf8")).toContain("@fixture/db-postgres")
  })

  it("wizard answers and the equivalent flags give the same fingerprint", async () => {
    const wizard = await run(["init", "app", "demo", "--dry-run", "--out", "wizard"], {
      tty: true,
      script: ["ssr", true, "@fixture/db-sqlite", "@fixture/ui-basic", ["@fixture/i18n"], "en"]
    })
    expect(wizard.asked.map((question) => question.message)).not.toContain("Apply these changes?")
    await run([
      "init",
      "app",
      "demo",
      "--mode",
      "ssr",
      "--database",
      "db-sqlite",
      "--ui",
      "ui-basic",
      "--without",
      "storybook",
      "--with",
      "i18n",
      "--set",
      'i18n.locales=["en"]',
      "--dry-run",
      "--out",
      "flags"
    ])
    const fingerprint = (folder: string) =>
      JSON.parse(readFileSync(join(root, folder, "plan.json"), "utf8")).fingerprint
    expect(fingerprint("flags")).toBe(fingerprint("wizard"))
  })

  it("asks for a required secret with a masked prompt and keeps it out of the summary, plan and lock", async () => {
    const dsn = "https://publickey@sentry.example/123"
    const result = await run([...init, "--database", "db-sqlite", "--ui", "ui-basic", "--with", "sentry", "--out"], {
      tty: true,
      script: [dsn, true]
    })
    expect(result.code).toBe(0)
    expect(result.asked.map((question) => question.kind)).toEqual(["password", "confirm"])
    expect(result.notes.join("")).not.toContain(dsn)
    expect(readFileSync(join(root, "demo/.env"), "utf8")).toContain(dsn)
    const tracked = files()
      .filter((file) => !file.endsWith(".env"))
      .map((file) => readFileSync(file, "utf8"))
      .join("\n")
    expect(tracked).not.toContain(dsn)
    const plain = await run(["init", "app", "other", "--mode", "ssr", "--with", "sentry", "--yes", "--json"])
    expect(envelope(plain.out).nextSteps).toEqual(["Set SENTRY_DSN in .env: Your Sentry DSN"])
  })

  it("cancelling a choice, the secret prompt or the confirmation writes nothing and exits 130", async () => {
    for (const script of [
      [cancelled],
      ["ssr", true, "@fixture/db-sqlite", "@fixture/ui-basic", ["@fixture/sentry"], cancelled],
      ["ssr", false, "@fixture/ui-basic", [], false]
    ] satisfies ScriptedAnswer[][]) {
      const result = await run(["init", "app", "demo"], { tty: true, script })
      expect(result.code).toBe(130)
      expect(files()).toEqual([])
    }
  })

  it("--json never prompts, even on a terminal", async () => {
    const result = await run(["init", "bare", "demo", "--json"], { tty: true })
    expect(result.code).toBe(1)
    expect(result.asked).toEqual([])
  })

  it("catalog --json describes the same questions the wizard asks", async () => {
    const result = await run(["catalog", "--json"])
    const description = describeCatalog(fixtureCatalog())
    expect(JSON.parse(result.out)).toEqual(description)
    const ssr = description.templates.find((template) => template.template === "app")?.questionsByMode.ssr
    expect(ssr?.slots.map((slot) => slot.question ?? slot.choose)).toEqual(["Add a database?", "Which UI kit?"])
    const human = await run(["catalog"])
    expect(human.out).toContain("App (app): A web app")
  })
})

describe("add and other commands", () => {
  async function project(extra: string[] = []) {
    const result = await run([...init, "--yes", ...extra])
    expect(result.code).toBe(0)
  }

  it("parses repeated and comma-separated add-on arguments", async () => {
    await project()
    const result = await run(["add", "i18n,auth", "--cwd", "demo", "--yes", "--json"])
    expect(envelope(result.out).status).toBe("applied")
    expect(readFileSync(join(root, "demo/fixture.jsonc"), "utf8")).toContain("@fixture/auth")
    const set = await run(["add", "i18n", "--set", "i18n.locales=en,de", "--cwd", "demo", "--yes", "--json"])
    expect(envelope(set.out).status).toBe("applied")
    expect(readFileSync(join(root, "demo/fixture.jsonc"), "utf8")).toContain('"locales":["en","de"]')
  })

  it("asks a slot's question later, and offers the replace decision on a terminal", async () => {
    await project(["--no-database"])
    const result = await run(["add", "database", "--cwd", "demo"], {
      tty: true,
      script: ["@fixture/db-postgres", "postgres://local", true]
    })
    expect(result.asked.map((question) => question.message)).toEqual([
      "Which database?",
      "DATABASE_URL: Connection string",
      "Apply these changes?"
    ])
    expect(readFileSync(join(root, "demo/fixture.jsonc"), "utf8")).toContain("@fixture/db-postgres")
    const replace = await run(["add", "--database", "db-sqlite", "--cwd", "demo"], {
      tty: true,
      script: ["replace", true]
    })
    expect(replace.code).toBe(0)
    expect(readFileSync(join(root, "demo/fixture.jsonc"), "utf8")).toContain("@fixture/db-sqlite")
    const blocked = await run(["add", "db-postgres", "--cwd", "demo", "--yes", "--json"])
    expect(blocked.code).toBe(1)
    expect(envelope(blocked.out).decisions?.[0]?.choices[0]?.argv).toEqual([
      "fixture",
      "add",
      "db-postgres",
      "--replace",
      "db-sqlite"
    ])
    expect((await run(["add", "--cwd", "demo", "--yes"])).code).toBe(2)
    expect((await run(["add", "--no-database", "--cwd", "demo", "--yes"])).code).toBe(2)
  })

  it("a change made during review fails apply with drift and exit 4", async () => {
    await project()
    const result = await run(["add", "i18n", "--cwd", "demo"], {
      tty: true,
      script: [
        () => {
          writeFileSync(join(root, "demo/package.json"), "{}\n")
          return true
        }
      ]
    })
    expect(result.code).toBe(4)
    expect(existsSync(join(root, "demo/src/i18n/setup.ts"))).toBe(false)
  })

  it("conflicts exit 3, and --resolve answers them", async () => {
    await project()
    writeFileSync(join(root, "demo/src/auth.ts"), "mine\n")
    const conflict = await run(["add", "auth", "--cwd", "demo", "--yes", "--json", "--out", "plans"])
    expect(conflict.code).toBe(3)
    expect(envelope(conflict.out).conflicts?.[0]).toMatchObject({
      id: "src/auth.ts",
      artifacts: expect.stringContaining("conflicts")
    })
    expect(readFileSync(join(root, "plans/conflicts/src_auth.ts/current"), "utf8")).toBe("mine\n")
    const human = await run(["add", "auth", "--cwd", "demo", "--yes"])
    expect(human.out).toContain('--resolve "src/auth.ts=keep-current|take-incoming|file:<path>"')
    writeFileSync(join(root, "merged.ts"), "merged\n")
    const resolved = await run([
      "add",
      "auth",
      "--cwd",
      "demo",
      "--yes",
      "--resolve",
      "src/auth.ts=file:merged.ts",
      "--json"
    ])
    expect(envelope(resolved.out).status).toBe("applied")
    expect(readFileSync(join(root, "demo/src/auth.ts"), "utf8")).toBe("merged\n")
    expect((await run(["sync", "--cwd", "demo", "--resolve", "x", "--yes"])).code).toBe(2)
    expect((await run(["sync", "--cwd", "demo", "--resolve", "x=maybe", "--yes"])).code).toBe(2)
    expect((await run(["sync", "--cwd", "demo", "--conflict", "loud", "--yes"])).code).toBe(2)
  })

  it("check fails while generated files are out of date or markers remain, and sync fixes them", async () => {
    await project()
    expect((await run(["check", "--cwd", "demo"])).code).toBe(0)
    writeFileSync(join(root, "demo/src/server.ts"), "edited\n")
    const stale = await run(["check", "--cwd", "demo", "--json"])
    expect(stale.code).toBe(4)
    expect(envelope(stale.out).error?.paths).toEqual(["src/server.ts"])
    writeFileSync(join(root, "demo/src/server.ts"), "export const server = true\n")
    const main = readFileSync(join(root, "demo/src/main.ts"), "utf8")
    writeFileSync(join(root, "demo/src/main.ts"), "<<<<<<< yours\na\n=======\nb\n>>>>>>> incoming\n")
    expect((await run(["check", "--cwd", "demo"])).code).toBe(4)
    writeFileSync(join(root, "demo/src/main.ts"), main)
    rmSync(join(root, "demo/.fixture/lock.json"))
    expect((await run(["check", "--cwd", "demo"])).code).toBe(4)
    expect((await run(["sync", "--cwd", "demo", "--yes"])).code).toBe(0)
  })

  it("config shows, gets and sets options", async () => {
    await project(["--with", "i18n"])
    expect((await run(["config", "--cwd", "demo"])).out).toContain('"template": "app"')
    expect(JSON.parse((await run(["config", "--cwd", "demo", "--json"])).out).template).toBe("app")
    expect((await run(["config", "get", "i18n.locales", "--cwd", "demo"])).out).toBe("null\n")
    const set = await run(["config", "set", "i18n.locales=en,fr", "--cwd", "demo", "--yes", "--json"])
    expect(envelope(set.out).status).toBe("applied")
    expect(JSON.parse((await run(["config", "get", "i18n", "--cwd", "demo", "--json"])).out)).toEqual({
      locales: ["en", "fr"]
    })
    expect((await run(["config", "set", "--cwd", "demo"])).code).toBe(2)
    expect((await run(["config", "get", "--cwd", "demo"])).code).toBe(2)
    expect((await run(["config", "frob", "--cwd", "demo"])).code).toBe(2)
    expect((await run(["config", "set", "auth.x=1", "--cwd", "demo", "--yes"])).code).toBe(2)
    expect((await run(["config", "--cwd", "elsewhere"])).code).toBe(2)
  })

  it("upgrade --list shows what changes, and upgrade applies it", async () => {
    await project()
    const v2 = fixtureCatalog(2)
    const list = await run(["upgrade", "--list", "--cwd", "demo", "--json"], { catalog: v2 })
    expect(envelope(list.out)).toMatchObject({
      status: "planned",
      upgrade: { catalog: { from: "1.0.0", to: "2.0.0" } },
      baseline: { source: "two-way" }
    })
    expect(readFileSync(join(root, "demo/fixture.jsonc"), "utf8")).not.toContain("level")
    const human = await run(["upgrade", "--list", "--cwd", "demo"], { catalog: v2 })
    expect(human.out).toContain("Migrations:")
    expect(human.out).toContain("Task: Remove suppressions")
    const applied = await run(["upgrade", "--cwd", "demo", "--yes", "--json"], { catalog: v2 })
    expect(envelope(applied.out).status).toBe("applied")
    expect(readFileSync(join(root, "demo/src/main.ts"), "utf8")).toContain("ready")
    const mismatch = await run(["add", "i18n", "--cwd", "demo", "--yes", "--json"])
    const decision = envelope(mismatch.out).decisions?.[0]
    expect(decision?.id).toBe("catalog-mismatch")
    const argv = decision?.choices[0]?.argv ?? []
    expect(argv).toEqual(["fixture", "upgrade", "--with", "i18n"])
    const carried = await run([...argv.slice(1), "--cwd", "demo", "--yes", "--json"])
    expect(envelope(carried.out).status).toBe("applied")
    expect(readFileSync(join(root, "demo/fixture.jsonc"), "utf8")).toContain("@fixture/i18n")
    const along = await run(["config", "set", "--with", "storybook", "--cwd", "demo", "--yes", "--json"])
    expect(envelope(along.out).status).not.toBe("error")
  })

  it("status, explain, schema and recover describe the project", async () => {
    await project(["--with", "i18n"])
    writeFileSync(join(root, "demo/src/server.ts"), "edited\n")
    const status = await run(["status", "--cwd", "demo"])
    expect(status.out).toContain("edited    src/server.ts (owned, from web)")
    expect(
      JSON.parse((await run(["status", "src", "--cwd", "demo", "--json"])).out).files.every((file: { path: string }) =>
        file.path.startsWith("src/")
      )
    ).toBe(true)
    expect((await run(["status", "--cwd", "elsewhere"])).out).toContain("Not a project yet.")
    expect((await run(["explain", "package.json", "--cwd", "demo"])).out).toContain(
      "/dependencies/@lingui~1core: @fixture/i18n (introduced)"
    )
    expect((await run(["explain", "sessions", "--cwd", "demo"])).out).toContain("not installed")
    expect((await run(["explain", "i18n", "--cwd", "demo"])).out).toContain(
      "Localization (@fixture/i18n@1.0.0) is installed."
    )
    expect((await run(["explain", "@fixture/i18n/lingui", "--cwd", "demo"])).out).toContain(
      "is an entry of vite.plugins"
    )
    const unknown = await run(["explain", "i18", "--cwd", "demo"])
    expect(unknown.code).toBe(2)
    expect(unknown.out).toContain("Did you mean @fixture/i18n?")
    expect(JSON.parse((await run(["explain", "src/main.ts", "--cwd", "demo", "--json"])).out)).toMatchObject({
      kind: "path",
      class: "seed",
      contributors: ["web"]
    })
    expect((await run(["explain", "--cwd", "demo"])).code).toBe(2)
    const schema = JSON.parse((await run(["schema", "--json"])).out)
    expect(Object.keys(schema)).toEqual(["config", "lock", "request"])
    expect(schema.config.properties.addons.properties["@fixture/i18n"].properties.locales.type).toBe("array")
    expect(envelope((await run(["recover", "--cwd", "demo", "--json"])).out).status).toBe("unchanged")
    expect((await run(["plan", "nope"])).code).toBe(2)
  })

  it("catalog fetch caches a version and checks its integrity before loading it", async () => {
    await project()
    const cached = join(root, "cache/catalogs/@fixture/catalog")
    const runCommand: CliOptions["runCommand"] = async (_command, args, cwd) => {
      const folder = join(cwd, "node_modules/@fixture/catalog")
      mkdirSync(folder, { recursive: true })
      writeFileSync(
        join(folder, "package.json"),
        JSON.stringify({ name: "@fixture/catalog", exports: { ".": { import: "./index.js" } } })
      )
      writeFileSync(
        join(folder, "index.js"),
        'export default { id: "@fixture/catalog", version: "0.9.0", facets: [], targets: [], templates: [], slots: [], addons: [] }\n'
      )
      writeFileSync(
        join(cwd, "package-lock.json"),
        JSON.stringify({ packages: { "node_modules/@fixture/catalog": { integrity: "sha512-test" } } })
      )
      return { code: args.includes("@fixture/catalog@0.9.0") ? 0 : 1, output: "npm ERR! not found" }
    }
    const fetched = await run(["catalog", "fetch", "0.9.0", "--cwd", "demo", "--json"], { runCommand })
    expect(envelope(fetched.out).notices?.[0]?.text).toContain("sha512-test")
    expect(JSON.parse(readFileSync(join(cached, "0.9.0/integrity.json"), "utf8")).integrity).toBe("sha512-test")
    const failed = await run(["catalog", "fetch", "0.8.0", "--cwd", "demo", "--json"], { runCommand })
    expect(envelope(failed.out).error?.code).toBe("E_BASELINE_UNAVAILABLE")
    const offline: CliOptions["runCommand"] = async () => ({ code: 1, output: "npm ERR! network" })
    const refetch = await run(["catalog", "fetch", "0.9.0", "--cwd", "demo", "--json"], { runCommand: offline })
    expect(envelope(refetch.out).error?.code).toBe("E_BASELINE_UNAVAILABLE")
    expect(existsSync(join(cached, "0.9.0/integrity.json"))).toBe(true)
    expect(existsSync(join(cached, "0.9.0.partial"))).toBe(false)
    expect((await run(["catalog", "fetch", "latest", "--cwd", "demo"], { runCommand })).code).toBe(2)
    expect((await run(["catalog", "fetch", "--cwd", "demo"])).code).toBe(2)
    expect((await run(["catalog", "frob"])).code).toBe(2)
    const lock = JSON.parse(readFileSync(join(root, "demo/.fixture/lock.json"), "utf8"))
    lock.catalog.version = "0.9.0"
    writeFileSync(join(root, "demo/.fixture/lock.json"), JSON.stringify(lock))
    const planned = await run(["sync", "--cwd", "demo", "--dry-run", "--json"])
    expect(envelope(planned.out).decisions?.[0]?.choices.map((choice) => choice.id)).toEqual(["upgrade", "recorded"])
    writeFileSync(
      join(cached, "0.9.0/integrity.json"),
      JSON.stringify({ name: "@fixture/catalog", version: "0.9.0", integrity: "sha512-other" })
    )
    const tampered = await run(["sync", "--cwd", "demo", "--dry-run", "--json"])
    expect(envelope(tampered.out).decisions?.[0]?.choices.map((choice) => choice.id)).toEqual(["upgrade"])
  })

  it("never imports a catalog cache that a project ships", async () => {
    await project()
    const marker = join(root, "imported")
    const planted = join(root, "demo/.fixture/catalogs/0.8.0")
    mkdirSync(join(planted, "node_modules/@fixture/catalog"), { recursive: true })
    writeFileSync(
      join(planted, "node_modules/@fixture/catalog/package.json"),
      JSON.stringify({ name: "@fixture/catalog", main: "index.js" })
    )
    writeFileSync(
      join(planted, "node_modules/@fixture/catalog/index.js"),
      `require("node:fs").writeFileSync(${JSON.stringify(marker)}, "x")
`
    )
    const integrity = { packages: { "node_modules/@fixture/catalog": { integrity: "sha512-planted" } } }
    writeFileSync(join(planted, "package-lock.json"), JSON.stringify(integrity))
    writeFileSync(
      join(planted, "integrity.json"),
      JSON.stringify({ name: "@fixture/catalog", version: "0.8.0", integrity: "sha512-planted" })
    )
    const lock = JSON.parse(readFileSync(join(root, "demo/.fixture/lock.json"), "utf8"))
    lock.catalog.version = "0.8.0"
    delete lock.catalog.integrity
    writeFileSync(join(root, "demo/.fixture/lock.json"), JSON.stringify(lock))
    const planned = await run(["sync", "--cwd", "demo", "--dry-run", "--json"])
    expect(envelope(planned.out).decisions?.[0]?.choices.map((choice) => choice.id)).toEqual(["upgrade"])
    expect(existsSync(marker)).toBe(false)
  })

  it("builds a citty command tree with every command and the catalog's slot flags", () => {
    const { cli } = options()
    const command = createCli(cli)
    const subCommands = command.subCommands
    expect(subCommands && typeof subCommands === "object" ? Object.keys(subCommands) : []).toEqual([
      "init",
      "add",
      "config",
      "upgrade",
      "sync",
      "check",
      "status",
      "explain",
      "plan",
      "catalog",
      "schema",
      "recover"
    ])
  })
})
