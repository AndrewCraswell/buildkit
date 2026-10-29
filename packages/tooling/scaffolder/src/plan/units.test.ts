import { describe, expect, it } from "vitest"
import { decideKey } from "../merge/keys.js"
import { applyStyle, countLines, hasConflictMarkers, hashText, normalizeText, textStyle } from "../ownership/text.js"
import { fixtureCatalog } from "../testing/fixture.js"
import { pendingMigrations } from "../upgrade/migrations.js"
import { compareVersions, isValidVersion, satisfiesRange } from "../upgrade/semver.js"
import { requestArgv } from "./argv.js"
import { exitCode, toEnvelope, artifactName } from "./envelope.js"
import { errorInfo, PlanError } from "./errors.js"
import { canonicalJson, formatPointer, isJsonValue, parsePointer, readPointer, stableJson } from "./json.js"
import { caseCollision, pathProblem, relativeModule } from "./paths.js"
import type { Plan } from "./types.js"

describe("json helpers", () => {
  it("serializes canonically and stably", () => {
    expect(canonicalJson({ b: 1, a: [undefined, { d: 1, c: undefined }] })).toBe('{"a":[null,{"d":1}],"b":1}')
    expect(stableJson({ b: 1, a: { d: 1, c: 2 } })).toBe('{\n  "a": {\n    "c": 2,\n    "d": 1\n  },\n  "b": 1\n}\n')
  })

  it("round-trips pointers and reads them", () => {
    expect(parsePointer("/dependencies/@lingui~1core/a~0b")).toEqual(["dependencies", "@lingui/core", "a~b"])
    expect(formatPointer(["@lingui/core", "a~b"])).toBe("/@lingui~1core/a~0b")
    expect(parsePointer("")).toEqual([])
    expect(() => parsePointer("a")).toThrow('must start with "/"')
    expect(readPointer({ a: { b: 1 } }, ["a", "b"])).toEqual({ found: true, value: 1 })
    expect(readPointer({ a: 1 }, ["a", "b"])).toEqual({ found: false, value: undefined })
  })

  it("accepts only plain JSON values", () => {
    expect(isJsonValue({ a: [1, "x", null, true, { b: 2 }] })).toBe(true)
    expect(isJsonValue(Number.NaN)).toBe(false)
    expect(isJsonValue(new Date())).toBe(false)
    expect(isJsonValue(undefined)).toBe(false)
    expect(isJsonValue(JSON.parse('{ "__proto__": 1 }'))).toBe(false)
  })
})

describe("text", () => {
  it("normalizes line endings, a BOM and the final newline, and restores a file's style", async () => {
    expect(normalizeText("\uFEFFa\r\nb\r\n\r\n")).toBe("a\nb\n")
    expect(normalizeText("\n\n")).toBe("")
    expect(applyStyle("a\nb\n", textStyle("\uFEFFx\r\ny"))).toBe("\uFEFFa\r\nb\r\n")
    expect(textStyle(undefined)).toEqual({ eol: "\n", bom: false })
    expect(await hashText("a\r\n")).toBe(await hashText("a"))
    expect(countLines("a\nb")).toBe(2)
    expect(countLines("")).toBe(0)
    expect(hasConflictMarkers("a\n<<<<<<< yours\nb\n")).toBe(true)
    expect(hasConflictMarkers("a <<<<<<< b\n")).toBe(false)
  })
})

describe("paths", () => {
  it("refuses unsafe project paths and allows names like ..foo", () => {
    const unsafe = [
      "",
      "/abs",
      "a\\b",
      "C:/x",
      "a/../b",
      "./a",
      "a//b",
      "a.",
      "a ",
      "con",
      "lpt1.txt",
      "a\u0001",
      "x".repeat(241)
    ]
    expect(unsafe.filter((path) => pathProblem(path) === undefined)).toEqual([])
    expect(pathProblem("..foo/bar.ts")).toBeUndefined()
    expect(caseCollision(["a/B.ts", "a/c.ts", "a/b.ts"])).toEqual(["a/B.ts", "a/b.ts"])
    expect(caseCollision(["a", "a"])).toBeUndefined()
    expect(relativeModule("src/generated/x/client.ts", "src/i18n/setup")).toBe("../../i18n/setup")
    expect(relativeModule("client.ts", "src/x")).toBe("./src/x")
    expect(relativeModule("client.ts", "..foo/x")).toBe("./..foo/x")
    expect(relativeModule("src/a/client.ts", "src")).toBe("..")
    expect(relativeModule("src/client.ts", "src")).toBe(".")
  })
})

