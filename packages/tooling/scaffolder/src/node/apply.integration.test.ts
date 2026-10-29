import { spawnSync } from "node:child_process"
import {
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync
} from "node:fs"
import { hostname, tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { PlanError } from "../plan/errors.js"
import type { Plan } from "../plan/types.js"
import { addRequest, fixtureCatalog, initRequest, settings } from "../testing/fixture.js"
import { applyPlan, isStaleLock, recover } from "./apply.js"
import { rawHash } from "./fs.js"
import { applyReviewed, planProject, type ProjectContext } from "./project.js"
import { nodeTree, readSafely } from "./tree.js"

let root: string
let project: string
let context: ProjectContext

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "scaffolder-apply-"))
  project = join(root, "demo")
  context = { root: project, catalog: fixtureCatalog(), settings }
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

async function failure(run: () => Promise<unknown>): Promise<PlanError> {
  try {
    await run()
  } catch (error) {
    if (error instanceof PlanError) {
      return error
    }
    throw error
  }
  throw new Error("expected a PlanError")
}

function listFiles(folder: string, prefix = ""): string[] {
  if (!existsSync(folder)) {
    return []
  }
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? listFiles(join(folder, entry.name), `${prefix}${entry.name}/`) : [`${prefix}${entry.name}`]
  )
}

async function initProject(): Promise<Plan> {
  const planned = await planProject(context, initRequest())
  await applyPlan(planned, { root: project, settings })
  return planned
}

