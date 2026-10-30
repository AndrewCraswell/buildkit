import { configureBackends } from "better-apps"
import { env } from "cloudflare:workers"
import { Miniflare } from "miniflare"
import { afterAll, afterEach, describe, expect, it } from "vite-plus/test"
import { storageBindingName } from "./cloudflare.js"
import { defineBucket, handleUpload } from "./index.js"

// Without configureBackends, buckets use R2 through the env that test/cloudflare-workers.ts stands in for.
const miniflare = new Miniflare({ modules: true, script: "export default {}", r2Buckets: ["STORAGE_AVATARS"] })

afterEach(() => {
  for (const key of Object.keys(env)) {
    delete env[key]
  }
  configureBackends({ storage: undefined })
})

afterAll(() => miniflare.dispose())

describe("the default R2 adapter", () => {
  it("derives binding names from bucket names", () => {
    expect(storageBindingName("avatars")).toBe("STORAGE_AVATARS")
    expect(storageBindingName("user-files")).toBe("STORAGE_USER_FILES")
  })

  it("finds each bucket's binding in the Worker's env", async () => {
    env.STORAGE_AVATARS = await miniflare.getR2Bucket("STORAGE_AVATARS")
    const avatars = defineBucket("avatars")

    await avatars.put("u1.png", "png", { contentType: "image/png" })

    expect(await (await avatars.get("u1.png"))?.text()).toBe("png")
  })

  it("names the binding a bucket is missing", async () => {
    await expect(defineBucket("photos").head("a")).rejects.toThrow(/STORAGE_PHOTOS/)
  })

  it("signs uploads with the Worker secret", async () => {
    env.STORAGE_AVATARS = await miniflare.getR2Bucket("STORAGE_AVATARS")
    env.STORAGE_UPLOAD_SECRET = "worker-secret"
    const avatars = defineBucket("avatars")

    const upload = await avatars.createUpload({ key: "u2.txt", contentType: "text/plain", size: 2 })
    const response = await handleUpload(
      new Request(`https://app.test${upload.url}`, {
        method: "PUT",
        headers: { "content-type": "text/plain", "content-length": "2" },
        body: "hi"
      })
    )

    expect(response?.status).toBe(201)
    expect(await (await avatars.get("u2.txt"))?.text()).toBe("hi")
  })

  it("asks for a secret before signing uploads", async () => {
    await expect(
      defineBucket("avatars").createUpload({ key: "a", contentType: "text/plain", size: 1 })
    ).rejects.toThrow(/STORAGE_UPLOAD_SECRET/)
  })

  it("leaves other requests alone without a secret", async () => {
    expect(await handleUpload(new Request("https://app.test/other"))).toBeNull()
  })

  it("refuses an empty configured secret", async () => {
    configureBackends({ storage: { uploads: { secret: "" } } })

    await expect(
      defineBucket("avatars").createUpload({ key: "a", contentType: "text/plain", size: 1 })
    ).rejects.toThrow(/empty/)
  })

  it("serves uploads at the configured URL", async () => {
    configureBackends({ storage: { uploads: { url: "https://files.app.test/up/", secret: "s" } } })
    env.STORAGE_AVATARS = await miniflare.getR2Bucket("STORAGE_AVATARS")

    const upload = await defineBucket("avatars").createUpload({ key: "a", contentType: "text/plain", size: 1 })

    expect(upload.url.startsWith("https://files.app.test/up/")).toBe(true)
    expect(await handleUpload(new Request("https://files.app.test/api/storage/upload/x"))).toBeNull()
  })
})
