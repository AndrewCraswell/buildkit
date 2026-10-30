import { describe, expect, it } from "vite-plus/test"
import { defineAddon } from "../manifest/define.js"
import type { Contribution } from "../manifest/types.js"
import { readLock } from "../state/files.js"
import {
  addRequest,
  applyFixture,
  applyInMemory,
  fixtureCatalog,
  initRequest,
  planFixture,
  settings
} from "../testing/fixture.js"
import { plan } from "./plan.js"
import { memoryTree } from "./tree.js"

const lockFile = ".fixture/lock.json"

async function project(answers = {}) {
  return applyFixture({}, initRequest(answers))
}

function lockOf(files: Record<string, string>) {
  return readLock(lockFile, files[lockFile] ?? "")
}

describe("planning", () => {
  it("gives the same plan, serialized form and fingerprint for the same request", async () => {
    const first = await planFixture({}, initRequest())
    const second = await planFixture({}, initRequest())
    expect(JSON.stringify(second)).toBe(JSON.stringify(first))
    expect(first.fingerprint).toMatch(/^[0-9a-f]{64}$/)
    const other = await planFixture({}, initRequest({ optional: ["@fixture/i18n"] }))
    expect(other.fingerprint).not.toBe(first.fingerprint)
  })

  it("creates every contributed file, the config and the lock, with the lock last", async () => {
    const planned = await planFixture({}, initRequest())
    expect(planned.status).toBe("planned")
    expect(planned.operations.at(-1)?.path).toBe(lockFile)
    expect(planned.operations.map((operation) => operation.path)).toEqual(
      expect.arrayContaining(["package.json", "src/main.ts", "AGENTS.md", "fixture.jsonc", ".fixture/.gitignore"])
    )
    expect(planned.required).toEqual(["@fixture/lint"])
    const lock = readLock(lockFile, planned.operations.at(-1)?.content ?? "")
    expect(lock.lastApply?.fingerprint).toBe(planned.fingerprint)
  })

  it("re-planning an applied project is unchanged, and init refuses an existing project", async () => {
    const files = await project()
    expect((await planFixture(files, { intent: { command: "sync" } })).status).toBe("unchanged")
    const again = await planFixture(files, initRequest())
    expect(again.error?.code).toBe("E_ALREADY_INITIALIZED")
  })

  it("lists only the add-ons a plan brings in, not ones the project already has", async () => {
    const files = await applyFixture(await project(), addRequest(["@fixture/sessions"]))
    const added = await planFixture(files, addRequest(["@fixture/auth"]))
    expect(added.status).toBe("planned")
    expect(added.required).toEqual([])
    expect(added.pulled.map((pulled) => pulled.id)).not.toContain("@fixture/sessions")
    const fresh = await planFixture(await project(), addRequest(["@fixture/auth"]))
    expect(fresh.pulled.map((pulled) => pulled.id)).toContain("@fixture/sessions")
  })

  it("commands other than init need a project", async () => {
    for (const request of [
      addRequest(["i18n"]),
      { intent: { command: "sync" as const } },
      { intent: { command: "upgrade" as const } },
      { intent: { command: "config" as const, options: {} } }
    ]) {
      expect((await planFixture({}, request)).error?.code).toBe("E_NOT_INITIALIZED")
    }
  })
})

