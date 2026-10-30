import { spawn } from "node:child_process"
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { parseArgs } from "node:util"

// pnpm --filter @buildkitgg/cli test:smoke [--case <name>,...] [--out <folder>] [--list]
// Generates Buildkit apps with the built CLI, then installs, checks, lints, formats, builds and type-checks each one.
// The Buildkit packages come from tarballs packed from this checkout, so each app installs what npm would ship.
// Build first: pnpm turbo run build --filter=@buildkitgg/cli...

function print(line: string) {
  process.stdout.write(`${line}\n`)
}

interface SmokeCase {
  name: string
  /** `buildkit create` arguments after the folder. */
  create: string[]
  /** Later `buildkit` commands run in the app, such as `add i18n`. */
  after: string[][]
  /** Package scripts to run after the standard checks. */
  scripts: string[]
  /** Server-rendered pages to request from the built server, and text each must contain. */
  probes?: { path: string; headers?: Record<string, string>; status: number; contains?: string }[]
  /** Why the case can't run yet. */
  skip?: string
}

const waitsOnBetterApps =
  "it needs @better-apps/sql, which isn't published or in this checkout yet (the Better Apps Features session builds it)"

const cases: SmokeCase[] = [
  {
    name: "ssr",
    create: ["--mode", "ssr"],
    after: [],
    scripts: [],
    probes: [
      { path: "/", status: 200, contains: '<html lang="en">' },
      { path: "/missing", status: 404, contains: "Page not found" }
    ]
  },
  { name: "spa", create: ["--mode", "spa"], after: [], scripts: [] },
  {
    name: "ssr-i18n",
    create: ["--mode", "ssr", "--with", "i18n", "--set", "i18n.locales=en,fr"],
    after: [],
    scripts: ["i18n:check"],
    probes: [
      { path: "/", status: 200, contains: '<html lang="en" dir="ltr">' },
      { path: "/fr", status: 200, contains: '<html lang="fr" dir="ltr">' },
      { path: "/", headers: { "accept-language": "fr-CA,fr;q=0.9" }, status: 307 }
    ]
  },
  { name: "spa-add-i18n", create: ["--mode", "spa"], after: [["add", "i18n"]], scripts: ["i18n:check"] },
  {
    name: "ssr-database",
    create: ["--mode", "ssr", "--database", "sql"],
    after: [],
    scripts: [],
    skip: waitsOnBetterApps
  },
  { name: "ssr-auth", create: ["--preset", "saas"], after: [], scripts: [], skip: waitsOnBetterApps }
]

const { values: flags } = parseArgs({
  options: {
    case: { type: "string", multiple: true, default: [] },
    out: { type: "string" },
    list: { type: "boolean", default: false }
  }
})
const wanted = flags.case.flatMap((entry) => entry.split(",")).filter(Boolean)
const selected = cases.filter((entry) => wanted.length === 0 || wanted.includes(entry.name))
if (selected.length === 0) {
  throw new Error(`No smoke case is named ${wanted.join(", ")}. Cases: ${cases.map((entry) => entry.name).join(", ")}.`)
}
if (flags.list) {
  for (const entry of selected) {
    print(
      `${entry.name.padEnd(14)} buildkit create app ${entry.create.join(" ")}${entry.skip ? ` (skipped: ${entry.skip})` : ""}`
    )
  }
  process.exit(0)
}

const cliFolder = fileURLToPath(new URL("../", import.meta.url))
const tooling = resolve(cliFolder, "..")
const bin = join(cliFolder, "dist/bin.js")
if (!existsSync(bin)) {
  throw new Error("Build the CLI first: pnpm turbo run build --filter=@buildkitgg/cli...")
}
const pnpmScript = process.env.npm_execpath
if (!pnpmScript) {
  throw new Error("Run the smoke test through pnpm: pnpm --filter @buildkitgg/cli test:smoke")
}
const outRoot = resolve(flags.out ?? join(tmpdir(), "buildkit-smoke"))
mkdirSync(outRoot, { recursive: true })
const work = mkdtempSync(join(outRoot, "run-"))

/** Runs a command and resolves with its output, or rejects with the output when it fails. */
function run(label: string, executable: string, args: string[], cwd: string, log: string[]): Promise<string> {
  return new Promise((done, fail) => {
    const child = spawn(executable, args, { cwd, windowsHide: true, env: { ...process.env, CI: "1" } })
    let output = ""
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => (output += chunk))
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => (output += chunk))
    const timer = setTimeout(() => child.kill(), 600_000)
    child.on("error", (error) => {
      clearTimeout(timer)
      fail(new Error(`${label} failed to start: ${error.message}`))
    })
    child.on("close", (status) => {
      clearTimeout(timer)
      log.push(`$ ${label}\n${output}`)
      if (status === 0) {
        done(output)
      } else {
        fail(new Error(`${label} exited with ${status}:\n${output}`))
      }
    })
  })
}

