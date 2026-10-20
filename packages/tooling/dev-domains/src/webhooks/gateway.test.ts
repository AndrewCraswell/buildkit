import { createServer } from "node:http"
import { expect, it } from "vitest"
import { startGateway } from "./gateway.js"

it("forwards exact POST paths and unmodified bytes, rejects other exposure, and closes its listener", async () => {
  const received: { body: Buffer; signature: string | string[] | undefined }[] = []
  const target = createServer(async (req, res) => {
    const chunks = []
    for await (const chunk of req) {
      chunks.push(Buffer.from(chunk))
    }
    received.push({ body: Buffer.concat(chunks), signature: req.headers["x-signature"] })
    res.writeHead(202).end("accepted")
  })
  await new Promise<void>((resolve) => target.listen(0, "127.0.0.1", resolve))
  const address = target.address()
  if (!address || typeof address === "string") {
    throw new Error("Missing test address")
  }
  let isLive = true
  const gateway = await startGateway({
    paths: ["/hooks"],
    hostname: "app.localhost",
    target: () => (isLive ? address.port : undefined),
    maxBytes: 20
  })
  try {
    const body = Buffer.from([0, 1, 2, 255])
    const result = await fetch(`${gateway.url}/hooks?event=1`, {
      method: "POST",
      body,
      headers: { "x-signature": "signed" }
    })
    expect(result.status).toBe(202)
    expect(received).toEqual([{ body, signature: "signed" }])
    expect((await fetch(`${gateway.url}/hooks`)).status).toBe(404)
    expect((await fetch(`${gateway.url}/hooks/other`, { method: "POST" })).status).toBe(404)
    expect((await fetch(`${gateway.url}/%68ooks`, { method: "POST" })).status).toBe(404)
    expect((await fetch(`${gateway.url}/hooks`, { method: "POST", body: "x".repeat(21) })).status).toBe(413)
    isLive = false
    expect((await fetch(`${gateway.url}/hooks`, { method: "POST" })).status).toBe(503)
  } finally {
    await gateway.close()
    target.closeAllConnections()
    await new Promise<void>((resolve) => target.close(() => resolve()))
  }
  await expect(fetch(gateway.url)).rejects.toThrow(Error)
})
