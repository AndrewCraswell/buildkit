import { spawn } from "node:child_process"
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { z } from "zod"
import type { CatalogManifest } from "../manifest/types.js"
import { PlanError } from "../plan/errors.js"
import { isRecord } from "../plan/json.js"
import type { ProductSettings } from "../state/settings.js"
import { isValidVersion } from "../upgrade/semver.js"

export type CommandRunner = (command: string, args: string[], cwd: string) => Promise<{ code: number; output: string }>

const packageNamePattern = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/
const integritySchema = z.object({ name: z.string(), version: z.string(), integrity: z.string() })

export const runCommand: CommandRunner = (command, args, cwd) =>
  new Promise((resolve, reject) => {
    const windows = process.platform === "win32"
    const child = spawn(windows ? `${command}.cmd` : command, args, {
      cwd,
      shell: windows,
      stdio: ["ignore", "pipe", "pipe"]
    })
    let output = ""
    child.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()))
    child.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()))
    child.on("error", reject)
    child.on("close", (code) => resolve({ code: code ?? 1, output }))
  })

export function isCatalogManifest(value: unknown): value is CatalogManifest {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.version === "string" &&
    Array.isArray(value.facets) &&
    Array.isArray(value.targets) &&
    Array.isArray(value.templates) &&
    Array.isArray(value.slots) &&
    Array.isArray(value.addons)
  )
}

/**
 * Earlier catalog versions, cached under the state folder so old baselines render offline. Fetched packages are
 * installed without running their scripts, and each one's integrity is checked before its code is imported.
 */
export class CatalogStore {
  readonly #root: string
  readonly #settings: ProductSettings
  readonly #installed: CatalogManifest
  readonly #run: CommandRunner
  readonly #loaded = new Map<string, CatalogManifest>()

  constructor(options: { root: string; settings: ProductSettings; installed: CatalogManifest; run?: CommandRunner }) {
    this.#root = options.root
    this.#settings = options.settings
    this.#installed = options.installed
    this.#run = options.run ?? runCommand
    this.#loaded.set(options.installed.version, options.installed)
  }

  folder(version: string): string {
    return join(this.#root, this.#settings.stateDir, "catalogs", version)
  }

  /** A loaded catalog version, for the planner's `catalogs` lookup. */
  get(version: string): CatalogManifest | undefined {
    return this.#loaded.get(version)
  }

  #check(version: string) {
    if (!isValidVersion(version) || !packageNamePattern.test(this.#installed.id)) {
      throw new PlanError("E_USAGE", `${this.#installed.id}@${version} isn't a valid catalog version.`)
    }
  }

  /** Downloads a catalog version into the cache and records its integrity. */
  async fetch(
    version: string,
    expectedIntegrity?: string
  ): Promise<{ version: string; integrity: string; folder: string }> {
    this.#check(version)
    const folder = this.folder(version)
    rmSync(folder, { recursive: true, force: true })
    mkdirSync(folder, { recursive: true })
    writeFileSync(join(folder, "package.json"), `${JSON.stringify({ private: true }, null, 2)}\n`)
    const spec = `${this.#installed.id}@${version}`
    const result = await this.#run(
      "npm",
      ["install", spec, "--ignore-scripts", "--no-audit", "--no-fund", "--save-exact"],
      folder
    )
    if (result.code !== 0) {
      rmSync(folder, { recursive: true, force: true })
      throw new PlanError(
        "E_BASELINE_UNAVAILABLE",
        `Couldn't fetch ${spec}: ${result.output.trim().split("\n").slice(-3).join(" ")}`
      )
    }
    const integrity = this.#lockedIntegrity(folder)
    if (expectedIntegrity !== undefined && integrity !== expectedIntegrity) {
      rmSync(folder, { recursive: true, force: true })
      throw new PlanError(
        "E_BASELINE_UNAVAILABLE",
        `${spec} doesn't match the integrity recorded in the lock, so it wasn't used.`
      )
    }
    writeFileSync(
      join(folder, "integrity.json"),
      `${JSON.stringify({ name: this.#installed.id, version, integrity }, null, 2)}\n`
    )
    return { version, integrity, folder }
  }

  #lockedIntegrity(folder: string): string {
    const lock: unknown = JSON.parse(readFileSync(join(folder, "package-lock.json"), "utf8"))
    const packages = isRecord(lock) && isRecord(lock.packages) ? lock.packages : {}
    const entry = packages[`node_modules/${this.#installed.id}`]
    if (!isRecord(entry) || typeof entry.integrity !== "string") {
      throw new PlanError("E_BASELINE_UNAVAILABLE", `npm didn't record an integrity for ${this.#installed.id}.`)
    }
    return entry.integrity
  }

  /** Loads a cached version after checking its integrity. Returns `undefined` when it isn't cached. */
  async load(version: string, expectedIntegrity?: string): Promise<CatalogManifest | undefined> {
    const loaded = this.#loaded.get(version)
    if (loaded) {
      return loaded
    }
    this.#check(version)
    const folder = this.folder(version)
    if (!statSync(join(folder, "integrity.json"), { throwIfNoEntry: false })) {
      return undefined
    }
    const recorded = integritySchema.safeParse(JSON.parse(readFileSync(join(folder, "integrity.json"), "utf8")))
    const integrity = this.#lockedIntegrity(folder)
    if (
      !recorded.success ||
      recorded.data.integrity !== integrity ||
      (expectedIntegrity !== undefined && integrity !== expectedIntegrity)
    ) {
      throw new PlanError(
        "E_BASELINE_UNAVAILABLE",
        `The cached ${this.#installed.id}@${version} failed its integrity check. Fetch it again.`
      )
    }
    const packageFolder = join(folder, "node_modules", ...this.#installed.id.split("/"))
    const module: unknown = await import(pathToFileURL(join(packageFolder, entryFile(packageFolder))).href)
    const catalog = isRecord(module) ? (module.default ?? module.catalog) : undefined
    if (!isCatalogManifest(catalog) || catalog.version !== version) {
      throw new PlanError(
        "E_BASELINE_UNAVAILABLE",
        `${this.#installed.id}@${version} doesn't export a catalog for that version.`
      )
    }
    this.#loaded.set(version, catalog)
    return catalog
  }
}

function entryFile(packageFolder: string): string {
  const manifest: unknown = JSON.parse(readFileSync(join(packageFolder, "package.json"), "utf8"))
  if (!isRecord(manifest)) {
    return "index.js"
  }
  const root = isRecord(manifest.exports) ? (manifest.exports["."] ?? manifest.exports) : manifest.exports
  if (typeof root === "string") {
    return root
  }
  if (isRecord(root)) {
    const target = root.import ?? root.default
    if (typeof target === "string") {
      return target
    }
  }
  return typeof manifest.main === "string" ? manifest.main : "index.js"
}