describe("ownership", () => {
  it("keeps your edits and deletions of sample files", async () => {
    const files = await project()
    const edited = { ...files, "AGENTS.md": "# Mine\n" }
    const deleted = { ...files }
    delete deleted["AGENTS.md"]
    const keep = await planFixture(edited, addRequest(["i18n"]))
    expect(keep.operations.find((operation) => operation.path === "AGENTS.md")).toBeUndefined()
    const gone = applyInMemory(deleted, await planFixture(deleted, addRequest(["i18n"])))
    expect(gone["AGENTS.md"]).toBeUndefined()
    expect(lockOf(gone).deleted).toContain("AGENTS.md")
  })

  it("a new path that already exists is a conflict, and an identical one is adopted", async () => {
    const files = await project()
    const clash = await planFixture({ ...files, "src/sessions.ts": "mine\n" }, addRequest(["auth"]))
    expect(clash.status).toBe("conflict")
    expect(clash.conflicts[0]).toMatchObject({ id: "src/sessions.ts", kind: "exists" })
    expect(clash.operations.find((operation) => operation.path === "src/sessions.ts")).toBeUndefined()
    const same = await planFixture(
      { ...files, "src/sessions.ts": "export const sessions = true\r\n" },
      addRequest(["auth"])
    )
    expect(same.status).toBe("planned")
    expect(same.operations.find((operation) => operation.path === "src/sessions.ts")).toBeUndefined()
  })

  it("deletes an unedited orphan, keeps an edited one as a conflict, and removes the dependency it introduced", async () => {
    const files = await applyFixture(await project(), addRequest(["auth"]))
    const replaced = await planFixture(files, addRequest(["db-postgres"], ["db-sqlite"]))
    expect(replaced.status).toBe("planned")
    const sqliteOnly = await planFixture(files, { intent: { command: "sync" } })
    expect(sqliteOnly.status).toBe("unchanged")
    const config = (files["fixture.jsonc"] ?? "").replace('"@fixture/auth": {},\n', "")
    const removed = await planFixture({ ...files, "fixture.jsonc": config }, { intent: { command: "sync" } })
    expect(removed.operations.find((operation) => operation.path === "src/sessions.ts")?.action).toBe("delete")
    const editedOrphan = await planFixture(
      { ...files, "fixture.jsonc": config, "src/sessions.ts": "edited\n" },
      { intent: { command: "sync" } }
    )
    expect(editedOrphan.conflicts).toEqual([expect.objectContaining({ id: "src/sessions.ts", kind: "orphan-edited" })])
  })

  it("an orphan that can't be verified against the old baseline stays yours", async () => {
    const files = await applyFixture(await project(), addRequest(["auth"]))
    const lock = lockOf(files)
    const entry = lock.files["src/sessions.ts"]
    if (entry?.class !== "owned") {
      throw new Error("expected an owned entry")
    }
    lock.files["src/sessions.ts"] = { ...entry, genHash: "0".repeat(64), diskHash: "0".repeat(64) }
    const config = (files["fixture.jsonc"] ?? "").replace('"@fixture/auth": {},\n', "")
    const planned = await planFixture(
      { ...files, [lockFile]: JSON.stringify(lock), "fixture.jsonc": config },
      { intent: { command: "sync" } }
    )
    expect(planned.operations.find((operation) => operation.path === "src/sessions.ts")).toBeUndefined()
    expect(planned.notices).toContainEqual(expect.objectContaining({ code: "orphan-kept", path: "src/sessions.ts" }))
  })

  it("an edited generated file is a conflict when it's regenerated, and resolutions answer it", async () => {
    const files = await project()
    const edited = { ...files, ".oxlintrc.json": '{ "mine": true }\n' }
    const sync = await planFixture(edited, { intent: { command: "sync" } })
    expect(sync.status).toBe("unchanged")
    expect(sync.notices).toContainEqual(expect.objectContaining({ code: "owned-edited", path: ".oxlintrc.json" }))
    const request = { intent: { command: "config" as const, options: { "@fixture/lint": { strict: false } } } }
    const conflict = await planFixture(edited, request)
    expect(conflict.conflicts).toEqual([expect.objectContaining({ id: ".oxlintrc.json", kind: "edited" })])
    const take = await planFixture(edited, { ...request, resolve: { ".oxlintrc.json": "take-incoming" } })
    expect(take.operations.find((operation) => operation.path === ".oxlintrc.json")?.content).toContain(
      '"strict": false'
    )
    const keep = applyInMemory(
      edited,
      await planFixture(edited, { ...request, resolve: { ".oxlintrc.json": "keep-current" } })
    )
    expect(keep[".oxlintrc.json"]).toBe(edited[".oxlintrc.json"])
    expect((await planFixture(keep, { intent: { command: "sync" } })).status).toBe("unchanged")
    const file = await planFixture(edited, { ...request, resolve: { ".oxlintrc.json": { content: "{}\n" } } })
    expect(file.operations.find((operation) => operation.path === ".oxlintrc.json")?.content).toBe("{}\n")
  })

  it("deleting a generated file is a decision: recreate it, or keep it deleted", async () => {
    const files = await project()
    const deleted = { ...files }
    delete deleted[".oxlintrc.json"]
    const request = { intent: { command: "config" as const, options: { "@fixture/lint": { strict: false } } } }
    const asked = await planFixture(deleted, request)
    expect(asked.conflicts).toEqual([expect.objectContaining({ id: ".oxlintrc.json", kind: "deleted" })])
    const recreated = await planFixture(deleted, { ...request, resolve: { ".oxlintrc.json": "take-incoming" } })
    expect(recreated.operations.find((operation) => operation.path === ".oxlintrc.json")?.action).toBe("create")
    const kept = applyInMemory(
      deleted,
      await planFixture(deleted, { ...request, resolve: { ".oxlintrc.json": "keep-current" } })
    )
    expect(lockOf(kept).deleted).toContain(".oxlintrc.json")
    expect((await planFixture(kept, { intent: { command: "sync" } })).notices).toContainEqual(
      expect.objectContaining({ code: "stays-deleted" })
    )
  })

  it("a deleted seed file stays deleted", async () => {
    const files = await project()
    delete files["src/db/schema.ts"]
    const next = applyInMemory(files, await planFixture(files, { intent: { command: "sync" } }))
    expect(next["src/db/schema.ts"]).toBeUndefined()
    expect(lockOf(next).deleted).toContain("src/db/schema.ts")
  })

  it("changing a file's class needs a decision only when you edited it", async () => {
    const files = await project()
    const catalog = fixtureCatalog()
    const lint = catalog.addons.find((addon) => addon.id === "@fixture/lint")
    if (!lint) {
      throw new Error("missing lint")
    }
    const seeded = {
      ...catalog,
      addons: catalog.addons.map((addon) =>
        addon === lint
          ? {
              ...lint,
              contribute: (ctx: Parameters<typeof lint.contribute>[0]) =>
                lint
                  .contribute(ctx)
                  .map((contribution) =>
                    contribution.kind === "file" ? { ...contribution, ownership: "seed" as const } : contribution
                  )
            }
          : addon
      )
    }
    const clean = await plan({
      catalog: seeded,
      settings,
      tree: memoryTree(files),
      request: { intent: { command: "sync" } }
    })
    expect(clean.status).toBe("planned")
    expect(clean.operations.map((operation) => operation.path)).toEqual([lockFile])
    const edited = await plan({
      catalog: seeded,
      settings,
      tree: memoryTree({ ...files, ".oxlintrc.json": "{}\n" }),
      request: { intent: { command: "sync" } }
    })
    expect(edited.conflicts).toEqual([expect.objectContaining({ kind: "class-change" })])
  })

  it("normalizes line endings, a BOM and the final newline before comparing", async () => {
    const files = await project()
    const crlf = Object.fromEntries(
      Object.entries(files).map(([path, content]) => [path, `﻿${content.replaceAll("\n", "\r\n")}\r\n\r\n`])
    )
    crlf[lockFile] = files[lockFile] ?? ""
    crlf["fixture.jsonc"] = files["fixture.jsonc"] ?? ""
    const sync = await planFixture(crlf, { intent: { command: "sync" } })
    expect(sync.status).toBe("unchanged")
    const added = await planFixture(crlf, addRequest(["storybook"]))
    expect(added.status).toBe("unchanged")
    const i18n = await planFixture(crlf, addRequest(["i18n"]))
    const packageJson = i18n.operations.find((operation) => operation.path === "package.json")?.content ?? ""
    expect(packageJson.startsWith("﻿")).toBe(true)
    expect(packageJson).toContain("\r\n")
    expect(packageJson).toContain("@lingui/core")
  })
})

