import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { delimiter, join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
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

  it("runs a command it finds on PATH from another folder, as npm is", async () => {
    // npm.cmd finds npm through its own folder, %~dp0, which cmd.exe gets wrong for a quoted name it finds on PATH.
    const bin = join(root, "bin")
    const elsewhere = join(root, "elsewhere")
    mkdirSync(bin)
    mkdirSync(elsewhere)
    writeFileSync(join(bin, "probe.js"), "console.log(JSON.stringify(process.argv.slice(2)))")
    if (windows) {
      writeFileSync(join(bin, "probe.cmd"), `@"${process.execPath}" "%~dp0probe.js" %*\r\n`)
    } else {
      writeFileSync(join(bin, "probe"), `#!/bin/sh\nexec "${process.execPath}" "$(dirname "$0")/probe.js" "$@"\n`)
      chmodSync(join(bin, "probe"), 0o755)
    }
    vi.stubEnv("PATH", `${bin}${delimiter}${process.env.PATH ?? ""}`)
    try {
      const result = await runCommand("probe", ["view", "@acme/tower@>=1 <2", "version"], elsewhere)
      expect(result.code).toBe(0)
      expect(JSON.parse(result.output)).toEqual(["view", "@acme/tower@>=1 <2", "version"])
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it.runIf(windows)("refuses an argument cmd.exe would read inside quotes", async () => {
    await expect(runCommand(echoCommand(), ["@acme/tower@%PATH%"], root)).rejects.toMatchObject({ code: "E_USAGE" })
  })
})
