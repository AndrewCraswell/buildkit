import { describe, expect, it } from "vitest"
import { mergeText } from "../merge/text.js"
import { readEnv, removeEnvKey, setEnvValue } from "./env.js"
import {
  insertJsonArrayItem,
  jsonFormatting,
  parseJsonc,
  removeJson,
  replaceJsonArrayItem,
  setJson,
  stringifyJson
} from "./json.js"
import { appendLines, hasLine, isSecretLikePattern, readLines, removeLines } from "./lines.js"
import { insertYamlArrayItem, parseYaml, removeYaml, replaceYamlArrayItem, setYaml } from "./yaml.js"

describe("json", () => {
  it("parses JSONC, refuses unsafe keys anywhere, and reports invalid text by line", () => {
    expect(parseJsonc('{\n  // note\n  "a": [1, { "b": true }],\n}')).toEqual({
      ok: true,
      value: { a: [1, { b: true }] }
    })
    expect(parseJsonc("  ")).toEqual({ ok: true, value: undefined })
    expect(parseJsonc('{ "a": [{ "constructor": 1 }] }')).toEqual({
      ok: false,
      reason: "unsafe-key",
      pointer: "/a/0/constructor"
    })
    expect(parseJsonc('{ "__proto__": {} }')).toMatchObject({ reason: "unsafe-key", pointer: "/__proto__" })
    expect(parseJsonc('{\n  "a": \n}')).toMatchObject({
      ok: false,
      reason: "invalid",
      message: expect.stringContaining("line")
    })
  })

  it("edits values while keeping comments and indentation", () => {
    const text = '{\n\t// keep\n\t"a": 1\n}\n'
    expect(jsonFormatting(text)).toMatchObject({ insertSpaces: false })
    expect(jsonFormatting('{\r\n    "a": 1\r\n}')).toMatchObject({ insertSpaces: true, tabSize: 4, eol: "\r\n" })
    const set = setJson(text, ["b", "c"], 2)
    expect(set).toContain("// keep")
    expect(parseJsonc(set)).toEqual({ ok: true, value: { a: 1, b: { c: 2 } } })
    expect(parseJsonc(removeJson(set, ["a"]))).toEqual({ ok: true, value: { b: { c: 2 } } })
    const list = '{ "list": ["a"] }'
    expect(parseJsonc(insertJsonArrayItem(list, ["list"], 1, "b"))).toEqual({ ok: true, value: { list: ["a", "b"] } })
    expect(parseJsonc(replaceJsonArrayItem(list, ["list"], 0, "z"))).toEqual({ ok: true, value: { list: ["z"] } })
    expect(stringifyJson({ a: 1 })).toBe('{\n  "a": 1\n}\n')
  })
})

describe("yaml", () => {
  const text = "# CI\njobs:\n  verify:\n    steps:\n      - id: lint # keep\n        run: pnpm lint\n"

  it("parses, refuses unsafe keys and reports errors", () => {
    expect(parseYaml(text)).toEqual({
      ok: true,
      value: { jobs: { verify: { steps: [{ id: "lint", run: "pnpm lint" }] } } }
    })
    expect(parseYaml("")).toEqual({ ok: true, value: undefined })
    expect(parseYaml("a:\n  __proto__: 1\n")).toEqual({ ok: false, reason: "unsafe-key", pointer: "/a/__proto__" })
    expect(parseYaml("a: [1\n")).toMatchObject({ ok: false, reason: "invalid" })
  })

  it("edits values and lists while keeping comments", () => {
    const inserted = insertYamlArrayItem(text, ["jobs", "verify", "steps"], 1, { id: "test", run: "pnpm test" })
    expect(inserted).toContain("# keep")
    expect(parseYaml(inserted)).toMatchObject({
      ok: true,
      value: { jobs: { verify: { steps: [{ id: "lint" }, { id: "test" }] } } }
    })
    expect(parseYaml(insertYamlArrayItem("a: 1\n", ["b"], 0, "x"))).toEqual({ ok: true, value: { a: 1, b: ["x"] } })
    expect(
      parseYaml(replaceYamlArrayItem(text, ["jobs", "verify", "steps"], 0, { id: "lint", run: "oxlint" }))
    ).toMatchObject({ value: { jobs: { verify: { steps: [{ run: "oxlint" }] } } } })
    expect(parseYaml(setYaml(text, ["name"], "CI"))).toMatchObject({ value: { name: "CI" } })
    expect(parseYaml(removeYaml(text, ["jobs", "verify"]))).toEqual({ ok: true, value: { jobs: {} } })
  })
})

describe("lines", () => {
  it("reads, appends and removes lines without duplicates", () => {
    expect(readLines(undefined)).toEqual([])
    expect(readLines("a\r\nb\r\n\r\n")).toEqual(["a", "b"])
    expect(appendLines("a\n", ["b", " a ", "b"])).toBe("a\nb\n")
    expect(removeLines("a\nb\n", ["a"])).toBe("b\n")
    expect(removeLines("a\n", ["a"])).toBe("")
    expect(hasLine("a\n b \n", "b")).toBe(true)
  })

  it("recognizes patterns that keep secrets out of git", () => {
    expect(["/.env", ".env.local", "*.pem", "*.key", ".dev.vars"].every((line) => isSecretLikePattern(line))).toBe(true)
    expect(isSecretLikePattern("dist")).toBe(false)
  })
})

describe("env", () => {
  it("reads values, quoted or not, and edits keys in place", () => {
    const text = "# note\nexport A=1\nB=\"two words\"\nC='x'\nnot a line\n"
    expect([...readEnv(text)]).toEqual([
      ["A", "1"],
      ["B", "two words"],
      ["C", "x"]
    ])
    expect(setEnvValue(text, "A", "2")).toContain("\nA=2\n")
    expect(setEnvValue(undefined, "D", "has space", "The D value")).toBe('# The D value\nD="has space"\n')
    expect(removeEnvKey("# The D value\nD=1\nE=2\n", "D", "The D value")).toBe("E=2\n")
    expect(removeEnvKey("D=1\n", "D")).toBe("")
    expect(removeEnvKey("E=1\n", "D")).toBe("E=1\n")
  })
})

describe("mergeText", () => {
  const base = "one\ntwo\nthree\n"

  it("merges changes to different lines", () => {
    expect(mergeText("zero\none\ntwo\nthree\n", base, "one\ntwo\nthree\nfour\n")).toEqual({
      clean: true,
      content: "zero\none\ntwo\nthree\nfour\n",
      hunks: 1,
      conflicts: 0
    })
    expect(mergeText("one\ntwo\n3\n", base, "one\ntwo\n3\n").clean).toBe(true)
  })

  it("marks changes to the same lines", () => {
    const merged = mergeText("one\nTWO\nthree\n", base, "one\n2\nthree\n")
    expect(merged.clean).toBe(false)
    expect(merged.content).toBe("one\n<<<<<<< yours\nTWO\n=======\n2\n>>>>>>> incoming\nthree\n")
    expect(mergeText("", "", "").content).toBe("")
  })
})