describe("shared JSON files", () => {
  it("merges by key, keeps your own fields, and re-applying is a no-op", async () => {
    const files = await project()
    const mine = JSON.parse(files["package.json"] ?? "{}")
    mine.scripts.test = "vitest"
    mine.description = "Mine"
    const edited = { ...files, "package.json": `${JSON.stringify(mine, null, 2)}\n` }
    const next = applyInMemory(edited, await planFixture(edited, addRequest(["i18n"])))
    const merged = JSON.parse(next["package.json"] ?? "{}")
    expect(merged).toMatchObject({
      description: "Mine",
      scripts: { test: "vitest" },
      dependencies: { "@lingui/core": "6.10.1" }
    })
    expect((await planFixture(next, addRequest(["i18n"]))).status).toBe("unchanged")
  })

  it("a key both sides changed is a conflict, and nothing is written", async () => {
    const files = await project()
    const lock = lockOf(files)
    const entry = lock.files["package.json"]
    if (entry?.class !== "shared") {
      throw new Error("expected shared")
    }
    entry.keys["/devDependencies/vite"] = { base: "7.0.0", provenance: "introduced" }
    const edited = {
      ...files,
      [lockFile]: JSON.stringify(lock),
      "package.json": (files["package.json"] ?? "").replace('"vite": "8.0.0"', '"vite": "9.0.0"')
    }
    const planned = await planFixture(edited, { intent: { command: "sync" } })
    expect(planned.status).toBe("conflict")
    expect(planned.conflicts[0]).toMatchObject({ id: "package.json#/devDependencies/vite", kind: "both-changed" })
    expect(planned.operations).toEqual([])
  })

  it("keys you already had are adopted and never removed", async () => {
    const existing = { "package.json": '{ "name": "demo", "dependencies": { "react": "19.3.1" } }\n' }
    const files = await applyFixture(existing, initRequest({ adopt: true }))
    const entry = lockOf(files).files["package.json"]
    expect(entry?.class === "shared" && entry.keys["/dependencies/react"]?.provenance).toBe("adopted")
  })

  it("replacing within a slot removes the introduced dependency, adds the new one, and keeps your script", async () => {
    const files = await project()
    const mine = JSON.parse(files["package.json"] ?? "{}")
    mine.scripts.db = "drizzle-kit studio"
    const edited = { ...files, "package.json": `${JSON.stringify(mine, null, 2)}\n` }
    const replaced = await planFixture(edited, addRequest(["db-postgres"], ["db-sqlite"]))
    const merged = JSON.parse(
      replaced.operations.find((operation) => operation.path === "package.json")?.content ?? "{}"
    )
    expect(merged.dependencies).toMatchObject({ pg: "8.16.0", "drizzle-orm": "0.45.4" })
    expect(merged.scripts.db).toBe("drizzle-kit studio")
    const lint = JSON.parse(
      (await planFixture(edited, addRequest(["ui-fancy"], ["ui-basic"]))).operations.find(
        (operation) => operation.path === "package.json"
      )?.content ?? "null"
    )
    expect(lint).toBeNull()
  })

  it("any conflict blocks the whole apply", async () => {
    const files = await project()
    const planned = await planFixture({ ...files, "src/auth.ts": "mine\n" }, addRequest(["auth"]))
    // The other changes are listed for review, but a conflict plan can't be applied.
    expect(planned.status).toBe("conflict")
    expect(planned.operations.map((operation) => operation.path)).toContain("src/sessions.ts")
  })

  it("two add-ons setting one key to different values is a plan error naming both", async () => {
    const catalog = fixtureCatalog()
    catalog.addons.push(
      defineAddon({
        id: "@fixture/other-lint",
        version: "1.0.0",
        title: "Other lint",
        description: "",
        contribute: () => [{ kind: "script", name: "lint", command: "eslint" }]
      })
    )
    const planned = await plan({
      catalog,
      settings,
      tree: memoryTree({}),
      request: initRequest({ optional: ["@fixture/other-lint"] })
    })
    expect(planned.error?.code).toBe("E_CONTRIBUTION")
    expect(planned.error?.message).toContain("@fixture/lint")
    expect(planned.error?.message).toContain("@fixture/other-lint")
  })

  it("an unsafe key in a JSON file is an error naming the file", async () => {
    const files = await project()
    const planned = await planFixture(
      { ...files, "package.json": '{ "__proto__": { "polluted": true } }\n' },
      addRequest(["i18n"])
    )
    expect(planned.error).toMatchObject({ code: "E_UNSAFE_KEY", paths: ["package.json"] })
  })

  it("a JSON file you made invalid is a conflict that only keep-current answers", async () => {
    const files = await project()
    const broken = { ...files, "package.json": "{ not json" }
    const planned = await planFixture(broken, addRequest(["i18n"]))
    expect(planned.conflicts).toEqual([
      expect.objectContaining({ id: "package.json", kind: "invalid", resolutions: ["keep-current"] })
    ])
    const kept = await planFixture(broken, { ...addRequest(["i18n"]), resolve: { "package.json": "keep-current" } })
    expect(kept.status).toBe("planned")
    expect(kept.operations.find((operation) => operation.path === "package.json")).toBeUndefined()
  })

  it("a dependency you moved to another section is a conflict when the engine changes it", async () => {
    const files = await project()
    const moved = JSON.parse(files["package.json"] ?? "{}")
    delete moved.dependencies.react
    moved.devDependencies.react = "19.3.1"
    const edited = { ...files, "package.json": `${JSON.stringify(moved, null, 2)}\n` }
    expect((await planFixture(edited, { intent: { command: "sync" } })).status).toBe("unchanged")
    const lock = lockOf(edited)
    lock.files["package.json"] = { class: "shared", format: "json", keys: {} }
    const fresh = await planFixture({ ...edited, [lockFile]: JSON.stringify(lock) }, { intent: { command: "sync" } })
    expect(fresh.conflicts).toContainEqual(
      expect.objectContaining({ id: "package.json#/dependencies/react", kind: "moved" })
    )
    const taken = await planFixture(
      { ...edited, [lockFile]: JSON.stringify(lock) },
      { intent: { command: "sync" }, resolve: { "package.json#/dependencies/react": "take-incoming" } }
    )
    const result = JSON.parse(taken.operations.find((operation) => operation.path === "package.json")?.content ?? "{}")
    expect(result.dependencies.react).toBe("19.3.1")
    expect(result.devDependencies.react).toBeUndefined()
  })

  it("a file you deleted that the engine wants to update is a conflict", async () => {
    const files = await project()
    const deleted = { ...files }
    delete deleted["package.json"]
    expect((await planFixture(deleted, { intent: { command: "sync" } })).status).toBe("unchanged")
    const lock = lockOf(files)
    const entry = lock.files["package.json"]
    if (entry?.class !== "shared") {
      throw new Error("expected shared")
    }
    entry.keys["/dependencies/react"] = { base: "18.0.0", provenance: "introduced" }
    const planned = await planFixture({ ...deleted, [lockFile]: JSON.stringify(lock) }, { intent: { command: "sync" } })
    expect(planned.conflicts).toContainEqual(
      expect.objectContaining({ id: "package.json#/dependencies/react", kind: "deleted" })
    )
  })

  it("set arrays and keyed arrays merge by item", async () => {
    const files = await project()
    const tsconfig = JSON.parse(files["tsconfig.json"] ?? "{}")
    expect(tsconfig.include).toEqual(["src"])
    tsconfig.include.push("tests")
    const edited = { ...files, "tsconfig.json": `${JSON.stringify(tsconfig, null, 2)}\n` }
    const added = applyInMemory(edited, await planFixture(edited, addRequest(["i18n"])))
    expect(JSON.parse(added["tsconfig.json"] ?? "{}").include).toEqual(["src", "tests", "locales"])
    const config = (added["fixture.jsonc"] ?? "").replace('"@fixture/i18n": {},\n', "")
    const removed = applyInMemory(
      added,
      await planFixture({ ...added, "fixture.jsonc": config }, { intent: { command: "sync" } })
    )
    expect(JSON.parse(removed["tsconfig.json"] ?? "{}").include).toEqual(["src", "tests"])
    const catalog = fixtureCatalog()
    catalog.addons.push(
      defineAddon({
        id: "@fixture/ci",
        version: "1.0.0",
        title: "CI",
        description: "",
        contribute: () => [
          {
            kind: "json",
            path: "ci.json",
            pointer: "/steps",
            op: "append",
            key: "id",
            value: [
              { id: "lint", run: "pnpm lint" },
              { id: "test", run: "pnpm test" }
            ]
          }
        ]
      })
    )
    const ci = applyInMemory(
      {},
      await plan({ catalog, settings, tree: memoryTree({}), request: initRequest({ optional: ["@fixture/ci"] }) })
    )
    const steps = JSON.parse(ci["ci.json"] ?? "{}")
    steps.steps[1].run = "pnpm test --coverage"
    steps.steps.push({ id: "mine", run: "echo" })
    const editedCi = { ...ci, "ci.json": JSON.stringify(steps) }
    const synced = await plan({
      catalog,
      settings,
      tree: memoryTree(editedCi),
      request: { intent: { command: "sync" } }
    })
    expect(synced.status).toBe("unchanged")
  })

  it("`.gitignore` lines you already had are adopted, and secret-like lines need an answer to remove", async () => {
    const existing = { ".gitignore": "node_modules\n.DS_Store\n" }
    const files = await applyFixture(existing, initRequest({ adopt: true }))
    const entry = lockOf(files).files[".gitignore"]
    expect(entry?.class === "shared" && entry.keys["node_modules"]?.provenance).toBe("adopted")
    expect(entry?.class === "shared" && entry.keys[".env"]?.provenance).toBe("introduced")
    expect(files[".gitignore"]).toBe("node_modules\n.DS_Store\ndist\n.env\nstorybook-static\n")
    const catalog = fixtureCatalog()
    const target = catalog.targets[0]
    if (!target) {
      throw new Error("missing target")
    }
    const without = {
      ...catalog,
      targets: [
        {
          ...target,
          base: (ctx: Parameters<typeof target.base>[0]) =>
            target.base(ctx).filter((contribution) => contribution.kind !== "lines")
        }
      ]
    }
    const planned = await plan({
      catalog: without,
      settings,
      tree: memoryTree(files),
      request: { intent: { command: "sync" } }
    })
    expect(planned.conflicts).toEqual([expect.objectContaining({ id: ".gitignore#.env", kind: "secret-pattern" })])
    const removed = await plan({
      catalog: without,
      settings,
      tree: memoryTree(files),
      request: { intent: { command: "sync" }, resolve: { ".gitignore#.env": "take-incoming" } }
    })
    expect(removed.operations.find((operation) => operation.path === ".gitignore")?.content).toBe(
      "node_modules\n.DS_Store\nstorybook-static\n"
    )
  })
})

