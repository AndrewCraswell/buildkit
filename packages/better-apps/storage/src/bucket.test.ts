import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { BetterAppsError, configureBackends } from "better-apps"
import { Miniflare } from "miniflare"
import { afterAll, beforeEach, describe, expect, it } from "vitest"
import type { StorageAdapter } from "./adapter.js"
import { r2Storage, type R2BucketLike } from "./cloudflare.js"
import { defineBucket, handleUpload } from "./index.js"
import { fileStorage, memoryStorage } from "./local.js"

const miniflare = new Miniflare({ modules: true, script: "export default {}", r2Buckets: ["FILES"] })
const directories: string[] = []

afterAll(async () => {
  await miniflare.dispose()
  await Promise.all(directories.map((directory) => rm(directory, { recursive: true, force: true })))
  configureBackends({ storage: undefined })
})

const adapters: [string, () => Promise<StorageAdapter>][] = [
  ["memory", async () => memoryStorage()],
  [
    "filesystem",
    async () => {
      const directory = await mkdtemp(join(tmpdir(), "better-apps-storage-"))
      directories.push(directory)
      return fileStorage({ directory })
    }
  ],
  [
    "R2 in Miniflare",
    async () => {
      const bucket = (await miniflare.getR2Bucket("FILES")) as unknown as R2BucketLike
      const { objects } = await bucket.list()
      if (objects.length > 0) {
        await bucket.delete(objects.map((object) => object.key))
      }
      return r2Storage({ buckets: { files: bucket } })
    }
  ]
]

function streamOf(text: string, chunkSize = 4): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text)
  let offset = 0
  return new ReadableStream({
    pull(controller) {
      if (offset >= bytes.byteLength) {
        controller.close()
        return
      }
      controller.enqueue(bytes.slice(offset, offset + chunkSize))
      offset += chunkSize
    }
  })
}

