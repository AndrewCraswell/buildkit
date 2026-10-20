#!/usr/bin/env node
import { readFileSync } from "node:fs"
import { defineCommand, runMain } from "citty"
import { z } from "zod"
import { commands } from "./commands.js"

const { version } = z
  .object({ version: z.string() })
  .parse(JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")))

await runMain(
  defineCommand({
    meta: { name: "dev-domains", version, description: "Stable local domains for every app and checkout" },
    default: "run",
    subCommands: commands
  })
)