describe("decideKey", () => {
  const desired = { value: "2", contributors: ["@x/a"] }
  const absent = { found: false, value: undefined }

  it("covers new, unchanged, changed, deleted and orphaned keys", () => {
    expect(decideKey({ label: "k", desired, state: undefined, current: absent, resolution: undefined })).toMatchObject({
      action: "write",
      state: { provenance: "introduced" }
    })
    expect(
      decideKey({ label: "k", desired, state: undefined, current: { found: true, value: "2" }, resolution: undefined })
    ).toMatchObject({ action: "keep", state: { provenance: "adopted" } })
    expect(
      decideKey({ label: "k", desired, state: undefined, current: { found: true, value: "1" }, resolution: undefined })
    ).toMatchObject({ action: "conflict", kind: "exists" })
    expect(
      decideKey({
        label: "k",
        desired,
        state: undefined,
        current: { found: true, value: "1" },
        resolution: "take-incoming"
      })
    ).toMatchObject({ action: "write" })
    const state = { base: "1", provenance: "introduced" as const }
    expect(
      decideKey({ label: "k", desired, state, current: { found: true, value: "1" }, resolution: undefined })
    ).toMatchObject({ action: "write" })
    expect(
      decideKey({ label: "k", desired, state, current: { found: true, value: "3" }, resolution: undefined })
    ).toMatchObject({ action: "conflict", kind: "both-changed" })
    expect(
      decideKey({ label: "k", desired, state, current: { found: true, value: "3" }, resolution: "keep-current" })
    ).toMatchObject({ action: "keep", state: { base: "2" } })
    expect(decideKey({ label: "k", desired, state, current: absent, resolution: undefined })).toMatchObject({
      action: "conflict",
      kind: "deleted"
    })
    expect(decideKey({ label: "k", desired, state, current: absent, resolution: "keep-current" })).toMatchObject({
      action: "keep"
    })
    expect(decideKey({ label: "k", desired, state, current: absent, resolution: "take-incoming" })).toMatchObject({
      action: "write"
    })
    expect(
      decideKey({
        label: "k",
        desired,
        state: { base: "2", provenance: "adopted" },
        current: { found: true, value: "9" },
        resolution: undefined
      })
    ).toMatchObject({ action: "keep" })
    expect(
      decideKey({ label: "k", desired: undefined, state, current: { found: true, value: "1" }, resolution: undefined })
    ).toEqual({ action: "remove" })
    expect(
      decideKey({ label: "k", desired: undefined, state, current: { found: true, value: "5" }, resolution: undefined })
    ).toMatchObject({ action: "conflict", kind: "orphan-edited" })
    expect(
      decideKey({
        label: "k",
        desired: undefined,
        state,
        current: { found: true, value: "5" },
        resolution: "keep-current"
      })
    ).toEqual({ action: "keep", state: undefined })
    expect(
      decideKey({
        label: "k",
        desired: undefined,
        state: { base: "1", provenance: "adopted" },
        current: { found: true, value: "1" },
        resolution: undefined
      })
    ).toEqual({ action: "keep", state: undefined })
    expect(
      decideKey({ label: "k", desired: undefined, state: undefined, current: absent, resolution: undefined })
    ).toEqual({ action: "keep", state: undefined })
  })
})

