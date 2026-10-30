import { describe, expect, it } from "vite-plus/test"
import { insertJsonArrayItem, removeJson, replaceJsonArrayItem, setJson, stringifyJson } from "./json.js"
import { jsonLayoutFor, printJson } from "./layout.js"

const tsconfig = jsonLayoutFor("tsconfig.json", 40)

describe("JSON layout", () => {
  it("puts an array on one line when the line fits, its comma included", () => {
    const set = setJson(
      '{\n  "compilerOptions": {\n    "strict": true\n  }\n}\n',
      ["compilerOptions", "lib"],
      ["ES2023", "DOM"],
      tsconfig
    )
    expect(set).toBe('{\n  "compilerOptions": {\n    "strict": true,\n    "lib": ["ES2023", "DOM"]\n  }\n}\n')
    // The array's line is 40 columns, so it fits as the last property and breaks when a comma follows it.
    const x24 = "x".repeat(24)
    expect(printJson({ a: [x24, "y"] }, { layout: tsconfig })).toBe(`{\n  "a": ["${x24}", "y"]\n}`)
    expect(printJson({ a: [x24, "y"], b: 1 }, { layout: tsconfig })).toBe(
      `{\n  "a": [\n    "${x24}",\n    "y"\n  ],\n  "b": 1\n}`
    )
    const full = '{\n  "a": ["aaaaaaaaaa", "bbbbbbbbbbbbbbbbbbb"],\n  "b": 1\n}\n'
    expect(replaceJsonArrayItem(full, ["a"], 0, "aaaaaaaaaaa", tsconfig)).toBe(
      '{\n  "a": [\n    "aaaaaaaaaaa",\n    "bbbbbbbbbbbbbbbbbbb"\n  ],\n  "b": 1\n}\n'
    )
    expect(insertJsonArrayItem('{\n  "include": ["src"]\n}\n', ["include"], 1, "tests", tsconfig)).toBe(
      '{\n  "include": ["src", "tests"]\n}\n'
    )
  })

  it("keeps a list on one line when an edit after it rewrites its line", () => {
    const text = '{\n  "compilerOptions": {\n    "lib": ["ES2023", "DOM"]\n  }\n}\n'
    const added = setJson(text, ["compilerOptions", "module"], "ESNext", tsconfig)
    expect(added).toBe('{\n  "compilerOptions": {\n    "lib": ["ES2023", "DOM"],\n    "module": "ESNext"\n  }\n}\n')
    expect(removeJson(added, ["compilerOptions", "module"], tsconfig)).toBe(text)
  })

  it("keeps every array across lines in package.json, as the formatters print it", () => {
    const layout = jsonLayoutFor("apps/web/package.json")
    expect(layout.style).toBe("stringify")
    expect(setJson('{\n  "name": "a"\n}\n', ["files"], ["dist"], layout)).toBe(
      '{\n  "name": "a",\n  "files": [\n    "dist"\n  ]\n}\n'
    )
  })

  it("removes any item of a one-line array, and puts a list that now fits on one line", () => {
    const list = '{\n  "include": ["src", "tests", "locales"]\n}\n'
    expect(removeJson(list, ["include", 2], tsconfig)).toBe('{\n  "include": ["src", "tests"]\n}\n')
    expect(removeJson(list, ["include", 0], tsconfig)).toBe('{\n  "include": ["tests", "locales"]\n}\n')
    expect(removeJson('{\n  "include": ["src"]\n}\n', ["include", 0], tsconfig)).toBe('{\n  "include": []\n}\n')
    const broken = '{\n  "include": [\n    "src",\n    "tests",\n    "locales"\n  ]\n}\n'
    expect(removeJson(broken, ["include", 1], tsconfig)).toBe('{\n  "include": ["src", "locales"]\n}\n')
    expect(removeJson('{\n  "scripts": {\n    "dev": "vite"\n  }\n}\n', ["scripts", "dev"])).toBe(
      '{\n  "scripts": {}\n}\n'
    )
  })

  it("keeps the comments between items when it removes one", () => {
    const list =
      '{\n  "include": [\n    "src", // the app\n    // the tests\n    "tests",\n    /* last */ "locales"\n  ]\n}\n'
    expect(removeJson(list, ["include", 0], tsconfig)).toBe(
      '{\n  "include": [\n    // the app\n    // the tests\n    "tests",\n    /* last */ "locales"\n  ]\n}\n'
    )
    expect(removeJson(list, ["include", 2], tsconfig)).toBe(
      '{\n  "include": [\n    "src", // the app\n    // the tests\n    "tests"\n    /* last */\n  ]\n}\n'
    )
    const only = '{\n  "include": [\n    // the app\n    "src"\n  ]\n}\n'
    expect(removeJson(only, ["include", 0], tsconfig)).toBe('{\n  "include": [\n    // the app\n  ]\n}\n')
  })

  it("keeps how you wrote each object, and leaves a range with a comment in it as it is", () => {
    const yours = '{\n  "refs": [{ "path": "a" }, {\n    "path": "b"\n  }]\n}\n'
    expect(insertJsonArrayItem(yours, ["refs"], 2, { path: "c" }, tsconfig)).toBe(
      '{\n  "refs": [\n    { "path": "a" },\n    {\n      "path": "b"\n    },\n    {\n      "path": "c"\n    }\n  ]\n}\n'
    )
    const commented = '{\n  "include": [\n    "src" // the app\n  ]\n}\n'
    expect(insertJsonArrayItem(commented, ["include"], 1, "tests", tsconfig)).toContain("// the app")
  })

  it("fills lines with numbers, and breaks two or more lists of two or more", () => {
    expect(printJson({ ports: [3000, 3001, 3002, 3003, 3004, 3005, 3006] }, { layout: tsconfig })).toBe(
      '{\n  "ports": [\n    3000, 3001, 3002, 3003, 3004, 3005,\n    3006\n  ]\n}'
    )
    expect(
      printJson(
        [
          [1, 2],
          [3, 4]
        ],
        { layout: tsconfig }
      )
    ).toBe("[\n  [1, 2],\n  [3, 4]\n]")
    expect(printJson([["a"], ["b"]], { layout: tsconfig })).toBe('[["a"], ["b"]]')
  })

  it("puts objects on one line when asked and they fit", () => {
    expect(printJson({ a: { b: [1, 2] } }, { objects: "inline", layout: tsconfig })).toBe('{ "a": { "b": [1, 2] } }')
    expect(printJson({ locales: ["en", "fr", "de"], source: "en" }, { objects: "inline", layout: tsconfig })).toBe(
      '{\n  "locales": ["en", "fr", "de"],\n  "source": "en"\n}'
    )
    expect(stringifyJson({ a: [1], b: {} })).toBe('{\n  "a": [1],\n  "b": {}\n}\n')
  })
})
