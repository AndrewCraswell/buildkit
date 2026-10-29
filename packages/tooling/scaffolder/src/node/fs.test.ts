import { describe, expect, it } from "vitest"
import { withRetries } from "./fs.js"

function failure(code: string): Error {
  return Object.assign(new Error(`${code}: operation not permitted`), { code })
}

describe("withRetries", () => {
  it("retries while Windows holds the file, then succeeds", async () => {
    let calls = 0
    const result = await withRetries(() => {
      calls++
      if (calls < 3) {
        throw failure(calls === 1 ? "EPERM" : "EBUSY")
      }
      return "renamed"
    })
    expect({ result, calls }).toEqual({ result: "renamed", calls: 3 })
  })

  it("gives up after its attempts, and never retries other errors", async () => {
    let calls = 0
    await expect(
      withRetries(() => {
        calls++
        throw failure("EACCES")
      }, 3)
    ).rejects.toMatchObject({ code: "EACCES" })
    expect(calls).toBe(3)

    calls = 0
    await expect(
      withRetries(() => {
        calls++
        throw failure("ENOSPC")
      })
    ).rejects.toMatchObject({ code: "ENOSPC" })
    expect(calls).toBe(1)
  })
})