describe("YAML and adoption", () => {
  it("edits YAML by key and keeps your comments", async () => {
    const catalog = fixtureCatalog()
    catalog.addons.push(
      defineAddon({
        id: "@fixture/ci",
        version: "1.0.0",
        title: "CI",
        description: "",
        contribute: () => [
          {
            kind: "yaml",
            path: ".github/workflows/ci.yml",
            pointer: "/jobs/verify/steps",
            op: "append",
            key: "id",
            value: [{ id: "lint", run: "pnpm lint" }]
          },
          { kind: "yaml", path: ".github/workflows/ci.yml", pointer: "/name", op: "set", value: "CI" }
        ]
      })
    )
    const existing = {
      ".github/workflows/ci.yml":
        "# Our CI\non: push\njobs:\n  verify:\n    steps:\n      - id: checkout # keep\n        uses: actions/checkout@v4\n"
    }
    const planned = await plan({
      catalog,
      settings,
      tree: memoryTree(existing),
      request: initRequest({ optional: ["@fixture/ci"], adopt: true })
    })
    const files = applyInMemory(existing, planned)
    expect(files[".github/workflows/ci.yml"]).toContain("# keep")
    expect(files[".github/workflows/ci.yml"]).toContain("- id: lint\n        run: pnpm lint")
    expect(files[".github/workflows/ci.yml"]).toContain("name: CI")
    expect(
      (await plan({ catalog, settings, tree: memoryTree(files), request: { intent: { command: "sync" } } })).status
    ).toBe("unchanged")
  })

  it("puts an ordered item after the item it follows, in a new file and in yours", async () => {
    const workflow = ".github/workflows/ci.yml"
    const catalog = fixtureCatalog()
    const steps = (value: unknown, order?: { after?: string[]; before?: string[] }): Contribution => ({
      kind: "yaml",
      path: workflow,
      pointer: "/jobs/verify/steps",
      op: "append",
      key: "id",
      value,
      ...(order ? { order } : {})
    })
    catalog.addons.push(
      defineAddon({
        id: "@fixture/ci",
        version: "1.0.0",
        title: "CI",
        description: "",
        contribute: () => [
          steps([
            { id: "lint", run: "pnpm lint" },
            { id: "build", run: "pnpm build" }
          ])
        ]
      }),
      defineAddon({
        id: "@fixture/translations",
        version: "1.0.0",
        title: "Translations",
        description: "",
        after: ["@fixture/ci"],
        contribute: () => [
          steps({ id: "translations", run: "pnpm i18n:check" }, { after: ["lint", "missing"] }),
          steps({ id: "first", run: "echo" }, { before: ["build", "lint"] }),
          steps({ id: "last", run: "echo" }, { after: ["missing"] })
        ]
      })
    )
    const ids = (text: string | undefined) => [...(text ?? "").matchAll(/- id: (\w+)/g)].map((found) => found[1])
    const request = initRequest({ optional: ["@fixture/ci", "@fixture/translations"] })
    const created = applyInMemory({}, await plan({ catalog, settings, tree: memoryTree({}), request }))
    expect(ids(created[workflow])).toEqual(["first", "lint", "translations", "build", "last"])
    const yours = { [workflow]: "jobs:\n  verify:\n    steps:\n      - id: build\n        run: pnpm build\n" }
    const adopted = applyInMemory(
      yours,
      await plan({
        catalog,
        settings,
        tree: memoryTree(yours),
        request: initRequest({ optional: ["@fixture/ci", "@fixture/translations"], adopt: true })
      })
    )
    expect(ids(adopted[workflow])).toEqual(["first", "build", "lint", "translations", "last"])

    const unkeyed = fixtureCatalog()
    unkeyed.addons.push(
      defineAddon({
        id: "@fixture/ci",
        version: "1.0.0",
        title: "CI",
        description: "",
        contribute: () => [
          { kind: "json", path: "ci.json", pointer: "/steps", op: "append", value: "lint", order: { after: ["x"] } }
        ]
      })
    )
    const refused = await plan({
      catalog: unkeyed,
      settings,
      tree: memoryTree({}),
      request: initRequest({ optional: ["@fixture/ci"] })
    })
    expect(refused.error?.message).toContain("only items of a keyed array can be ordered")
  })

  it("adopting keeps existing files yours and runs the target's codemods once", async () => {
    const existing = { "README.md": "# Demo\n", "src/main.ts": "console.log('mine')\n" }
    const planned = await planFixture(existing, initRequest({ adopt: true }))
    expect(planned.notices).toContainEqual(expect.objectContaining({ code: "kept-yours", path: "src/main.ts" }))
    expect(planned.operations.find((operation) => operation.path === "src/main.ts")).toBeUndefined()
    expect(planned.operations.find((operation) => operation.path === "README.md")).toMatchObject({
      class: "user",
      content: "# Demo\n\nManaged by fixture.\n"
    })
    const files = applyInMemory(existing, planned)
    expect(lockOf(files).files["src/main.ts"]).toBeUndefined()
  })
})

