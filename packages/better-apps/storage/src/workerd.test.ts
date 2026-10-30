// Runs the R2 adapter inside workerd, where `cloudflare:workers` and `FixedLengthStream` exist, so streamed puts take
// the path they take in production. Tests run before the package builds, so the adapter's source loads with its types
// stripped.
import { readFileSync } from "node:fs"
import { stripTypeScriptTypes } from "node:module"
import { Miniflare } from "miniflare"
import { afterAll, describe, expect, it } from "vitest"
import type { R2BucketLike } from "./cloudflare.js"

function compile(file: string): string {
  return stripTypeScriptTypes(readFileSync(new URL(file, import.meta.url), "utf8"))
}

const worker = `
import { r2Storage } from "./cloudflare.js"
import { exactLength } from "./limits.js"

function chunks(parts, failAfter) {
  let index = 0
  return new ReadableStream({
    pull(controller) {
      if (index === failAfter) {
        controller.error(new Error("past the limit"))
        return
      }
      if (index === parts.length) {
        controller.close()
        return
      }
      controller.enqueue(new TextEncoder().encode(parts[index++]))
    }
  })
}

export default {
  async fetch(request) {
    const files = r2Storage().bucket("files")
    const options = { size: 9, contentType: "text/plain", cacheControl: null, metadata: {} }
    const path = new URL(request.url).pathname
    if (path === "/overrun") {
      // Every promised byte arrives before the extra ones, as from a client that sends more than it declared.
      try {
        const parts = new URL(request.url).searchParams.has("empty") ? ["abcd", "", "ef"] : ["abcd", "ef"]
        await files.put("overrun.txt", exactLength(chunks(parts), 4), { ...options, size: 4 })
        return new Response("stored")
      } catch (error) {
        return new Response(error.code)
      }
    }
    if (path === "/fail") {
      try {
        await files.put("broken.txt", chunks(["abc", "def", "ghi"], 1), options)
        return new Response("stored")
      } catch (error) {
        return new Response(error.message)
      }
    }
    const stored = await files.put("streamed.txt", chunks(["abc", "def", "ghi"]), options)
    const read = await files.get("streamed.txt")
    return Response.json({ size: stored.size, text: await new Response(read.body).text() })
  }
}
`

const miniflare = new Miniflare({
  compatibilityDate: "2026-07-01",
  modules: [
    { type: "ESModule", path: "worker.js", contents: worker },
    { type: "ESModule", path: "cloudflare.js", contents: compile("./cloudflare.ts") },
    { type: "ESModule", path: "bytes.js", contents: compile("./bytes.ts") },
    { type: "ESModule", path: "limits.js", contents: compile("./limits.ts") },
    {
      type: "ESModule",
      path: "better-apps",
      contents: `export class BetterAppsError extends Error {
        constructor(code, message) { super(message); this.code = code }
      }`
    }
  ],
  r2Buckets: ["STORAGE_FILES"]
})

afterAll(() => miniflare.dispose())

describe("the R2 adapter in workerd", () => {
  it("streams a body of known size into the bucket bound by its derived name", async () => {
    const response = await miniflare.dispatchFetch("http://worker.test/")

    expect(await response.json()).toEqual({ size: 9, text: "abcdefghi" })
  })

  it("stores nothing when an upload runs past its length after the last promised byte", async () => {
    const bucket = (await miniflare.getR2Bucket("STORAGE_FILES")) as unknown as R2BucketLike
    for (const url of ["http://worker.test/overrun", "http://worker.test/overrun?empty"]) {
      const response = await miniflare.dispatchFetch(url)

      expect(await response.text()).toBe("LIMIT_EXCEEDED")
      expect(await bucket.head("overrun.txt")).toBeNull()
    }
  })

  it("reports the body's own error when the stream fails", async () => {
    const response = await miniflare.dispatchFetch("http://worker.test/fail")

    expect(await response.text()).toBe("past the limit")
    const bucket = (await miniflare.getR2Bucket("STORAGE_FILES")) as unknown as R2BucketLike
    expect(await bucket.head("broken.txt")).toBeNull()
  })
})
