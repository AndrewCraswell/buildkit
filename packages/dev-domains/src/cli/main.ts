#!/usr/bin/env node
import { defineCommand, runMain } from "citty"
import { commands } from "./commands.js"

await runMain(
  defineCommand({
    meta: { name: "dev-domains", version: "0.1.0", description: "Stable local domains for every app and checkout" },
    default: "run",
    subCommands: commands
  })
)
