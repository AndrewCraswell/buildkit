import { mkdtemp, rm } from "node:fs/promises"
import { createServer } from "node:net"
import os from "node:os"
import path from "node:path"
import { expect, it, vi } from "vite-plus/test"
import { reservePort } from "./port.js"

it("holds distinct ports until release and allows repeated cleanup", async () => {
  const state = await mkdtemp(path.join(os.tmpdir(), "buildkit-ports-"))
  vi.stubEnv("PORTLESS_STATE_DIR", state)
  const reservations = await Promise.all([reservePort(), reservePort()])
  try {
    expect(reservations[0]!.port).not.toBe(reservations[1]!.port)
    const server = createServer()
    await expect(
      new Promise<void>((resolve, reject) => {
        server.once("error", reject)
        server.listen(reservations[0]!.port, "127.0.0.1", resolve)
      })
    ).rejects.toMatchObject({ code: "EADDRINUSE" })
  } finally {
    await Promise.all(
      reservations.map(async (reservation) => {
        await reservation.release()
        await reservation.release()
      })
    )
    vi.unstubAllEnvs()
    await rm(state, { recursive: true, force: true })
  }
})