describe("state", () => {
  it("refuses an unsupported lock schema version", async () => {
    const files = await project()
    const planned = await planFixture(
      { ...files, [lockFile]: '{ "schemaVersion": 2 }' },
      { intent: { command: "sync" } }
    )
    expect(planned.error?.code).toBe("E_LOCK_VERSION")
  })

  it("refuses to plan while the config or lock has conflict markers", async () => {
    const files = await project()
    const planned = await planFixture(
      { ...files, "fixture.jsonc": `<<<<<<< ours\n${files["fixture.jsonc"]}=======\n>>>>>>> theirs\n` },
      { intent: { command: "sync" } }
    )
    expect(planned.error?.code).toBe("E_CONFLICT_MARKERS")
  })

  it("the config round-trips: what's written resolves back to the same selection", async () => {
    const files = await project({
      optional: ["@fixture/i18n"],
      options: { "@fixture/i18n": { locales: ["en", "fr"] } }
    })
    expect(files["fixture.jsonc"]).toContain('"@fixture/i18n": { "locales": ["en", "fr"] }')
    expect((await planFixture(files, { intent: { command: "sync" } })).status).toBe("unchanged")
    const lock = lockOf(files)
    expect(lock.addons["@fixture/i18n"]).toMatchObject({ explicit: true, options: { locales: ["en", "fr"] } })
    const commented = { ...files, "fixture.jsonc": (files["fixture.jsonc"] ?? "").replace("{\n", "{\n  // keep me\n") }
    const added = await planFixture(commented, addRequest(["auth"]))
    expect(added.operations.find((operation) => operation.path === "fixture.jsonc")?.content).toContain("// keep me")
  })

  it("rebuilds a missing lock with sync, adopting files that match", async () => {
    const files = await project()
    delete files[lockFile]
    const planned = await planFixture(files, { intent: { command: "sync" } })
    expect(planned.status).toBe("planned")
    expect(planned.operations.map((operation) => operation.path)).toEqual([lockFile])
  })

  it(".env files show as secret, and the lock holds no secret values", async () => {
    const catalog = fixtureCatalog()
    catalog.addons.push(
      defineAddon({
        id: "@fixture/dotenv",
        version: "1.0.0",
        title: "Dotenv",
        description: "",
        contribute: () => [{ kind: "file", path: ".env", content: "TOKEN=\n", ownership: "sample" }]
      })
    )
    const planned = await plan({
      catalog,
      settings,
      tree: memoryTree({}),
      request: initRequest({ optional: ["@fixture/dotenv", "@fixture/sentry"] })
    })
    expect(planned.operations.find((operation) => operation.path === ".env")?.secret).toBe(true)
    expect(planned.operations.find((operation) => operation.path === ".env.example")?.secret).toBeUndefined()
    expect(planned.env).toContainEqual(expect.objectContaining({ name: "SENTRY_DSN", secret: true }))
    expect(planned.operations.find((operation) => operation.path === ".env.example")?.content).toContain(
      "SENTRY_DSN=\n"
    )
  })
})