function pnpm(args: string[], cwd: string, log: string[]): Promise<string> {
  const script = pnpmScript ?? ""
  return /\.[cm]?js$/.test(script)
    ? run(`pnpm ${args.join(" ")}`, process.execPath, [script, ...args], cwd, log)
    : run(`pnpm ${args.join(" ")}`, script, args, cwd, log)
}

// Pack the Buildkit packages the app depends on, as npm would ship them.
const tarballs = join(work, "packages")
mkdirSync(tarballs)
const packed: Record<string, string> = {}
for (const [name, folder] of [
  ["@buildkitgg/scaffolder", "scaffolder"],
  ["@buildkitgg/catalog", "catalog"],
  ["@buildkitgg/cli", "cli"]
] as const) {
  const before = new Set(readdirSync(tarballs))
  await pnpm(["pack", "--pack-destination", tarballs], join(tooling, folder), [])
  const file = readdirSync(tarballs).find((entry) => !before.has(entry))
  if (!file) {
    throw new Error(`pnpm pack wrote no tarball for ${name}.`)
  }
  packed[name] = join(tarballs, file)
}
const overrides = [
  "",
  "# Added by Buildkit's smoke test: the Buildkit packages packed from the checkout under test.",
  "overrides:",
  ...Object.entries(packed).map(
    ([name, path]) => `  "${name}": ${JSON.stringify(`file:${path.replaceAll("\\", "/")}`)}`
  ),
  ""
].join("\n")

interface Result {
  name: string
  status: "passed" | "failed" | "skipped"
  detail: string
  seconds: number
}

async function check(entry: SmokeCase): Promise<Result> {
  if (entry.skip) {
    return { name: entry.name, status: "skipped", detail: entry.skip, seconds: 0 }
  }
  const started = performance.now()
  const project = join(work, entry.name)
  const log: string[] = []
  const steps: string[] = []
  const buildkit = (args: string[], cwd: string) =>
    run(`buildkit ${args.join(" ")}`, process.execPath, [bin, ...args, "--yes", "--json"], cwd, log)
  try {
    await buildkit(["create", "app", project, "--name", entry.name, ...entry.create], work)
    for (const args of entry.after) {
      await buildkit([...args, "--cwd", project], work)
    }
    steps.push("generate")
    appendFileSync(join(project, "pnpm-workspace.yaml"), overrides)
    await pnpm(["install"], project, log)
    // The overrides are the harness's own lines, so they follow the app's formatter like the rest.
    await pnpm(["exec", "oxfmt", "pnpm-workspace.yaml"], project, log)
    steps.push("install")
    for (const script of ["buildkit check", "lint", "format:check", "build", "typecheck", ...entry.scripts]) {
      await pnpm(script.split(" "), project, log)
      steps.push(script)
    }
    if (entry.probes) {
      await run(
        "probe the built server",
        process.execPath,
        ["--input-type=module", "-e", probe(entry.probes)],
        project,
        log
      )
      steps.push(`${entry.probes.length} server requests`)
    }
    return { name: entry.name, status: "passed", detail: steps.join(", "), seconds: elapsed(started) }
  } catch (error) {
    writeFileSync(join(project, "smoke.log"), log.join("\n"))
    const message = error instanceof Error ? error.message : String(error)
    return {
      name: entry.name,
      status: "failed",
      detail: `after ${steps.join(", ") || "nothing"}: ${message.split("\n").slice(0, 60).join("\n")}`,
      seconds: elapsed(started)
    }
  }
}

/** A script that requests pages from the built server's fetch handler, the way a Worker or Node host would. */
function probe(probes: NonNullable<SmokeCase["probes"]>): string {
  return `
    const { default: server } = await import("./dist/server/server.js")
    for (const probe of ${JSON.stringify(probes)}) {
      const response = await server.fetch(new Request("http://localhost" + probe.path, { headers: probe.headers }))
      const html = await response.text()
      if (response.status !== probe.status || (probe.contains && !html.includes(probe.contains))) {
        throw new Error(probe.path + " answered " + response.status + ": " + html.slice(0, 400))
      }
    }
  `
}

function elapsed(since: number): number {
  return Math.round((performance.now() - since) / 1000)
}

print(`Smoke-testing ${selected.length} case(s) in ${work}`)
const results: Result[] = []
for (const entry of selected) {
  const result = await check(entry)
  results.push(result)
  print(`${result.status.padEnd(8)} ${result.name} (${result.seconds}s): ${result.detail}`)
}
writeFileSync(join(work, "results.json"), `${JSON.stringify(results, null, 2)}\n`)
const failed = results.filter((result) => result.status === "failed")
print(
  `${results.filter((result) => result.status === "passed").length} passed, ${failed.length} failed, ${results.filter((result) => result.status === "skipped").length} skipped.`
)
if (failed.length > 0) {
  process.exitCode = 1
}