describe("applyPlan", () => {
  it("writes through temp files, writes the lock last and leaves no journal or lock behind", async () => {
    const written: string[] = []
    const planned = await planProject(context, initRequest())
    const result = await applyPlan(planned, {
      root: project,
      settings,
      hooks: { afterWrite: (path) => written.push(path) }
    })
    expect(result.status).toBe("applied")
    expect(written.at(-1)).toBe(".fixture/lock.json")
    expect(written.at(-2)).toBe("fixture.jsonc")
    const files = listFiles(project)
    expect(files.some((file) => file.endsWith(".tmp"))).toBe(false)
    expect(files).not.toContain(".fixture/journal.json")
    expect(files).not.toContain(".fixture/apply.lock")
    expect((await planProject(context, { intent: { command: "sync" } })).status).toBe("unchanged")
    expect(await applyPlan({ ...planned, status: "unchanged" }, { root: project, settings })).toEqual({
      status: "unchanged",
      written: [],
      notices: []
    })
    expect((await failure(() => applyPlan({ ...planned, status: "conflict" }, { root: project, settings }))).code).toBe(
      "E_USAGE"
    )
  })

  it("refuses a path that escapes the project before anything is written", async () => {
    const planned = await planProject(context, initRequest())
    const unsafe: Plan = {
      ...planned,
      operations: [
        { path: "src/main.ts", action: "create", class: "seed", linesAdded: 1, linesRemoved: 0, content: "x\n" },
        { path: "../outside.txt", action: "create", class: "owned", linesAdded: 1, linesRemoved: 0, content: "x\n" }
      ]
    }
    expect((await failure(() => applyPlan(unsafe, { root: project, settings }))).code).toBe("E_UNSAFE_PATH")
    expect(existsSync(join(root, "outside.txt"))).toBe(false)
    expect(listFiles(project).filter((file) => !file.startsWith(".fixture/"))).toEqual([])
  })

  it("a failed write rolls back only what this run created", async () => {
    await initProject()
    writeFileSync(join(project, "notes.txt"), "mine\n")
    const before = readFileSync(join(project, "package.json"), "utf8")
    const planned = await planProject(context, addRequest(["auth", "i18n"]))
    let writes = 0
    const error = await failure(() =>
      applyPlan(planned, {
        root: project,
        settings,
        hooks: {
          afterWrite: () => {
            writes++
            if (writes === 3) {
              throw new Error("disk full")
            }
          }
        }
      })
    )
    expect(error.code).toBe("E_INTERNAL")
    expect(error.message).toContain("disk full")
    expect(readFileSync(join(project, "package.json"), "utf8")).toBe(before)
    expect(existsSync(join(project, "src/auth.ts"))).toBe(false)
    expect(existsSync(join(project, "src/i18n"))).toBe(false)
    expect(readFileSync(join(project, "notes.txt"), "utf8")).toBe("mine\n")
    expect(existsSync(join(project, ".fixture/journal.json"))).toBe(false)
    expect(existsSync(join(project, ".fixture/apply.lock"))).toBe(false)
    expect(listFiles(project).filter((file) => file.startsWith(".fixture/backup/"))).toEqual([])
  })

  it("refuses when a file changed after planning, without writing anything", async () => {
    await initProject()
    const planned = await planProject(context, addRequest(["i18n"]))
    writeFileSync(join(project, "package.json"), "{}\n")
    const error = await failure(() => applyPlan(planned, { root: project, settings }))
    expect(error.code).toBe("E_DRIFT")
    expect(error.paths).toContain("package.json")
    expect(existsSync(join(project, "src/i18n/setup.ts"))).toBe(false)
    const create = await planProject(context, addRequest(["auth"]))
    writeFileSync(join(project, "src/auth.ts"), "raced\n")
    expect((await failure(() => applyPlan(create, { root: project, settings }))).code).toBe("E_DRIFT")
    expect(readFileSync(join(project, "src/auth.ts"), "utf8")).toBe("raced\n")
  })

  it("approving a reviewed plan applies it once, and fails with drift if the project changed", async () => {
    await initProject()
    const reviewed = await planProject(context, addRequest(["i18n"]))
    const first = await applyReviewed(context, reviewed)
    expect(first.status).toBe("applied")
    expect((await applyReviewed(context, reviewed)).status).toBe("unchanged")
    const generated = join(project, "src/generated/fixture/client.ts")
    const content = readFileSync(generated, "utf8")
    rmSync(generated)
    expect((await failure(() => applyReviewed(context, reviewed))).code).toBe("E_DRIFT")
    writeFileSync(generated, content)
    const next = await planProject(context, addRequest(["auth"]))
    writeFileSync(join(project, "package.json"), `${readFileSync(join(project, "package.json"), "utf8")}\n`)
    writeFileSync(join(project, "src/main.ts"), "changed\n")
    expect((await failure(() => applyReviewed(context, next))).code).toBe("E_DRIFT")
  })

  it("writes secrets only to the secrets file, never to backups or the lock", async () => {
    await initProject()
    const planned = await planProject(context, addRequest(["sentry"]))
    await applyPlan(planned, { root: project, settings, secrets: { SENTRY_DSN: "https://key@sentry.example/1" } })
    expect(readFileSync(join(project, ".env"), "utf8")).toBe("SENTRY_DSN=https://key@sentry.example/1\n")
    const everything = listFiles(project)
      .filter((file) => file !== ".env")
      .map((file) => readFileSync(join(project, file), "utf8"))
      .join("\n")
    expect(everything).not.toContain("key@sentry")
    expect(listFiles(project).filter((file) => file.startsWith(".fixture/backup/"))).toEqual([])
  })

  it("reports a secrets file it can't write, and still releases the lock", async () => {
    await initProject()
    mkdirSync(join(project, ".env"))
    const planned = await planProject(context, addRequest(["sentry"]))
    const result = await applyPlan(planned, { root: project, settings, secrets: { SENTRY_DSN: "https://key@x/1" } })
    expect(result.status).toBe("applied")
    expect(result.notices).toEqual([expect.objectContaining({ code: "secrets-not-written", path: ".env" })])
    expect(result.notices[0]?.text).toContain("Set SENTRY_DSN there yourself")
    expect(result.notices[0]?.text).not.toContain("key@x")
    expect(existsSync(join(project, ".fixture/apply.lock"))).toBe(false)
    expect(readFileSync(join(project, ".env.example"), "utf8")).toContain("SENTRY_DSN=")
  })

  it.skipIf(process.platform === "win32")("makes the secrets file readable only by you", async () => {
    await initProject()
    const planned = await planProject(context, addRequest(["sentry"]))
    await applyPlan(planned, { root: project, settings, secrets: { SENTRY_DSN: "https://key@sentry.example/1" } })
    expect(statSync(join(project, ".env")).mode % 0o1000).toBe(0o600)
  })
})

