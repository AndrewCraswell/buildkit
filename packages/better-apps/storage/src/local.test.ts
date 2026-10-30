import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, it } from "vite-plus/test"
import { fileStorage } from "./local.js"

it("publishes consistent records across independent filesystem adapters", async () => {
  const directory = await mkdtemp(join(tmpdir(), "storage-atomic-"))
  try {
    const writers = Array.from({ length: 4 }, () => fileStorage({ directory }).bucket("files"))
    const reader = fileStorage({ directory }).bucket("files")
    const options = { contentType: "text/plain", cacheControl: null, size: undefined }
    await writers[0].put("key", new TextEncoder().encode("initial"), { ...options, metadata: { text: "initial" } })
    await Promise.all([
      ...writers.map(async (writer, index) => {
        for (let round = 0; round < 12; round++) {
          const text = `${index}-${round}`.repeat(round + 1)
          await writer.put("key", new TextEncoder().encode(text), { ...options, metadata: { text } })
        }
      }),
      (async () => {
        for (let round = 0; round < 50; round++) {
          const record = await reader.get("key")
          expect(record).not.toBeNull()
          const text = await new Response(record!.body).text()
          expect(record!.object.metadata.text).toBe(text)
          expect(record!.object.size).toBe(new TextEncoder().encode(text).length)
        }
      })()
    ])
    const record = await reader.get("key")
    expect(await new Response(record!.body).text()).toBe(record!.object.metadata.text)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
