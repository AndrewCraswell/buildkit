import { resolve } from "node:path"
import { isTemplatePack, templateSource, type TemplateSource } from "../manifest/packs.js"
import type { CatalogManifest } from "../manifest/types.js"
import { isCatalogManifest, PackStore, userCacheDir, type CommandRunner } from "../node/catalogs.js"
import { readPlanFile } from "../node/project.js"
import { exitCode, type Envelope } from "../plan/envelope.js"
import { errorInfo, PlanError } from "../plan/errors.js"
import { isRecord } from "../plan/json.js"
import { defineSettings, type ProductSettings } from "../state/settings.js"
import { isValidVersion } from "../upgrade/semver.js"
import type { CliIo } from "./commands.js"
import { runCli } from "./create.js"
import { describeEnvelope } from "./output.js"
import { cancelled, clackPrompter } from "./prompter.js"

export interface ScaffoldOptions {
  version: string
  io?: Partial<CliIo>
  /** Runs npm to fetch packages. */
  runCommand?: CommandRunner
  /** Where fetched packages are cached. Defaults to the `scaffold` folder in the user's cache folder. */
  cacheDir?: string
  /** The catalog package to create from when the arguments name none. Defaults to `@buildkitgg/catalog`. */
  defaultPackage?: string
}

const defaultPackage = "@buildkitgg/catalog"

const usage = `Usage: scaffold [package][@version][#template] [folder] [options]
       scaffold [template] [folder] [options]

Creates a project from a catalog package, or from a template package that extends one. A scoped name, or any name after
npm:, is a package; without one, the project comes from @buildkitgg/catalog. The package is fetched from npm into your
cache, and every option create takes works here: --mode, --preset, --name, --with, --without, --set, --adopt,
--dry-run, --json and --yes.
`

/**
 * `scaffold [package] [folder]`: fetches a catalog package, by default `@buildkitgg/catalog`, or a template package and the catalog it extends, into the
 * user's cache and creates a project from it. A catalog package exports its catalog as `catalog` or by default, and its
 * product settings as `settings`. Product CLIs call `create` instead, with their catalog installed.
 */
export async function runScaffold(argv: readonly string[], options: ScaffoldOptions): Promise<number> {
  const io: CliIo = {
    stdout: options.io?.stdout ?? ((text) => process.stdout.write(text)),
    stderr: options.io?.stderr ?? ((text) => process.stderr.write(text)),
    isTTY: options.io?.isTTY ?? (process.stdout.isTTY === true && process.stdin.isTTY === true),
    prompter: options.io?.prompter ?? clackPrompter,
    cwd: options.io?.cwd ?? process.cwd()
  }
  const [first] = argv
  if (first === "--help" || first === "-h") {
    io.stdout(usage)
    return 0
  }
  if (first === "--version" || first === "-v") {
    io.stdout(`${options.version}\n`)
    return 0
  }
  const json = argv.includes("--json")
  const cacheDir = options.cacheDir ?? userCacheDir(defineSettings({ product: "scaffold" }))
  const store = new PackStore({ cacheRoot: cacheDir, ...(options.runCommand ? { run: options.runCommand } : {}) })
  try {
    // A package is named as create names a template package. Anything else is for the default catalog.
    const named = first !== undefined && (first.startsWith("@") || first.startsWith("npm:"))
    const source = (named ? templateSource(first) : undefined) ?? {
      package: options.defaultPackage ?? defaultPackage,
      range: "latest"
    }
    const rest = named ? argv.slice(1) : argv
    // A saved plan names the versions it was reviewed with, so no newer package's code runs before it's checked.
    const planPath = flagValue(rest, "plan")
    const reviewed = planPath === undefined ? undefined : readPlanFile(resolve(io.cwd, planPath))
    const recorded = reviewed ? recordedVersion(reviewed, source) : undefined
    const version = recorded?.version ?? (await store.resolve(source.package, source.range))
    const { integrity, module } = await store.import(source.package, version, recorded?.integrity)
    const cli = {
      name: "scaffold",
      version: options.version,
      io,
      cacheDir,
      ...(options.runCommand ? { runCommand: options.runCommand } : {})
    }
    const pack = isRecord(module) ? module.default : undefined
    if (isTemplatePack(pack)) {
      const planned = reviewed?.catalog?.id === pack.extends.catalog ? reviewed.catalog : undefined
      const base = await loadCatalog(
        store,
        pack.extends.catalog,
        planned?.version ?? (await store.resolve(pack.extends.catalog, pack.extends.versions)),
        planned?.integrity
      )
      if (reviewed) {
        // create loads the template package version the plan records.
        return await runCli(["create", ...rest], { ...cli, ...base })
      }
      const spec = `${specPrefix(source.package)}${source.package}@${version}${source.template === undefined ? "" : `#${source.template}`}`
      return await runCli(["create", spec, ...rest], { ...cli, ...base })
    }
    const loaded = catalogModule(module, `${source.package}@${version}`)
    // With --preset, the template comes from the preset, and with --plan, from the plan. For the default catalog, a
    // first argument that isn't one of its templates is the folder.
    const leading = rest[0]?.startsWith("-") === false ? rest[0] : undefined
    const namesTemplate = !named && loaded.catalog.templates.some((each) => each.id === leading)
    const template =
      reviewed || namesTemplate || flagValue(rest, "preset") !== undefined
        ? undefined
        : await pickTemplate(loaded.catalog, source, io, json || rest.includes("--yes") || rest.includes("-y"))
    if (template === cancelled) {
      const error = { code: "E_CANCELLED", message: "Cancelled. Nothing was changed.", retryable: false } as const
      return emit(io, { status: "error", error }, json)
    }
    const create = template === undefined ? ["create", ...rest] : ["create", template, ...rest]
    return await runCli(create, { ...cli, ...loaded, catalogIntegrity: integrity })
  } catch (error) {
    return emit(io, { status: "error", error: errorInfo(error) }, json)
  }
}