describe("apply lock and recovery", () => {
  function writeLockInfo(info: object) {
    mkdirSync(join(project, ".fixture"), { recursive: true })
    writeFileSync(join(project, ".fixture/apply.lock"), JSON.stringify(info))
  }

  it("detects a stale lock from its pid, host and time, and recover clears it", async () => {
    const dead = spawnSync(process.execPath, ["-e", ""]).pid ?? 999999
    writeLockInfo({ pid: dead, host: hostname(), time: new Date().toISOString() })
    const planned = await planProject(context, initRequest())
    const stale = await failure(() => applyPlan(planned, { root: project, settings }))
    expect(stale.code).toBe("E_LOCKED")
    expect(stale.next).toEqual(["fixture recover"])
    expect(await recover(project, settings)).toMatchObject({ status: "recovered" })
    expect((await applyPlan(planned, { root: project, settings })).status).toBe("applied")
    expect(
      isStaleLock({ pid: 1, host: "elsewhere", time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() })
    ).toBe(true)
    expect(isStaleLock({ pid: 1, host: "elsewhere", time: new Date().toISOString() })).toBe(false)
  })

  it("refuses while a live process holds the lock", async () => {
    writeLockInfo({ pid: process.ppid, host: hostname(), time: new Date().toISOString() })
    const planned = await planProject(context, initRequest())
    const error = await failure(() => applyPlan(planned, { root: project, settings }))
    expect(error.code).toBe("E_LOCKED")
    expect(error.message).toContain("Another apply is running")
    expect((await failure(() => recover(project, settings))).code).toBe("E_LOCKED")
  })

  it("an interrupted apply blocks the next one until recover rolls it back", async () => {
    const fingerprint = "0123456789abcdef0123456789abcdef"
    const backups = ".fixture/backup/0123456789abcdef"
    mkdirSync(join(project, backups), { recursive: true })
    mkdirSync(join(project, "src/new"), { recursive: true })
    writeFileSync(join(project, "created.txt"), "ours\n")
    writeFileSync(join(project, "updated.txt"), "after\n")
    writeFileSync(join(project, backups, "updated.txt"), "before\n")
    writeFileSync(join(project, "untouched.txt"), "before\n")
    writeFileSync(join(project, "elsewhere.txt"), "someone else\n")
    writeFileSync(join(project, backups, "deleted.txt"), "deleted\n")
    const journal = {
      fingerprint,
      started: new Date().toISOString(),
      entries: [
        {
          path: "created.txt",
          action: "create",
          beforeHash: rawHash(undefined),
          afterHash: rawHash("ours\n"),
          createdFolders: []
        },
        {
          path: "updated.txt",
          action: "update",
          beforeHash: rawHash("before\n"),
          afterHash: rawHash("after\n"),
          backup: join(project, backups, "updated.txt"),
          createdFolders: []
        },
        {
          path: "untouched.txt",
          action: "update",
          beforeHash: rawHash("before\n"),
          afterHash: rawHash("after\n"),
          backup: join(project, backups, "updated.txt"),
          createdFolders: []
        },
        {
          path: "elsewhere.txt",
          action: "update",
          beforeHash: rawHash("x\n"),
          afterHash: rawHash("y\n"),
          createdFolders: []
        },
        {
          path: "deleted.txt",
          action: "delete",
          beforeHash: rawHash("deleted\n"),
          afterHash: rawHash(undefined),
          backup: join(project, backups, "deleted.txt"),
          createdFolders: []
        },
        {
          path: "src/new/file.ts",
          action: "create",
          beforeHash: rawHash(undefined),
          afterHash: rawHash("x\n"),
          createdFolders: [join(project, "src/new")]
        }
      ]
    }
    writeFileSync(join(project, ".fixture/journal.json"), JSON.stringify(journal))
    const planned = await planProject(context, initRequest())
    expect((await failure(() => applyPlan({ ...planned, status: "planned" }, { root: project, settings }))).code).toBe(
      "E_INTERRUPTED"
    )
    const result = await recover(project, settings)
    expect(result.status).toBe("recovered")
    expect(result.report.restored.sort()).toEqual(["created.txt", "deleted.txt", "updated.txt"])
    expect(result.report.unchanged.sort()).toEqual(["src/new/file.ts", "untouched.txt"])
    expect(result.report.changed).toEqual(["elsewhere.txt"])
    expect(existsSync(join(project, "created.txt"))).toBe(false)
    expect(readFileSync(join(project, "updated.txt"), "utf8")).toBe("before\n")
    expect(readFileSync(join(project, "deleted.txt"), "utf8")).toBe("deleted\n")
    expect(existsSync(join(project, "src/new"))).toBe(false)
    expect(existsSync(join(project, ".fixture/journal.json"))).toBe(false)
    expect(await recover(project, settings)).toMatchObject({ status: "unchanged" })
  })

  it("refuses a crafted journal that points outside the project or its backup folder", async () => {
    const fingerprint = "0123456789abcdef0123456789abcdef"
    writeFileSync(join(root, "outside.txt"), "keep\n")
    const entry = {
      path: "a.txt",
      action: "create",
      beforeHash: rawHash(undefined),
      afterHash: "unsafe",
      createdFolders: []
    }
    for (const journal of [
      { fingerprint, entries: [{ ...entry, path: "../outside.txt" }] },
      { fingerprint: "../../outside", entries: [entry] },
      { fingerprint, entries: [{ ...entry, action: "update", backup: join(root, "outside.txt") }] },
      { fingerprint, entries: [{ ...entry, action: "update", backup: "outside.txt" }] },
      { fingerprint, entries: [{ ...entry, createdFolders: [root] }] }
    ]) {
      mkdirSync(join(project, ".fixture"), { recursive: true })
      writeFileSync(
        join(project, ".fixture/journal.json"),
        JSON.stringify({ started: new Date().toISOString(), ...journal })
      )
      const error = await failure(() => recover(project, settings))
      expect(error.code).toBe("E_INVALID_STATE")
      expect(error.message).toContain("nothing was changed")
    }
    expect(readFileSync(join(root, "outside.txt"), "utf8")).toBe("keep\n")
    expect(existsSync(join(project, ".fixture/journal.json"))).toBe(true)
  })
})