describe("versions and migrations", () => {
  it("compares semantic versions, including prereleases", () => {
    expect(compareVersions("1.2.3", "1.10.0")).toBeLessThan(0)
    expect(compareVersions("1.0.0", "1.0.0-rc.1")).toBeGreaterThan(0)
    expect(compareVersions("1.0.0-rc.2", "1.0.0-rc.10")).toBeLessThan(0)
    expect(compareVersions("1.0.0-alpha", "1.0.0-1")).toBeGreaterThan(0)
    expect(compareVersions("1.0.0-a.b", "1.0.0-a")).toBeGreaterThan(0)
    expect(compareVersions("1.0.0-b", "1.0.0-a")).toBeGreaterThan(0)
    expect(compareVersions("v2.0.0+build", "2.0.0")).toBe(0)
    expect(isValidVersion("1.0")).toBe(false)
  })

  it.each([
    ["1.4.0", "^1.2.0", true],
    ["2.0.0", "^1.2.0", false],
    ["0.2.5", "^0.2.1", true],
    ["0.3.0", "^0.2.1", false],
    ["0.0.4", "^0.0.3", false],
    ["0.9.0", "^0", true],
    ["1.2.9", "~1.2.3", true],
    ["1.3.0", "~1.2.3", false],
    ["1.9.0", "1", true],
    ["1.3.0", "1.2", false],
    ["2.5.0", ">=1.0.0 <3.0.0", true],
    ["3.0.0", ">=1.0.0 <3.0.0", false],
    ["3.1.0", "^1.0.0 || ^3.0.0", true],
    ["1.2.3", "1.2.3", true],
    ["7.0.0", "*", true],
    ["1.3.0-rc.1", "^1.2.0", false],
    ["1.3.0-rc.2", "^1.3.0-rc.1", true],
    ["1.5.0", ">= 1.0.0", true],
    ["1.5.0", ">= 1.0.0 < 1.5.0", false],
    ["1.9.0", "1.x", true],
    ["2.0.0", "1.x", false],
    ["1.2.9", "1.2.x", true],
    ["1.3.0", "1.2.*", false],
    ["0.9.0", "^0.x", true],
    ["2.0.0", "1.0.0 - 2.0.0", true],
    ["2.9.0", "1.0.0 - 2", true],
    ["3.0.0", "1.0.0 - 2", false],
    ["1.9.0", ">1", false],
    ["2.0.0", ">1", true],
    ["1.2.9", "<=1.2", true],
    ["1.3.0", "<=1.2", false],
    ["0.9.0", "<1", true],
    ["1.9.0", "~1", true],
    ["5.0.0", "x", true],
    ["5.0.0", "<*", false]
  ])("puts %s in range %s: %s", (version, range, expected) => {
    expect(satisfiesRange(version, range)).toBe(expected)
  })

  it("rejects text that isn't a range", () => {
    expect(() => satisfiesRange("1.0.0", "^one")).toThrow("isn't a version range")
  })

  it("selects migrations in the upgraded range", () => {
    const lint = fixtureCatalog(2).addons.find((addon) => addon.id === "@fixture/lint")
    if (!lint) {
      throw new Error("missing lint")
    }
    expect(pendingMigrations(lint, "1.0.0", "1.1.0")).toHaveLength(3)
    expect(pendingMigrations(lint, "1.1.0", "1.1.0")).toEqual([])
    expect(pendingMigrations(lint, "1.1.0", "2.0.0")).toEqual([])
  })
})

