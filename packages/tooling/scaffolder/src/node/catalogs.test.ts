import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { runCommand } from "./catalogs.js"

const windows = process.platform === "win32"
const printArgs = "console.log(JSON.stringify(process.argv.slice(1)))"
let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "scaffolder-run-"))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

/** A command that prints its arguments as JSON: a .cmd file on Windows, as npm is, and a shell script elsewhere. */
function echoCommand(): string {
  const command = join(root, "echo-args")
  if (windows) {
    writeFileSync(`${command}.cmd`, `@"${process.execPath}" -e "${printArgs}" %*\r\n`)
  } else {
    writeFileSync(command, `#!/bin/sh\nexec "${process.execPath}" -e '${printArgs}' "$@"\n`)
    chmodSync(command, 0o755)
  }
  return command
}

describe("runCommand", () => {
  it("passes version ranges through unchanged", async () => {
    const args = ["view", "@acme/tower@^2", ">=1.2", "1.x||2.x", "<3", "a&b", "trailing\\"]
    const result = await runCommand(echoCommand(), args, root)
    expect(result.code).toBe(0)
    expect(JSON.parse(result.output)).toEqual(args)
  })

  it.runIf(windows)("refuses an argument cmd.exe would read inside quotes", async () => {
    await expect(runCommand(echoCommand(), ["@acme/tower@%PATH%"], root)).rejects.toMatchObject({ code: "E_USAGE" })
  })
})