describe("the disk snapshot", () => {
  it("refuses hard links, non-files and paths through files", () => {
    mkdirSync(join(project, "folder"), { recursive: true })
    writeFileSync(join(project, "file.txt"), "x\n")
    linkSync(join(project, "file.txt"), join(project, "linked.txt"))
    expect(readSafely(project, "linked.txt")).toMatchObject({
      kind: "unsafe",
      reason: expect.stringContaining("hard link")
    })
    expect(readSafely(project, "folder")).toMatchObject({
      kind: "unsafe",
      reason: expect.stringContaining("isn't a file")
    })
    expect(readSafely(project, "file.txt/inner")).toMatchObject({
      kind: "unsafe",
      reason: expect.stringContaining("isn't a folder")
    })
    expect(readSafely(project, "../escape")).toMatchObject({ kind: "unsafe" })
    expect(readSafely(project, "missing/file")).toEqual({ kind: "absent" })
    expect(nodeTree(join(root, "nowhere")).read("a")).toEqual({ kind: "absent" })
  })

  it("refuses symlinked segments", () => {
    mkdirSync(join(project), { recursive: true })
    mkdirSync(join(root, "outside"))
    writeFileSync(join(root, "outside/secret.txt"), "x\n")
    try {
      symlinkSync(join(root, "outside"), join(project, "src"), "junction")
    } catch {
      return
    }
    expect(readSafely(project, "src/secret.txt")).toMatchObject({
      kind: "unsafe",
      reason: expect.stringContaining("symbolic link")
    })
  })

  it("refuses a name that matches an existing file only by case", () => {
    mkdirSync(project, { recursive: true })
    writeFileSync(join(project, "Readme.md"), "x\n")
    const caseInsensitive = existsSync(join(project, "README.md"))
    expect(readSafely(project, "README.md")).toEqual(
      caseInsensitive
        ? { kind: "unsafe", reason: "README.md differs only in case from Readme.md." }
        : { kind: "absent" }
    )
  })
})