/** A flag's value, written as `--name value` or `--name=value`. */
function flagValue(args: readonly string[], name: string): string | undefined {
  const flag = `--${name}`
  for (const [index, arg] of args.entries()) {
    if (arg === flag) {
      return args[index + 1] ?? ""
    }
    if (arg.startsWith(`${flag}=`)) {
      return arg.slice(flag.length + 1)
    }
  }
  return undefined
}

/**
 * The version of the named package that a saved plan was made with: a template package's from the plan's packages, a
 * catalog's from its catalog, or the exact version the argument names, for a plan that records neither.
 */
function recordedVersion(
  reviewed: ReturnType<typeof readPlanFile>,
  source: TemplateSource
): { version: string; integrity?: string } {
  const recorded =
    reviewed.packs?.[source.package] ?? (reviewed.catalog?.id === source.package ? reviewed.catalog : undefined)
  if (recorded) {
    return recorded
  }
  if (isValidVersion(source.range)) {
    return { version: source.range }
  }
  throw new PlanError(
    "E_USAGE",
    `The plan doesn't record which version of ${source.package} it was made with. Name it: ${source.package}@<version>.`
  )
}

function specPrefix(name: string): string {
  return name.startsWith("@") ? "" : "npm:"
}

async function loadCatalog(store: PackStore, name: string, version: string, expectedIntegrity?: string) {
  const { integrity, module } = await store.import(name, version, expectedIntegrity)
  return { ...catalogModule(module, `${name}@${version}`), catalogIntegrity: integrity }
}

/** A catalog package's catalog and product settings. Without settings, the project's files are named for scaffold. */
function catalogModule(module: unknown, label: string): { catalog: CatalogManifest; settings: ProductSettings } {
  const exports = isRecord(module) ? module : {}
  const catalog = exports.catalog ?? exports.default
  if (!isCatalogManifest(catalog)) {
    throw new PlanError(
      "E_INVALID_PACK",
      `${label} isn't a catalog or template package: it needs to export a catalog, or a template package by default.`
    )
  }
  const settings = exports.settings
  return {
    catalog,
    settings:
      isRecord(settings) && typeof settings.product === "string"
        ? defineSettings({ ...settings, product: settings.product })
        : defineSettings({ product: "scaffold" })
  }
}

/** The template to create from: the one the argument names, the catalog's only one, or the one the user picks. */
async function pickTemplate(
  catalog: CatalogManifest,
  source: TemplateSource,
  io: CliIo,
  unattended: boolean
): Promise<string | typeof cancelled> {
  const ids = catalog.templates.map((template) => template.id)
  if (source.template !== undefined) {
    if (!ids.includes(source.template)) {
      throw new PlanError(
        "E_UNKNOWN_TEMPLATE",
        `${source.package} has no template named ${source.template}. It has ${ids.join(", ")}.`
      )
    }
    return source.template
  }
  const [only] = ids
  if (ids.length === 1 && only !== undefined) {
    return only
  }
  if (unattended || !io.isTTY) {
    throw new PlanError(
      "E_USAGE",
      `${source.package} has more than one template. Pick one: ${ids.map((id) => `${source.package}#${id}`).join(", ")}.`
    )
  }
  return io.prompter.select({
    message: "Which template?",
    options: catalog.templates.map((template) => ({
      value: template.id,
      label: template.title,
      hint: template.description
    }))
  })
}

function emit(io: CliIo, envelope: Envelope, json: boolean): number {
  if (json) {
    io.stdout(`${JSON.stringify(envelope)}\n`)
  } else {
    io.stderr(describeEnvelope(envelope))
  }
  return exitCode(envelope)
}
