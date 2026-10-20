import { createServer, request, type IncomingHttpHeaders } from "node:http"
import { pipeline } from "node:stream"

function headersForUpstream(headers: IncomingHttpHeaders, host: string) {
  const clean: IncomingHttpHeaders = { ...headers, host }
  const excluded = [
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
    "forwarded",
    "x-forwarded-for",
    "x-forwarded-host",
    ...(headers.connection?.split(",").map((name) => name.trim().toLowerCase()) ?? [])
  ]
  for (const header of excluded) {
    delete clean[header]
  }
  return clean
}

/** Loopback-only, POST-only gateway. Bodies are opaque and never logged or persisted. */
export async function startGateway(options: {
  paths: string[]
  hostname: string
  target: () => number | undefined
  maxBytes?: number
}) {
  const server = createServer(async (req, res) => {
    const rawPath = req.url?.split("?")[0] || ""
    if (req.method !== "POST" || !options.paths.includes(rawPath)) {
      res.writeHead(404).end()
      return
    }
    const port = options.target()
    if (!port) {
      res.writeHead(503).end("Start the local endpoint first")
      return
    }
    const chunks: Buffer[] = []
    let size = 0
    try {
      for await (const chunk of req) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        size += buffer.length
        if (size > (options.maxBytes ?? 1048576)) {
          res.writeHead(413).end()
          return
        }
        chunks.push(buffer)
      }
      const body = Buffer.concat(chunks)
      const upstream = request(
        {
          host: "127.0.0.1",
          port,
          path: req.url,
          method: "POST",
          headers: { ...headersForUpstream(req.headers, options.hostname), "content-length": body.length },
          timeout: 15000
        },
        (response) => {
          const headers = headersForUpstream(response.headers, options.hostname)
          delete headers.host
          res.writeHead(response.statusCode || 502, headers)
          pipeline(response, res, () => {
            upstream.destroy()
          })
        }
      )
      upstream.on("timeout", () => upstream.destroy(new Error("Webhook target timed out")))
      upstream.on("error", () => {
        if (!res.headersSent) {
          res.writeHead(502)
        }
        res.end()
      })
      res.on("close", () => upstream.destroy())
      upstream.end(body)
    } catch {
      if (!res.headersSent) {
        res.writeHead(400)
      }
      res.end()
    }
  })
  server.requestTimeout = 15000
  server.headersTimeout = 10000
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", resolve)
  })
  const address = server.address()
  if (!address || typeof address === "string") {
    throw new Error("Cannot resolve webhook gateway address")
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: async () => {
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
    }
  }
}