describe("upgrade", () => {
  const v1 = fixtureCatalog(1)
  const catalogs = (version: string) => (version === "1.0.0" ? v1 : undefined)

  it("a choice an upgrade needs stays an upgrade, so it finishes", async () => {
    const files = await project({ slots: { database: null } })
    const v2 = fixtureCatalog(2)
    const strict = {
      ...v2,
      addons: v2.addons.map((addon) =>
        addon.id === "@fixture/lint" ? { ...addon, requires: ["slot:database"] } : addon
      )
    }
    const planned = await planFixture(files, { intent: { command: "upgrade" } }, { catalog: strict, catalogs })
    expect(planned.status).toBe("needs-decision")
    const [first] = planned.decisions[0]?.choices ?? []
    expect(first?.request).toEqual({ intent: { command: "upgrade", addons: ["@fixture/db-sqlite"] } })
    if (!first) {
      throw new Error("missing choice")
    }
    const upgraded = await planFixture(files, first.request, { catalog: strict, catalogs })
    expect(upgraded.status).toBe("planned")
    expect(upgraded.operations.find((operation) => operation.path === "fixture.jsonc")?.content).toContain(
      "@fixture/db-sqlite"
    )
  })

  it("merges your seed edits with the new version, runs migrations and lists agent tasks", async () => {
    const files = await project()
    const edited = { ...files, "src/main.ts": `// note\n${files["src/main.ts"]}`, "scripts/ci.sh": "npm run lint\n" }
    const planned = await planFixture(
      edited,
      { intent: { command: "upgrade" } },
      { catalog: fixtureCatalog(2), catalogs }
    )
    expect(planned.status).toBe("planned")
    expect(planned.baseline).toEqual({ source: "cache", catalogVersion: "1.0.0" })
    expect(planned.merged).toEqual([{ path: "src/main.ts", hunks: 1 }])
    expect(planned.migrations.map((migration) => migration.kind)).toEqual(["options", "codemod", "agent"])
    expect(planned.upgrade).toEqual({
      catalog: { from: "1.0.0", to: "2.0.0" },
      packs: [],
      addons: [{ id: "@fixture/lint", from: "1.0.0", to: "1.1.0" }]
    })
    const next = applyInMemory(edited, planned)
    expect(next["src/main.ts"]).toMatch(/^\/\/ note\n[\s\S]*export const ready = true\n$/)
    expect(next["scripts/ci.sh"]).toBe("pnpm lint\n")
    expect(next["fixture.jsonc"]).toContain('"@fixture/lint": { "level": "strict" }')
    expect(lockOf(next).catalog.version).toBe("2.0.0")
    expect((await planFixture(next, { intent: { command: "sync" } }, { catalog: fixtureCatalog(2) })).status).toBe(
      "unchanged"
    )
  })

  it("a seed edit on the same lines is a conflict, or conflict markers when asked", async () => {
    const files = await project()
    const edited = {
      ...files,
      "src/main.ts": (files["src/main.ts"] ?? "").replace("}\n", "}\n\nexport const ready = false\n")
    }
    const conflict = await planFixture(
      edited,
      { intent: { command: "upgrade" } },
      { catalog: fixtureCatalog(2), catalogs }
    )
    expect(conflict.conflicts).toEqual([expect.objectContaining({ id: "src/main.ts", kind: "merge" })])
    expect(conflict.conflicts[0]?.base).toBe(files["src/main.ts"])
    const markers = await planFixture(
      edited,
      { intent: { command: "upgrade" }, conflictStyle: "markers" },
      { catalog: fixtureCatalog(2), catalogs }
    )
    expect(markers.status).toBe("planned")
    expect(markers.operations.find((operation) => operation.path === "src/main.ts")?.content).toContain("<<<<<<< yours")
  })

  it("without the old catalog, an edited seed can't be merged and needs a decision", async () => {
    const files = await project()
    const edited = { ...files, "src/main.ts": `// note\n${files["src/main.ts"]}` }
    const planned = await planFixture(edited, { intent: { command: "upgrade" } }, { catalog: fixtureCatalog(2) })
    expect(planned.baseline).toEqual({ source: "two-way", catalogVersion: "1.0.0" })
    expect(planned.conflicts).toEqual([expect.objectContaining({ id: "src/main.ts", kind: "baseline-unverified" })])
    const unedited = await planFixture(files, { intent: { command: "upgrade" } }, { catalog: fixtureCatalog(2) })
    expect(unedited.status).toBe("planned")
  })

  it("with stored seed bases, an edited seed merges without the old catalog", async () => {
    const stored = { ...settings, seedBases: "stored" as const }
    const files = await applyFixture({}, initRequest(), { settings: stored })
    expect(lockOf(files).files["src/main.ts"]).toEqual(expect.objectContaining({ base: files["src/main.ts"] }))
    const edited = { ...files, "src/main.ts": `// note\n${files["src/main.ts"]}` }
    const planned = await planFixture(
      edited,
      { intent: { command: "upgrade" } },
      { catalog: fixtureCatalog(2), settings: stored }
    )
    expect(planned.baseline).toEqual({ source: "stored", catalogVersion: "1.0.0" })
    expect(planned.conflicts).toEqual([])
    expect(planned.merged).toEqual([{ path: "src/main.ts", hunks: 1 }])
    const next = applyInMemory(edited, planned)
    expect(next["src/main.ts"]).toMatch(/^\/\/ note\n[\s\S]*export const ready = true\n$/)
    const generated = await applyFixture({}, initRequest(), { catalog: fixtureCatalog(2), settings: stored })
    expect(lockOf(next).files["src/main.ts"]).toEqual(expect.objectContaining({ base: generated["src/main.ts"] }))
  })

  it("records seed bases on the next sync once the product stores them, and never trusts a base that doesn't hash", async () => {
    const stored = { ...settings, seedBases: "stored" as const }
    const files = await project()
    expect(lockOf(files).files["src/main.ts"]).not.toHaveProperty("base")
    const synced = applyInMemory(files, await planFixture(files, { intent: { command: "sync" } }, { settings: stored }))
    expect(lockOf(synced).files["src/main.ts"]).toEqual(expect.objectContaining({ base: files["src/main.ts"] }))
    const lock = JSON.parse(synced[lockFile] ?? "{}")
    lock.files["src/main.ts"].base = "export const forged = true\n"
    const forged = { ...synced, [lockFile]: JSON.stringify(lock), "src/main.ts": `// note\n${files["src/main.ts"]}` }
    const planned = await planFixture(
      forged,
      { intent: { command: "upgrade" } },
      { catalog: fixtureCatalog(2), settings: stored }
    )
    expect(planned.conflicts).toEqual([expect.objectContaining({ id: "src/main.ts", kind: "baseline-unverified" })])
  })

  it("add with a newer installed catalog asks to upgrade first, or to plan with the recorded version", async () => {
    const files = await project()
    const planned = await planFixture(files, addRequest(["i18n"]), { catalog: fixtureCatalog(2), catalogs })
    expect(planned.status).toBe("needs-decision")
    expect(planned.decisions[0]?.choices.map((choice) => choice.id)).toEqual(["upgrade", "recorded"])
    const upgrade = planned.decisions[0]?.choices[0]
    expect(upgrade?.label).toBe("Upgrade to 2.0.0 and add Localization")
    expect(upgrade?.request).toEqual({ intent: { command: "upgrade", addons: ["@fixture/i18n"] } })
    if (!upgrade) {
      throw new Error("missing choice")
    }
    const upgraded = await planFixture(files, upgrade.request, { catalog: fixtureCatalog(2), catalogs })
    expect(upgraded.status).toBe("planned")
    expect(upgraded.operations.map((operation) => operation.path)).toContain("src/i18n/setup.ts")
    const replacing = await planFixture(files, addRequest(["ui-fancy"], ["ui-basic"]), {
      catalog: fixtureCatalog(2),
      catalogs
    })
    expect(replacing.decisions[0]?.choices[0]?.request).toEqual({ intent: { command: "upgrade" } })
    const recorded = planned.decisions[0]?.choices[1]?.request
    if (!recorded) {
      throw new Error("missing choice")
    }
    const pinned = await planFixture(files, recorded, { catalog: fixtureCatalog(2), catalogs })
    expect(pinned.status).toBe("planned")
    expect(pinned.catalog.version).toBe("1.0.0")
    const missing = await planFixture(
      files,
      { ...recorded, catalogVersion: "0.9.0" },
      { catalog: fixtureCatalog(2), catalogs }
    )
    expect(missing.error?.code).toBe("E_BASELINE_UNAVAILABLE")
  })
})

describe("fingerprints", () => {
  it("change when a file the plan read changes", async () => {
    const files = await project()
    const before = await planFixture(files, addRequest(["i18n"]))
    const after = await planFixture(
      { ...files, "package.json": (files["package.json"] ?? "").replace("vite", "vite ") },
      addRequest(["i18n"])
    )
    expect(after.fingerprint).not.toBe(before.fingerprint)
  })
})