describe.each(adapters)("a bucket on %s", (_name, makeAdapter) => {
  const files = defineBucket("files")
  const images = defineBucket("files", { maxSize: 10, contentTypes: ["image/*", "application/pdf"] })

  beforeEach(async () => {
    configureBackends({ storage: { adapter: await makeAdapter(), uploads: { secret: "test-secret" } } })
  })

  it("stores, reads and describes objects", async () => {
    const stored = await files.put("notes/a.txt", "hello", {
      contentType: "text/plain",
      cacheControl: "max-age=60",
      metadata: { owner: "u1" }
    })

    expect(stored).toMatchObject({
      key: "notes/a.txt",
      size: 5,
      contentType: "text/plain",
      cacheControl: "max-age=60",
      metadata: { owner: "u1" }
    })
    expect(stored.etag).not.toBe("")
    expect(stored.uploadedAt).toBeInstanceOf(Date)

    const read = await files.get("notes/a.txt")
    expect(await read?.text()).toBe("hello")
    expect(read).toMatchObject({ size: 5, etag: stored.etag, metadata: { owner: "u1" } })
    expect(await files.head("notes/a.txt")).toMatchObject({ size: 5, etag: stored.etag })
  })

  it("returns null for missing objects", async () => {
    expect(await files.get("missing")).toBeNull()
    expect(await files.head("missing")).toBeNull()
  })

  it("stores byte arrays, blobs and streams", async () => {
    await files.put("bytes", new Uint8Array([1, 2, 3]))
    await files.put("view", new DataView(new Uint8Array([9, 8, 7, 6]).buffer, 1, 2))
    await files.put("blob", new Blob(['{"a":1}'], { type: "application/json" }))
    await files.put("stream", streamOf("streamed text"), { size: 13 })
    await files.put("unsized", streamOf("no size"))

    expect(new Uint8Array(await (await files.get("bytes"))!.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]))
    expect(new Uint8Array(await (await files.get("view"))!.arrayBuffer())).toEqual(new Uint8Array([8, 7]))
    const blob = await files.get("blob")
    expect(blob?.contentType).toBe("application/json")
    expect(await blob?.json()).toEqual({ a: 1 })
    expect(await (await files.get("stream"))!.text()).toBe("streamed text")
    expect(await (await files.get("unsized"))!.text()).toBe("no size")
  })

  it("holds streams to their declared size", async () => {
    await expect(files.put("long", streamOf("longer than declared"), { size: 4 })).rejects.toMatchObject({
      code: "LIMIT_EXCEEDED",
      status: 413
    })
    await expect(files.put("short", streamOf("ab"), { size: 4 })).rejects.toMatchObject({ code: "INVALID_INPUT" })
    await expect(images.put("big.png", streamOf("png"), { size: 11, contentType: "image/png" })).rejects.toMatchObject({
      code: "LIMIT_EXCEEDED"
    })

    expect((await files.list()).objects).toEqual([])
  })

  it("replaces and deletes objects", async () => {
    await files.put("a", "one")
    await files.put("a", "two")
    await files.put("b", "b")
    await files.put("c", "c")

    expect(await (await files.get("a"))!.text()).toBe("two")

    await files.delete("a")
    await files.delete(["b", "c", "never-stored"])
    await files.delete([])

    expect((await files.list()).objects).toEqual([])
  })

  it("lists in key order, by prefix and in pages", async () => {
    for (const key of ["b", "a/2", "a/1", "c/x/1", "c/y", "d"]) {
      await files.put(key, key)
    }

    const all = await files.list()
    expect(all.objects.map((object) => object.key)).toEqual(["a/1", "a/2", "b", "c/x/1", "c/y", "d"])
    expect(all.cursor).toBeUndefined()

    expect((await files.list({ prefix: "c/" })).objects.map((object) => object.key)).toEqual(["c/x/1", "c/y"])

    const keys: string[] = []
    let cursor: string | undefined
    do {
      const page = await files.list({ limit: 4, cursor })
      keys.push(...page.objects.map((object) => object.key))
      cursor = page.cursor
    } while (cursor)
    expect(keys).toEqual(["a/1", "a/2", "b", "c/x/1", "c/y", "d"])
  })

  it("groups keys into prefixes with a delimiter", async () => {
    for (const key of ["a/1", "a/2", "b", "c/x/1", "c/y"]) {
      await files.put(key, key)
    }

    const top = await files.list({ delimiter: "/" })
    expect(top.objects.map((object) => object.key)).toEqual(["b"])
    expect(top.prefixes).toEqual(["a/", "c/"])

    const inC = await files.list({ prefix: "c/", delimiter: "/" })
    expect(inC.objects.map((object) => object.key)).toEqual(["c/y"])
    expect(inC.prefixes).toEqual(["c/x/"])
  })

  it("enforces the bucket's size and type limits", async () => {
    await expect(images.put("a.png", "12345678901", { contentType: "image/png" })).rejects.toMatchObject({
      code: "LIMIT_EXCEEDED",
      status: 413
    })
    await expect(images.put("a.txt", "hi", { contentType: "text/plain" })).rejects.toMatchObject({
      code: "UNSUPPORTED_MEDIA_TYPE",
      status: 415
    })
    await expect(images.put("a", "hi")).rejects.toBeInstanceOf(BetterAppsError)
    await expect(
      images.put("big.png", streamOf("a stream past the limit"), { contentType: "image/png" })
    ).rejects.toMatchObject({ code: "LIMIT_EXCEEDED" })
    await expect(
      images.put("big.png", new Blob(["a blob past the limit"], { type: "image/png" }))
    ).rejects.toMatchObject({ code: "LIMIT_EXCEEDED" })

    await images.put("a.pdf", "%PDF", { contentType: "application/pdf; version=1.7" })
    await images.put("b.png", streamOf("png"), { contentType: "IMAGE/PNG" })
    expect((await files.list()).objects.map((object) => object.key)).toEqual(["a.pdf", "b.png"])
  })

  it("rejects empty and oversized keys", async () => {
    await expect(files.put("", "x")).rejects.toMatchObject({ code: "INVALID_INPUT" })
    await expect(files.get("k".repeat(1025))).rejects.toMatchObject({ code: "INVALID_INPUT" })
  })

  it("serves objects with caching and safety headers", async () => {
    const stored = await files.put("docs/report.html", "<p>hi</p>", { contentType: "text/html" })

    const response = await files.serve("docs/report.html")
    expect(response.status).toBe(200)
    expect(await response.text()).toBe("<p>hi</p>")
    expect(response.headers.get("content-type")).toBe("text/html")
    expect(response.headers.get("content-length")).toBe("9")
    expect(response.headers.get("etag")).toBe(`"${stored.etag}"`)
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    expect(response.headers.get("content-security-policy")).toContain("sandbox")

    const cached = await files.serve(
      "docs/report.html",
      new Request("https://app.test/f", { headers: { "if-none-match": `W/"${stored.etag}", "other"` } })
    )
    expect(cached.status).toBe(304)
    expect(await cached.text()).toBe("")

    const head = await files.serve("docs/report.html", new Request("https://app.test/f", { method: "HEAD" }))
    expect(head.status).toBe(200)
    expect(await head.text()).toBe("")

    const download = await files.serve("docs/report.html", undefined, { download: true, cacheControl: "no-store" })
    expect(download.headers.get("content-disposition")).toBe("attachment; filename*=UTF-8''report.html")
    expect(download.headers.get("cache-control")).toBe("no-store")
    expect(download.headers.get("content-security-policy")).toContain("sandbox")
    await download.body?.cancel()

    const named = await files.serve("docs/report.html", undefined, { download: "Q3 report.html" })
    expect(named.headers.get("content-disposition")).toBe("attachment; filename*=UTF-8''Q3%20report.html")
    await named.body?.cancel()

    expect((await files.serve("missing")).status).toBe(404)
  })

  it("takes uploads from signed URLs", async () => {
    const upload = await images.createUpload({ key: "avatars/u1.png", contentType: "image/png", size: 4 })
    expect(upload).toMatchObject({ method: "PUT", headers: { "content-type": "image/png" } })
    expect(upload.url.startsWith("/api/storage/upload/")).toBe(true)
    expect(upload.expiresAt.getTime()).toBeGreaterThan(Date.now())

    const response = await handleUpload(
      new Request(`https://app.test${upload.url}`, {
        method: "PUT",
        headers: { "content-type": "image/png", "content-length": "4" },
        body: "PNG!"
      })
    )

    expect(response?.status).toBe(201)
    expect(await response?.json()).toMatchObject({ key: "avatars/u1.png", size: 4, contentType: "image/png" })
    expect(await (await images.get("avatars/u1.png"))!.text()).toBe("PNG!")
  })

  it("checks uploads against their signed limits", async () => {
    const upload = await images.createUpload({ key: "a.png", contentType: "image/png", size: 4 })
    const url = `https://app.test${upload.url}`
    const send = (init: RequestInit) => handleUpload(new Request(url, init))

    expect(await handleUpload(new Request("https://app.test/somewhere-else"))).toBeNull()
    expect((await send({ method: "POST", body: "abcd" }))?.status).toBe(405)

    const dot = url.lastIndexOf(".") + 1
    const forged = url.slice(0, dot) + (url[dot] === "A" ? "B" : "A") + url.slice(dot + 1)
    const tampered = await handleUpload(
      new Request(forged, {
        method: "PUT",
        headers: { "content-type": "image/png" },
        body: "abcd"
      })
    )
    expect(tampered?.status).toBe(403)
    expect(
      (await handleUpload(new Request("https://app.test/api/storage/upload/not-a-token", { method: "PUT" })))?.status
    ).toBe(403)

    const wrongType = await send({ method: "PUT", headers: { "content-type": "image/gif" }, body: "abcd" })
    expect(wrongType?.status).toBe(415)

    const tooLong = await send({
      method: "PUT",
      headers: { "content-type": "image/png", "content-length": "5" },
      body: "abcde"
    })
    expect(tooLong?.status).toBe(400)
    expect(await images.head("a.png")).toBeNull()

    // The header matches the grant, but the body runs over or stops short.
    const overrun = await send({
      method: "PUT",
      headers: { "content-type": "image/png", "content-length": "4" },
      body: "abcdef"
    })
    expect(overrun?.status).toBe(413)
    const underrun = await send({
      method: "PUT",
      headers: { "content-type": "image/png", "content-length": "4" },
      body: "ab"
    })
    expect(underrun?.status).toBe(400)
    expect(await images.head("a.png")).toBeNull()

    await expect(images.createUpload({ key: "b.png", contentType: "image/png", size: 11 })).rejects.toMatchObject({
      code: "LIMIT_EXCEEDED"
    })
    await expect(images.createUpload({ key: "b.txt", contentType: "text/plain", size: 1 })).rejects.toMatchObject({
      code: "UNSUPPORTED_MEDIA_TYPE"
    })
    await expect(images.createUpload({ key: "b.png", contentType: "image/png", size: -1 })).rejects.toMatchObject({
      code: "INVALID_INPUT"
    })
  })

  it("takes empty uploads", async () => {
    const upload = await files.createUpload({ key: "empty.txt", contentType: "text/plain", size: 0 })

    const response = await handleUpload(
      new Request(`https://app.test${upload.url}`, {
        method: "PUT",
        headers: { "content-type": "text/plain", "content-length": "0" }
      })
    )

    expect(response?.status).toBe(201)
    expect(await files.head("empty.txt")).toMatchObject({ size: 0 })
  })

  it("refuses expired upload URLs", async () => {
    const upload = await files.createUpload({ key: "late.txt", contentType: "text/plain", size: 1 }, { expiresIn: -1 })

    const response = await handleUpload(
      new Request(`https://app.test${upload.url}`, {
        method: "PUT",
        headers: { "content-type": "text/plain" },
        body: "x"
      })
    )

    expect(response?.status).toBe(403)
  })
})

describe("defineBucket", () => {
  it("refuses names R2 can't use", () => {
    expect(() => defineBucket("Uploads")).toThrow(/lowercase/)
    expect(() => defineBucket("my_files")).toThrow(/lowercase/)
  })
})
