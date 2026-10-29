#!/usr/bin/env node
import { createCli } from "@buildkitgg/scaffolder/cli"
import { runMain } from "citty"
import { buildkitOptions } from "./index.js"

await runMain(createCli(buildkitOptions()))