describe("envelope", () => {
  const plan: Plan = {
    status: "planned",
    request: {
      intent: { command: "add", addons: ["@x/a"], replace: ["@x/b"], options: { "@x/a": { mode: "fast", count: 2 } } },
      resolve: { "a.json#/k": "keep-current", "b.ts": { content: "x" } },
      conflictStyle: "markers",
      catalogVersion: "1.0.0"
    },
    fingerprint: "f".repeat(64),
    catalog: { id: "@x/catalog", version: "1.0.0" },
    operations: [
      {
        path: ".env",
        action: "update",
        class: "user",
        linesAdded: 3,
        linesRemoved: 1,
        secret: true,
        content: "SECRET=1\n"
      },
      { path: "a.ts", action: "create", class: "owned", linesAdded: 1, linesRemoved: 0, content: "x\n" }
    ],
    decisions: [
      { id: "d", message: "Pick", choices: [{ id: "c", label: "C", request: { intent: { command: "upgrade" } } }] }
    ],
    conflicts: [{ id: "a.json#/k", path: "a.json", kind: "both-changed", message: "m", resolutions: ["keep-current"] }],
    pulled: [],
    required: [],
    packages: [],
    env: [],
    commands: [],
    migrations: [],
    notices: [],
    nextSteps: [],
    merged: [],
    upgrade: { catalog: { from: "1.0.0", to: "1.0.0" }, packs: [], addons: [] }
  }

  it("hides secret files' line counts, adds argv to choices, and points conflicts at artifacts", () => {
    const envelope = toEnvelope(plan, { product: "x", artifacts: ".x/plans/f" })
    expect(envelope.operations?.[0]).toEqual({
      path: ".env",
      action: "update",
      class: "user",
      linesAdded: 0,
      linesRemoved: 0,
      secret: true
    })
    expect(JSON.stringify(envelope)).not.toContain("SECRET")
    expect(envelope.decisions?.[0]?.choices[0]?.argv).toEqual(["x", "upgrade"])
    expect(envelope.conflicts?.[0]?.artifacts).toBe(".x/plans/f/conflicts/a.json_k")
    expect(envelope.upgrade).toBeUndefined()
    expect(artifactName("src/a b.ts#/x")).toBe("src_a_b.ts_x")
  })

  it("maps statuses and errors to exit codes", () => {
    expect([
      exitCode({ status: "planned" }),
      exitCode({ status: "applied" }),
      exitCode({ status: "unchanged" })
    ]).toEqual([0, 0, 0])
    expect(exitCode({ status: "needs-decision" })).toBe(1)
    expect(exitCode({ status: "conflict" })).toBe(3)
    const error = (code: PlanError["code"]) => exitCode({ status: "error", error: new PlanError(code, "m").toInfo() })
    expect([
      error("E_DRIFT"),
      error("E_LOCKED"),
      error("E_INTERRUPTED"),
      error("E_CANCELLED"),
      error("E_USAGE")
    ]).toEqual([4, 5, 5, 130, 2])
    expect(errorInfo(new Error("boom"))).toEqual({ code: "E_INTERNAL", message: "boom", retryable: false })
    expect(errorInfo("text").message).toBe("text")
    expect(new PlanError("E_DRIFT", "m", { paths: ["a"], next: ["b"] }).toInfo()).toEqual({
      code: "E_DRIFT",
      message: "m",
      retryable: true,
      paths: ["a"],
      next: ["b"]
    })
  })

  it("writes the CLI arguments for every kind of request", () => {
    expect(requestArgv(plan.request)).toEqual([
      "add",
      "a",
      "--replace",
      "b",
      "--set",
      "a.mode=fast",
      "--set",
      "a.count=2",
      "--resolve",
      "a.json#/k=keep-current",
      "--resolve",
      "b.ts=file:<path>",
      "--conflict",
      "markers",
      "--catalog-version",
      "1.0.0"
    ])
    expect(
      requestArgv({
        intent: {
          command: "init",
          answers: {
            template: "app",
            name: "demo",
            mode: "ssr",
            slots: { database: null, ui: "@x/ui" },
            optional: ["@x/i18n"],
            options: { "@x/i18n": { locales: ["en"] } },
            adopt: true
          }
        }
      })
    ).toEqual([
      "init",
      "app",
      "demo",
      "--mode",
      "ssr",
      "--no-database",
      "--ui",
      "ui",
      "--with",
      "i18n",
      "--set",
      'i18n.locales=["en"]',
      "--adopt"
    ])
    expect(requestArgv({ intent: { command: "config", options: { "@x/a": { b: true } } } })).toEqual([
      "config",
      "set",
      "a.b=true"
    ])
    expect(requestArgv({ intent: { command: "sync" } })).toEqual(["sync"])
    expect(requestArgv({ intent: { command: "upgrade", addons: ["@x/db"] } })).toEqual(["upgrade", "--with", "db"])
    expect(requestArgv({ intent: { command: "config", options: {}, addons: ["@x/db"] } })).toEqual([
      "config",
      "set",
      "--with",
      "db"
    ])
  })

  it("writes an init for a preset as --preset plus what differs from it", () => {
    const preset = {
      id: "saas",
      title: "SaaS",
      answers: {
        template: "app",
        mode: "ssr",
        slots: { database: "@x/db-postgres" },
        optional: ["@x/i18n"],
        options: { "@x/i18n": { locales: ["en"] } }
      }
    }
    const answers = { ...preset.answers, name: "demo" }
    expect(requestArgv({ intent: { command: "init", answers } }, { preset })).toEqual([
      "init",
      "--preset",
      "saas",
      "demo"
    ])
    expect(
      requestArgv(
        {
          intent: {
            command: "init",
            answers: {
              ...answers,
              mode: "spa",
              slots: { database: "@x/db-postgres", ui: "@x/ui-fancy" },
              optional: ["@x/storybook"],
              options: { "@x/i18n": { locales: ["en", "fr"] } }
            }
          }
        },
        { preset }
      )
    ).toEqual([
      "init",
      "--preset",
      "saas",
      "demo",
      "--mode",
      "spa",
      "--ui",
      "ui-fancy",
      "--with",
      "storybook",
      "--without",
      "i18n",
      "--set",
      'i18n.locales=["en","fr"]'
    ])
    // A preset for another template is ignored.
    expect(
      requestArgv({ intent: { command: "init", answers: { template: "bare", name: "demo" } } }, { preset })
    ).toEqual(["init", "bare", "demo"])
    // So is one that answers a question the request leaves to the template's default.
    const { mode, slots, optional, options, ...rest } = answers
    for (const partial of [
      { ...rest, slots, optional, options },
      { ...rest, mode, optional, options },
      { ...rest, mode, slots, options },
      { ...rest, mode, slots, optional }
    ]) {
      expect(requestArgv({ intent: { command: "init", answers: partial } }, { preset }).slice(0, 2)).toEqual([
        "init",
        "app"
      ])
    }
    // A preset can name its add-ons by short name, and they're still the request's.
    const short = { ...preset, answers: { ...preset.answers, slots: { database: "db-postgres" }, optional: ["i18n"] } }
    expect(requestArgv({ intent: { command: "init", answers } }, { preset: short })).toEqual([
      "init",
      "--preset",
      "saas",
      "demo"
    ])
  })
})
