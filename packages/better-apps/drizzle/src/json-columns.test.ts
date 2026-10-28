import { describe, expect, it } from "vitest"
import { fromDriverJson, toDriverJson } from "./json-columns.js"

describe("toDriverJson", () => {
  it("encodes objects and lists for columns that store text", () => {
    expect(toDriverJson({ edited: false }, { dataType: "string" })).toBe('{"edited":false}')
    expect(toDriverJson(["a", "b"], undefined)).toBe('["a","b"]')
  })

  it("leaves objects and lists to columns that encode JSON", () => {
    const value = { edited: false }
    expect(toDriverJson(value, { dataType: "json" })).toBe(value)
    expect(toDriverJson(["a"], { dataType: "array" })).toEqual(["a"])
  })

  it.each(["text", 1, null])("leaves %j unchanged", (value) => {
    expect(toDriverJson(value, { dataType: "string" })).toBe(value)
  })
})

describe("fromDriverJson", () => {
  it("parses JSON text from columns that store text", () => {
    expect(fromDriverJson('{"edited":false}', { dataType: "string" })).toEqual({ edited: false })
  })

  it("parses text from MySQL's json column, which some drivers return unparsed", () => {
    expect(fromDriverJson('["a"]', { dataType: "json", columnType: "MySqlJson" })).toEqual(["a"])
  })

  it("keeps a string that the column already decoded", () => {
    expect(fromDriverJson('["a"]', { dataType: "json", columnType: "SQLiteTextJson" })).toBe('["a"]')
  })

  it("returns text that isn't JSON as is", () => {
    expect(fromDriverJson("plain", { dataType: "string" })).toBe("plain")
  })
})
