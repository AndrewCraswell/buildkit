import { readdirSync, readFileSync, statSync } from "node:fs"
import { basename, dirname, resolve } from "node:path"
import { z } from "zod"
import { readEnv } from "../edit/env.js"
import { catalogVersionText, findPreset, packOf } from "../manifest/catalog.js"
import { mergePacks, templateSource, type LoadedPack, type TemplateSource } from "../manifest/packs.js"
import type { CatalogManifest, PackRecord } from "../manifest/types.js"
import { recover, type ApplyHooks } from "../node/apply.js"
import { CatalogStore, loadLocalPack, PackStore, userCacheDir, type CommandRunner } from "../node/catalogs.js"
import {
  applyReviewed,
  defaultArtifactFolder,
  planProject,
  readPlanFile,
  writeArtifacts,
  type DiffScope,
  type ProjectContext
} from "../node/project.js"
import { projectStatus } from "../node/status.js"
import { nodeTree, readSafely } from "../node/tree.js"
import { hasConflictMarkers } from "../ownership/text.js"
import { toEnvelope, exitCode, type Envelope, type EnvelopeStatus } from "../plan/envelope.js"
import { errorInfo, PlanError } from "../plan/errors.js"
import { explain } from "../plan/explain.js"
import { isRecord } from "../plan/json.js"
import { planRequestSchema } from "../plan/request-schema.js"
import type { Plan, PlanRequest, Resolution } from "../plan/types.js"
import { checkCatalog } from "../resolve/check.js"
import { describeCatalog, optionsSchema } from "../resolve/questions.js"
import { projectNameProblem, requireAddonId } from "../resolve/resolve.js"
import { readConfig, readLock } from "../state/files.js"
import { lockSchema, projectConfigSchema, type Lock } from "../state/schemas.js"
import { lockPath, type ProductSettings } from "../state/settings.js"
import { compareVersions, satisfiesRange } from "../upgrade/semver.js"
import { parseFlags, parseSet, type FlagSpec, type ParsedFlags } from "./flags.js"
import { describeEnvelope } from "./output.js"
import { cancelled, clackPrompter, type Cancelled, type Prompter } from "./prompter.js"
import { askEnv, completeAnswers, emptyAnswers, runWizard, type PartialAnswers } from "./wizard.js"

export interface CliIo {
  stdout(text: string): void
  stderr(text: string): void
  /** Prompts are allowed only on a terminal. */
  isTTY: boolean
  prompter: Prompter
  cwd: string
}

export interface CliOptions {
  /** The CLI's name, such as `buildkit`. */
  name: string
  version: string
  description?: string
  catalog: CatalogManifest
  settings: ProductSettings
  catalogIntegrity?: string
  io?: Partial<CliIo>
  /** Runs npm for `catalog fetch`. */
  runCommand?: CommandRunner
  /** The per-user cache for earlier catalog versions. Defaults to the product's folder in the user's cache folder. */
  cacheDir?: string
  hooks?: ApplyHooks
}

const sharedFlags = {
  booleans: ["dry-run", "json", "yes"],
  strings: ["plan", "diff", "conflict", "catalog-version", "cwd"],
  optionalValues: ["out"],
  repeats: ["resolve"]
} satisfies FlagSpec

/**
 * Commands on an existing project that use the catalog. They load the template packages its lock records first, so
 * `schema --cwd` describes a package's add-on options too. `status` reads only the lock and the files, so it never runs
 * a package's code.
 */
const projectCommands = new Set(["add", "config", "upgrade", "sync", "check", "explain", "schema"])

function spec(extra: FlagSpec): FlagSpec {
  return {
    booleans: [...sharedFlags.booleans, ...(extra.booleans ?? [])],
    strings: [...sharedFlags.strings, ...(extra.strings ?? [])],
    optionalValues: [...sharedFlags.optionalValues, ...(extra.optionalValues ?? [])],
    repeats: [...sharedFlags.repeats, ...(extra.repeats ?? [])],
    lists: [...(extra.lists ?? [])],
    dynamic: [...(extra.dynamic ?? [])]
  }
}

/** The command handlers shared by every product CLI. Each returns its exit code. */
export class CliRuntime {
  readonly options: CliOptions
  readonly io: CliIo
  /** The product catalog, with the project's template packages merged in once they're loaded. */
  #catalog: CatalogManifest
  #packs: PackStore | undefined
  /** Says where a template package's template came from, in the plan `create` shows. */
  readonly #sourceNotices: Plan["notices"] = []

  constructor(options: CliOptions) {
    this.options = options
    this.#catalog = options.catalog
    this.io = {
      stdout: options.io?.stdout ?? ((text) => process.stdout.write(text)),
      stderr: options.io?.stderr ?? ((text) => process.stderr.write(text)),
      isTTY: options.io?.isTTY ?? (process.stdout.isTTY === true && process.stdin.isTTY === true),
      prompter: options.io?.prompter ?? clackPrompter,
      cwd: options.io?.cwd ?? process.cwd()
    }
  }

  get #product() {
    return this.options.name
  }

  get #settings(): ProductSettings {
    return this.options.settings
  }

  /** Runs a handler, turning thrown errors into an error envelope. */
  async run(command: string, argv: string[]): Promise<number> {
    const handlers: Record<string, (args: string[]) => Promise<number>> = {
      create: (args) => this.create(args),
      init: (args) => this.create(args),
      add: (args) => this.add(args),
      config: (args) => this.config(args),
      upgrade: (args) => this.upgrade(args),
      sync: (args) => this.sync(args),
      check: (args) => this.check(args),
      status: (args) => this.status(args),
      explain: (args) => this.explain(args),
      plan: (args) => this.planShow(args),
      catalog: (args) => this.catalog(args),
      schema: (args) => this.schema(args),
      recover: (args) => this.recover(args)
    }
    const json = argv.includes("--json")
    try {
      const handler = handlers[command]
      if (!handler) {
        throw new PlanError(
          "E_USAGE",
          `There's no command named "${command}". Run ${this.#product} --help to see the commands.`
        )
      }
      if (projectCommands.has(command)) {
        await this.#loadProjectPacks(command, argv)
      }
      return await handler(argv)
    } catch (error) {
      return this.#emit({ status: "error", error: errorInfo(error) }, json)
    }
  }

  #emit(envelope: Envelope, json: boolean): number {
    if (json) {
      this.io.stdout(`${JSON.stringify(envelope)}\n`)
    } else {
      const text = describeEnvelope(envelope)
      if (envelope.status === "error") {
        this.io.stderr(text)
      } else {
        this.io.stdout(text)
      }
    }
    return exitCode(envelope)
  }

  #cancel(json: boolean): number {
    return this.#emit(
      { status: "error", error: { code: "E_CANCELLED", message: "Cancelled. Nothing was changed.", retryable: false } },
      json
    )
  }

  #root(flags: ParsedFlags): string {
    return resolve(this.io.cwd, flags.strings.get("cwd") ?? ".")
  }

  #interactive(flags: ParsedFlags): boolean {
    return this.io.isTTY && !flags.booleans.has("json") && !flags.booleans.has("yes")
  }

  #catalogStore(): CatalogStore {
    return new CatalogStore({
      cacheRoot: this.options.cacheDir ?? userCacheDir(this.#settings),
      installed: this.options.catalog,
      ...(this.options.runCommand ? { run: this.options.runCommand } : {})
    })
  }

  #packStore(): PackStore {
    this.#packs ??= new PackStore({
      cacheRoot: this.options.cacheDir ?? userCacheDir(this.#settings),
      ...(this.options.runCommand ? { run: this.options.runCommand } : {})
    })
    return this.#packs
  }

  #readLock(root: string): Lock | undefined {
    const state = readSafely(root, lockPath(this.#settings))
    if (state.kind !== "file") {
      return undefined
    }
    try {
      return readLock(lockPath(this.#settings), state.content)
    } catch {
      // The planner reports an unreadable lock.
      return undefined
    }
  }

  /**
   * Merges the template packages a project uses into the catalog, before any add-on name is looked up. Commands load
   * the versions the lock records. `upgrade` moves each package to its newest version that works with this catalog.
   */
  async #loadProjectPacks(command: string, argv: string[]): Promise<void> {
    const cwdIndex = argv.indexOf("--cwd")
    const cwdFlag =
      argv.find((arg) => arg.startsWith("--cwd="))?.slice(6) ?? (cwdIndex === -1 ? undefined : argv[cwdIndex + 1])
    const packs = Object.entries(this.#readLock(resolve(this.io.cwd, cwdFlag ?? "."))?.catalog.packs ?? {})
    if (packs.length === 0) {
      return
    }
    const store = this.#packStore()
    const loaded: LoadedPack[] = []
    for (const [name, recorded] of packs) {
      loaded.push(
        command === "upgrade"
          ? await this.#newestCompatible(store, name, recorded)
          : await this.#loadRecorded(name, recorded)
      )
    }
    this.#catalog = mergePacks(this.options.catalog, loaded)
  }

  /** A template package version the lock records. Installs always record its integrity, so a record without one is refused. */
  async #loadRecorded(name: string, recorded: PackRecord): Promise<LoadedPack> {
    if (recorded.integrity === undefined) {
      throw new PlanError(
        "E_PACKAGE_UNAVAILABLE",
        `The lock records ${name}@${recorded.version} without its integrity, so it can't be checked. Restore the lock from version control.`
      )
    }
    return this.#packStore().load(name, recorded.version, recorded.integrity)
  }

  async #newestCompatible(store: PackStore, name: string, recorded: PackRecord): Promise<LoadedPack> {
    const current = await this.#loadRecorded(name, recorded)
    let versions: string[]
    try {
      versions = await store.versions(name)
    } catch (error) {
      // Offline, the project keeps the version it has, and the plan says why.
      this.#sourceNotices.push({
        code: "template-package-unchecked",
        text: `${name} stays at ${recorded.version}: newer versions couldn't be checked. ${errorInfo(error).message}`
      })
      return current
    }
    // Like npm ranges, an upgrade moves to a prerelease only from a prerelease.
    const prereleases = recorded.version.includes("-")
    for (const version of versions) {
      if (compareVersions(version, recorded.version) <= 0) {
        break
      }
      if (version.includes("-") && !prereleases) {
        continue
      }
      try {
        const candidate = await store.load(name, version)
        if (
          candidate.pack.extends.catalog === this.options.catalog.id &&
          satisfiesRange(this.options.catalog.version, candidate.pack.extends.versions)
        ) {
          return candidate
        }
      } catch (error) {
        // A version that won't install, isn't a pack or has an unreadable range isn't a candidate. The plan says why, and
        // the next one is tried.
        this.#sourceNotices.push({
          code: "template-package-skipped",
          text: `${name}@${version} was skipped: ${errorInfo(error).message}`
        })
      }
    }
    return current
  }

  /** Fetches a template package named on the command line, at the newest version in its range, into the catalog. */
  async #loadPackage(source: TemplateSource): Promise<LoadedPack> {
    const store = this.#packStore()
    const loaded = await store.load(source.package, await store.resolve(source.package, source.range))
    this.#catalog = mergePacks(this.options.catalog, [loaded])
    return loaded
  }

  /**
   * Loads a template package for `create` and returns the template's catalog id, `<package>#<id>`, asking which one when
   * the package has several.
   */
  async #usePackage(source: TemplateSource, interactive: boolean): Promise<string | Cancelled> {
    const loaded = await this.#loadPackage(source)
    const label = `${loaded.name}@${loaded.version}`
    const ids = loaded.pack.templates.map((template) => template.id)
    let id = source.template
    if (id !== undefined && !ids.includes(id)) {
      throw new PlanError("E_UNKNOWN_TEMPLATE", `${label} has no template named ${id}. It has ${ids.join(", ")}.`)
    }
    if (id === undefined && ids.length === 1) {
      id = ids[0]
    }
    if (id === undefined) {
      if (!interactive) {
        throw new PlanError(
          "E_USAGE",
          `${label} has more than one template. Pick one: ${ids.map((each) => `${loaded.name}#${each}`).join(", ")}.`
        )
      }
      const answer = await this.io.prompter.select({
        message: "Which template?",
        options: loaded.pack.templates.map((template) => ({
          value: template.id,
          label: template.title,
          hint: template.description
        }))
      })
      if (answer === cancelled) {
        return cancelled
      }
      id = answer
    }
    this.#noteSource(label)
    return `${loaded.name}#${id}`
  }

  #noteSource(label: string): void {
    this.#sourceNotices.push({
      code: "template-package",
      text: `The template comes from ${label} on npm, not from ${this.#product}. Applying it runs code from its author.`
    })
  }

  /** Loads the catalog version the lock records when it differs from the installed one, so old baselines render. */
  async #context(root: string): Promise<ProjectContext> {
    const store = this.#catalogStore()
    const lock = this.#readLock(root)
    // The old baseline renders with the template package versions the lock records, which an upgrade may move past.
    const recordedPacks: LoadedPack[] = []
    if (lock) {
      try {
        if (lock.catalog.version !== this.options.catalog.version) {
          await store.load(lock.catalog.version, lock.catalog.integrity)
        }
        for (const [name, recorded] of Object.entries(lock.catalog.packs ?? {})) {
          recordedPacks.push(await this.#loadRecorded(name, recorded))
        }
      } catch {
        // Without the old catalog, the planner plans two-way, or merges against stored seed bases.
      }
    }
    return {
      root,
      catalog: this.#catalog,
      settings: this.#settings,
      catalogs: (version, packs) => {
        const host = version === this.options.catalog.version ? this.options.catalog : store.get(version)
        const wanted = recordedPacks.filter((pack) => packs?.[pack.name]?.version === pack.version)
        if (!host || wanted.length !== Object.keys(packs ?? {}).length) {
          return undefined
        }
        try {
          return mergePacks(host, wanted)
        } catch {
          return undefined
        }
      },
      ...(this.options.catalogIntegrity ? { catalogIntegrity: this.options.catalogIntegrity } : {})
    }
  }

  #requestExtras(flags: ParsedFlags): Omit<PlanRequest, "intent"> {
    const resolveEntries: Record<string, Resolution> = {}
    for (const entry of flags.lists.get("resolve") ?? []) {
      const equals = entry.lastIndexOf("=")
      const id = entry.slice(0, equals)
      const value = entry.slice(equals + 1)
      if (equals <= 0) {
        throw new PlanError(
          "E_USAGE",
          `--resolve takes <conflict id>=keep-current, take-incoming or file:<path>. "${entry}" isn't that.`
        )
      }
      if (value === "keep-current" || value === "take-incoming") {
        resolveEntries[id] = value
      } else if (value.startsWith("file:")) {
        resolveEntries[id] = { content: readFileSync(resolve(this.io.cwd, value.slice(5)), "utf8") }
      } else {
        throw new PlanError("E_USAGE", `--resolve ${id} needs keep-current, take-incoming or file:<path>.`)
      }
    }
    const conflict = flags.strings.get("conflict")
    if (conflict !== undefined && conflict !== "markers" && conflict !== "stop") {
      throw new PlanError("E_USAGE", "--conflict takes markers or stop.")
    }
    const catalogVersion = flags.strings.get("catalog-version")
    return {
      ...(Object.keys(resolveEntries).length > 0 ? { resolve: resolveEntries } : {}),
      ...(conflict === "markers" ? { conflictStyle: "markers" as const } : {}),
      ...(catalogVersion === undefined ? {} : { catalogVersion })
    }
  }

  #diff(flags: ParsedFlags): DiffScope {
    const diff = flags.strings.get("diff") ?? "user"
    if (diff !== "none" && diff !== "user" && diff !== "all") {
      throw new PlanError("E_USAGE", "--diff takes none, user or all.")
    }
    return diff
  }

  #artifacts(root: string, plan: Plan, flags: ParsedFlags, context?: ProjectContext): string | undefined {
    const out = flags.strings.get("out")
    if (out === undefined) {
      return undefined
    }
    const folder = out === "" ? defaultArtifactFolder(root, this.#settings, plan) : resolve(this.io.cwd, out)
    return writeArtifacts(plan, folder, { ...this.#catalogs(context), diff: this.#diff(flags) })
  }

  /** The product's name and the catalogs a plan's decisions are written against, for its envelope. */
  #catalogs(context?: ProjectContext): {
    product: string
    catalog: CatalogManifest
    catalogs?: (version: string) => CatalogManifest | undefined
  } {
    const lookup = context?.catalogs
    return {
      product: this.#product,
      catalog: this.#catalog,
      ...(lookup ? { catalogs: (version: string) => lookup(version) } : {})
    }
  }

  /** Plan, ask the open decisions, show the plan, confirm once, then apply what was reviewed. */
  async #planAndApply(
    root: string,
    request: PlanRequest,
    flags: ParsedFlags,
    options: { applies?: boolean } = {}
  ): Promise<number> {
    const json = flags.booleans.has("json")
    const context = await this.#context(root)
    const planFile = flags.strings.get("plan")
    if (planFile !== undefined) {
      if (flags.booleans.has("dry-run") || options.applies === false) {
        throw new PlanError(
          "E_USAGE",
          `--plan applies a reviewed plan, so it can't be used with ${flags.booleans.has("dry-run") ? "--dry-run" : "--list"}. Run plan show <file> to review it.`
        )
      }
      const reviewed = readPlanFile(resolve(this.io.cwd, planFile))
      const { plan, status } = await applyReviewed(
        context,
        reviewed,
        this.options.hooks ? { hooks: this.options.hooks } : {}
      )
      plan.notices.unshift(...this.#sourceNotices)
      return this.#emit(toEnvelope(plan, { ...this.#catalogs(context), status }), json)
    }
    const interactive = this.#interactive(flags)
    let current = await planProject(context, request)
    while (interactive && current.status === "needs-decision") {
      const [decision] = current.decisions
      if (!decision || decision.choices.length === 0) {
        break
      }
      const answer = await this.io.prompter.select({
        message: decision.message,
        options: decision.choices.map((choice) => ({ value: choice.id, label: choice.label }))
      })
      if (answer === cancelled) {
        return this.#cancel(json)
      }
      const choice = decision.choices.find((candidate) => candidate.id === answer)
      if (!choice) {
        return this.#cancel(json)
      }
      current = await planProject(context, choice.request)
    }
    current.notices.unshift(...this.#sourceNotices)
    const artifacts = this.#artifacts(root, current, flags, context)
    const envelope = (plan: Plan, status?: EnvelopeStatus) =>
      toEnvelope(plan, {
        ...this.#catalogs(context),
        ...(status ? { status } : {}),
        ...(artifacts ? { artifacts } : {})
      })
    if (current.status !== "planned" || flags.booleans.has("dry-run") || options.applies === false) {
      return this.#emit(envelope(current), json)
    }
    // create asks for every variable; later commands only for required secrets, so an add doesn't ask about the rest of
    // the project. Variables the secrets file already has aren't asked again: a required one needs a value, and an
    // optional one was answered once, even if blank.
    const state = readSafely(root, this.#settings.secretsFile)
    const present = readEnv(state.kind === "file" ? state.content : undefined)
    const everything = current.request.intent.command === "init"
    const unset = current.env.filter(
      (variable) =>
        (everything || (variable.secret && variable.required)) &&
        (variable.required ? !present.get(variable.name) : !present.has(variable.name))
    )
    let secrets: Record<string, string> | undefined
    if (interactive && unset.length > 0) {
      const answer = await askEnv(unset, this.io.prompter)
      if (answer === cancelled) {
        return this.#cancel(json)
      }
      secrets = answer
    } else if (!interactive) {
      current.nextSteps.push(
        ...unset
          .filter((variable) => variable.secret && variable.required)
          .map((variable) => `Set ${variable.name} in ${this.#settings.secretsFile}: ${variable.description}`)
      )
    }
    if (!interactive && !flags.booleans.has("yes")) {
      current.notices.push({
        code: "not-applied",
        text: `Nothing was written. Run this again with --yes, or save the plan with --out and apply it with --plan <folder>/plan.json.`
      })
      return this.#emit(envelope(current), json)
    }
    if (interactive) {
      this.io.prompter.note(describeEnvelope(envelope(current)), "Review changes")
      const approved = await this.io.prompter.confirm({ message: "Apply these changes?", initialValue: false })
      if (approved === cancelled || !approved) {
        return this.#cancel(json)
      }
    }
    const { plan, status } = await applyReviewed(
      context,
      { request: current.request, fingerprint: current.fingerprint },
      { ...(secrets ? { secrets } : {}), ...(this.options.hooks ? { hooks: this.options.hooks } : {}) }
    )
    plan.nextSteps = current.nextSteps
    plan.notices.unshift(...this.#sourceNotices)
    return this.#emit(envelope(plan, status), json)
  }

  #slotIds(): string[] {
    return this.#catalog.slots.map((slot) => slot.id)
  }

  #options(flags: ParsedFlags): Record<string, Record<string, unknown>> {
    const options: Record<string, Record<string, unknown>> = {}
    for (const { addon, key, value } of parseSet(flags.lists.get("set") ?? [])) {
      const id = requireAddonId(this.#catalog, addon)
      options[id] = { ...options[id], [key]: value }
    }
    return options
  }

  async create(argv: string[]): Promise<number> {
    const flags = parseFlags(
      argv,
      spec({
        booleans: ["adopt"],
        strings: ["mode", "preset", "name"],
        lists: ["with", "without"],
        repeats: ["set"],
        dynamic: this.#slotIds()
      })
    )
    const json = flags.booleans.has("json")
    // With --preset, the template comes from the preset, so a lone argument is the folder.
    const positionals =
      flags.strings.has("preset") && flags.positionals.length === 1
        ? [undefined, ...flags.positionals]
        : flags.positionals
    let [templateArg] = positionals
    const [, folderArg, ...extra] = positionals
    if (extra.length > 0) {
      throw new PlanError("E_USAGE", `create takes a template and a folder. Remove ${extra.join(" ")}.`)
    }
    const source = templateArg === undefined ? undefined : templateSource(templateArg)
    if (source) {
      const template = await this.#usePackage(source, this.#interactive(flags))
      if (template === cancelled) {
        return this.#cancel(json)
      }
      templateArg = template
    }
    const catalog = this.#catalog
    if (flags.strings.get("plan") !== undefined) {
      const reviewed = readPlanFile(resolve(this.io.cwd, flags.strings.get("plan") ?? ""))
      const planned = reviewed.request.intent.command === "init" ? reviewed.request.intent.answers.template : undefined
      const pack = planned === undefined ? undefined : packOf(planned)
      // The plan records the package version and integrity it was made with. Loading exactly that copy means no other
      // version's code runs before the fingerprint is checked.
      if (planned !== undefined && pack !== undefined && source === undefined) {
        const recorded = reviewed.packs?.[pack]
        if (!recorded) {
          throw new PlanError(
            "E_USAGE",
            `The plan doesn't record which version of ${pack} it was made with. Make it again with --out.`
          )
        }
        this.#catalog = mergePacks(this.options.catalog, [await this.#loadRecorded(pack, recorded)])
        this.#noteSource(`${pack}@${recorded.version}`)
      }
      const name = reviewed.request.intent.command === "init" ? reviewed.request.intent.answers.name : undefined
      // The name picks the folder, and a lock is read there before planning, so check it first.
      const nameProblem = name === undefined ? undefined : projectNameProblem(name)
      if (name !== undefined && nameProblem) {
        throw new PlanError("E_INVALID_OPTIONS", `"${name}" in the plan can't be a project name. ${nameProblem}`)
      }
      return this.#planAndApply(resolve(this.#root(flags), folderArg ?? name ?? "."), reviewed.request, flags)
    }
    let partial: PartialAnswers = emptyAnswers()
    const presetId = flags.strings.get("preset")
    if (presetId !== undefined) {
      const preset = findPreset(catalog, presetId)
      if (!preset) {
        throw new PlanError("E_USAGE", `There's no preset named "${presetId}".`)
      }
      partial = {
        ...partial,
        template: preset.answers.template,
        ...(preset.answers.mode === undefined ? {} : { mode: preset.answers.mode }),
        slots: { ...preset.answers.slots },
        ...(preset.answers.optional === undefined ? {} : { optional: [...preset.answers.optional] }),
        options: structuredClone(preset.answers.options ?? {})
      }
      if (templateArg !== undefined && templateArg !== preset.answers.template) {
        throw new PlanError(
          "E_USAGE",
          `Preset ${presetId} is for template ${preset.answers.template}, not ${templateArg}.`
        )
      }
    } else if (templateArg !== undefined) {
      partial.template = templateArg
    }
    const mode = flags.strings.get("mode")
    if (mode !== undefined) {
      partial.mode = mode
    }
    for (const [slot, value] of flags.dynamic) {
      partial.slots[slot] = value === null ? null : requireAddonId(catalog, value)
    }
    partial.with = flags.lists.get("with") ?? []
    partial.without = flags.lists.get("without") ?? []
    for (const [id, values] of Object.entries(this.#options(flags))) {
      partial.options[id] = { ...partial.options[id], ...values }
    }
    if (flags.booleans.has("adopt")) {
      partial.adopt = true
    }
    const nameFlag = flags.strings.get("name")
    if (nameFlag !== undefined) {
      partial.name = nameFlag
    } else if (folderArg !== undefined) {
      partial.name = basename(resolve(this.#root(flags), folderArg))
    }
    const interactive = this.#interactive(flags)
    if (folderArg === undefined && !interactive) {
      throw new PlanError("E_USAGE", `create needs a folder: ${this.#product} create <template> <folder>.`)
    }
    const answers = interactive
      ? await runWizard({ catalog, partial, prompter: this.io.prompter, askName: folderArg === undefined })
      : completeAnswers(catalog, partial)
    if (answers === cancelled) {
      return this.#cancel(json)
    }
    // The folder is relative to --cwd, as every command's project is.
    const folder = resolve(this.#root(flags), folderArg ?? answers.name ?? ".")
    const name = answers.name ?? basename(folder)
    const nameProblem = projectNameProblem(name)
    if (nameProblem) {
      throw new PlanError(
        "E_INVALID_OPTIONS",
        `"${name}" can't be a project name. ${nameProblem} Pass --name to choose another.`
      )
    }
    this.#checkDestination(folder, answers.adopt === true)
    return this.#planAndApply(
      folder,
      { intent: { command: "init", answers: { ...answers, name } }, ...this.#requestExtras(flags) },
      flags
    )
  }

  #checkDestination(folder: string, adopt: boolean) {
    const parent = dirname(folder)
    if (!statSync(parent, { throwIfNoEntry: false })?.isDirectory()) {
      throw new PlanError(
        "E_DESTINATION",
        `The folder ${parent} doesn't exist. Create it first, or choose another place for the project.`,
        { paths: [parent] }
      )
    }
    const stats = statSync(folder, { throwIfNoEntry: false })
    if (!stats) {
      return
    }
    if (!stats.isDirectory()) {
      throw new PlanError("E_DESTINATION", `${folder} is a file, not a folder.`, { paths: [folder] })
    }
    if (!adopt && readdirSync(folder).length > 0) {
      throw new PlanError(
        "E_DESTINATION",
        `${folder} isn't empty. Choose an empty folder, or pass --adopt to bring an existing project in.`,
        {
          paths: [folder]
        }
      )
    }
  }

  async add(argv: string[]): Promise<number> {
    const flags = parseFlags(argv, spec({ lists: ["replace"], repeats: ["set"], dynamic: this.#slotIds() }))
    const names = flags.positionals
      .flatMap((entry) => entry.split(","))
      .map((entry) => entry.trim())
      .filter(Boolean)
    for (const [slot, value] of flags.dynamic) {
      if (value === null) {
        throw new PlanError("E_USAGE", `--no-${slot} only applies to create.`)
      }
      names.push(value)
    }
    if (names.length === 0 && flags.strings.get("plan") === undefined) {
      const slots = this.#catalog.slots.map((slot) => slot.id).join(", ")
      throw new PlanError("E_USAGE", `Name an add-on to add, or a question to answer (${slots}).`)
    }
    const replace = flags.lists.get("replace") ?? []
    return this.#planAndApply(
      this.#root(flags),
      {
        intent: { command: "add", addons: names, replace, options: this.#options(flags) },
        ...this.#requestExtras(flags)
      },
      flags
    )
  }

  async config(argv: string[]): Promise<number> {
    const flags = parseFlags(argv, spec({ lists: ["with"] }))
    const json = flags.booleans.has("json")
    const root = this.#root(flags)
    const [action, ...rest] = flags.positionals
    if (action === "set") {
      if (rest.length === 0 && (flags.lists.get("with") ?? []).length === 0) {
        throw new PlanError("E_USAGE", "config set takes <add-on>.<option>=<value>.")
      }
      const options: Record<string, Record<string, unknown>> = {}
      for (const { addon, key, value } of parseSet(rest)) {
        const id = requireAddonId(this.#catalog, addon)
        options[id] = { ...options[id], [key]: value }
      }
      return this.#planAndApply(
        root,
        { intent: { command: "config", options, ...this.#alongside(flags) }, ...this.#requestExtras(flags) },
        flags
      )
    }
    const state = readSafely(root, this.#settings.configFile)
    if (state.kind !== "file") {
      throw new PlanError("E_NOT_INITIALIZED", "This folder isn't a project yet. Run create first.")
    }
    const config = readConfig(this.#settings.configFile, state.content)
    if (action === undefined) {
      this.io.stdout(json ? `${JSON.stringify(config)}\n` : state.content)
      return 0
    }
    if (action !== "get") {
      throw new PlanError("E_USAGE", `config takes get or set, not "${action}".`)
    }
    const [subject] = rest
    if (subject === undefined) {
      throw new PlanError("E_USAGE", "config get takes <add-on> or <add-on>.<option>.")
    }
    const dot = subject.indexOf(".")
    const id = requireAddonId(this.#catalog, dot === -1 ? subject : subject.slice(0, dot))
    const options = config.addons[id]
    const value = dot === -1 ? options : options?.[subject.slice(dot + 1)]
    this.io.stdout(`${JSON.stringify(value ?? null, null, json ? undefined : 2)}\n`)
    return 0
  }

  async upgrade(argv: string[]): Promise<number> {
    const flags = parseFlags(argv, spec({ booleans: ["list"], lists: ["with"] }))
    return this.#planAndApply(
      this.#root(flags),
      { intent: { command: "upgrade", ...this.#alongside(flags) }, ...this.#requestExtras(flags) },
      flags,
      {
        applies: !flags.booleans.has("list")
      }
    )
  }

  async sync(argv: string[]): Promise<number> {
    const flags = parseFlags(argv, spec({ lists: ["with"] }))
    return this.#planAndApply(
      this.#root(flags),
      { intent: { command: "sync", ...this.#alongside(flags) }, ...this.#requestExtras(flags) },
      flags
    )
  }

  /** `--with` on config set, upgrade and sync: add-ons to add with the change, as a decision's choice writes them. */
  #alongside(flags: ParsedFlags): { addons?: string[] } {
    const names = flags.lists.get("with") ?? []
    return names.length > 0 ? { addons: names.map((name) => requireAddonId(this.#catalog, name)) } : {}
  }

  /** Fails when generated files, the lock or seeds are out of date, or seeds still hold conflict markers. */
  async check(argv: string[]): Promise<number> {
    const flags = parseFlags(argv, spec({}))
    const json = flags.booleans.has("json")
    const root = this.#root(flags)
    const plan = await planProject(await this.#context(root), { intent: { command: "sync" } })
    if (plan.status === "error" || plan.status === "needs-decision") {
      return this.#emit(toEnvelope(plan, { product: this.#product, catalog: this.#catalog }), json)
    }
    const stale = new Set([
      ...plan.operations.map((operation) => operation.path),
      ...plan.conflicts.map((conflict) => conflict.path)
    ])
    for (const notice of plan.notices) {
      if (notice.code === "owned-edited" && notice.path !== undefined) {
        stale.add(notice.path)
      }
    }
    const lockState = readSafely(root, lockPath(this.#settings))
    if (lockState.kind === "file") {
      const lock = readLock(lockPath(this.#settings), lockState.content)
      for (const [path, entry] of Object.entries(lock.files)) {
        const disk = entry.class === "seed" || entry.class === "owned" ? readSafely(root, path) : undefined
        if (disk?.kind === "file" && hasConflictMarkers(disk.content)) {
          stale.add(path)
          plan.notices.push({ code: "conflict-markers", text: `${path} still has conflict markers.` })
        }
      }
    }
    if (stale.size === 0) {
      return this.#emit({ status: "unchanged", fingerprint: plan.fingerprint, catalog: plan.catalog }, json)
    }
    const paths = [...stale].sort()
    return this.#emit(
      {
        ...toEnvelope(plan, { product: this.#product, catalog: this.#catalog }),
        status: "error",
        error: {
          code: "E_DRIFT",
          message: `${paths.length} ${paths.length === 1 ? "file is" : "files are"} out of date: ${paths.join(", ")}.`,
          paths,
          retryable: false,
          next: [`${this.#product} sync`]
        }
      },
      json
    )
  }

  async status(argv: string[]): Promise<number> {
    const flags = parseFlags(argv, spec({}))
    const report = await projectStatus(this.#root(flags), this.#settings, flags.positionals[0])
    if (flags.booleans.has("json")) {
      this.io.stdout(`${JSON.stringify(report)}\n`)
      return 0
    }
    const lines = report.files.map(
      (file) =>
        `${file.state.padEnd(9)} ${file.path} (${file.class}${file.contributors ? `, from ${file.contributors.join(", ")}` : ""})`
    )
    this.io.stdout(
      `${[report.catalog ? `Catalog ${report.catalog.id}@${report.catalog.version}` : "Not a project yet.", ...lines, ...report.deleted.map((path) => `deleted   ${path} (stays deleted)`)].join("\n")}\n`
    )
    return 0
  }

  async explain(argv: string[]): Promise<number> {
    const flags = parseFlags(argv, spec({}))
    const [subject] = flags.positionals
    if (subject === undefined) {
      throw new PlanError("E_USAGE", "explain takes a path, an add-on or an entry id.")
    }
    const result = explain({
      catalog: this.#catalog,
      tree: nodeTree(this.#root(flags)),
      settings: this.#settings,
      subject
    })
    if (flags.booleans.has("json")) {
      this.io.stdout(`${JSON.stringify(result)}\n`)
      return 0
    }
    const text = (() => {
      switch (result.kind) {
        case "path":
          return [
            `${result.path} is ${result.class}, from ${result.contributors.join(", ") || "nothing selected"}.`,
            ...(result.keys ?? []).map(
              (key) => `  ${key.key}: ${key.contributors.join(", ")}${key.provenance ? ` (${key.provenance})` : ""}`
            )
          ]
        case "addon": {
          let state = "not installed"
          if (result.installed) {
            state = result.explicit ? "installed" : `installed because ${result.by.join(", ")} needs it`
          }
          return [
            `${result.title} (${result.id}@${result.version}) is ${state}.`,
            ...(result.requires.length > 0 ? [`  Requires ${result.requires.join(", ")}`] : []),
            ...(result.requiredBy.length > 0 ? [`  Required by ${result.requiredBy.join(", ")}`] : [])
          ]
        }
        case "entry":
          return [`${result.id} is an entry of ${result.point} from ${result.contributor}, in the ${result.band} band.`]
        case "unknown":
          return [
            `Nothing matches "${result.subject}".${result.suggestions.length > 0 ? ` Did you mean ${result.suggestions.join(", ")}?` : ""}`
          ]
      }
    })()
    this.io.stdout(`${text.join("\n")}\n`)
    return result.kind === "unknown" ? 2 : 0
  }

  async planShow(argv: string[]): Promise<number> {
    const flags = parseFlags(argv, spec({}))
    const [action, file] = flags.positionals
    if (action !== "show" || file === undefined) {
      throw new PlanError("E_USAGE", "plan show takes a plan file.")
    }
    const path = resolve(this.io.cwd, file)
    const { fingerprint } = readPlanFile(path)
    const value: unknown = JSON.parse(readFileSync(path, "utf8"))
    const stored = savedEnvelopeSchema.safeParse(isRecord(value) ? value.envelope : undefined)
    if (!stored.success) {
      throw new PlanError("E_USAGE", `${file} has no plan summary to show.`)
    }
    const shown: Envelope = {
      status: stored.data.status,
      fingerprint,
      ...(stored.data.operations ? { operations: stored.data.operations } : {})
    }
    this.io.stdout(
      flags.booleans.has("json")
        ? `${JSON.stringify(shown)}
`
        : describeEnvelope(shown)
    )
    return 0
  }

  async catalog(argv: string[]): Promise<number> {
    const flags = parseFlags(argv, spec({}))
    const json = flags.booleans.has("json")
    const [action, version] = flags.positionals
    if (action === "fetch") {
      if (version === undefined) {
        throw new PlanError("E_USAGE", "catalog fetch takes a version.")
      }
      const root = this.#root(flags)
      const store = this.#catalogStore()
      const lockState = readSafely(root, lockPath(this.#settings))
      const lock = lockState.kind === "file" ? readLock(lockPath(this.#settings), lockState.content) : undefined
      const fetched = await store.fetch(version, lock?.catalog.version === version ? lock.catalog.integrity : undefined)
      return this.#emit(
        {
          status: "applied",
          notices: [
            {
              code: "catalog-fetched",
              text: `Cached ${this.options.catalog.id}@${fetched.version} (${fetched.integrity}).`
            }
          ]
        },
        json
      )
    }
    if (action === "check") {
      return this.#checkPack(resolve(this.io.cwd, version ?? "."), json)
    }
    const source = action === undefined ? undefined : templateSource(action)
    if (action !== undefined && source === undefined) {
      throw new PlanError("E_USAGE", `catalog takes fetch, check or a template package, not "${action}".`)
    }
    if (source) {
      await this.#loadPackage(source)
    }
    const description = describeCatalog(this.#catalog)
    if (source) {
      description.templates = description.templates.filter((template) => packOf(template.template) === source.package)
    }
    if (json) {
      this.io.stdout(`${JSON.stringify(description)}\n`)
      return 0
    }
    const lines = [`${description.catalog.id}@${catalogVersionText(this.#catalog)}`]
    for (const template of description.templates) {
      lines.push("", `${template.title} (${template.template}): ${template.description}`)
      for (const required of template.required) {
        lines.push(`  Always: ${required.title}`)
      }
      const first = Object.values(template.questionsByMode)[0]
      for (const slot of first?.slots ?? []) {
        lines.push(
          `  ${slot.question ?? slot.choose} ${slot.choices.map((choice) => choice.title).join(", ")}${slot.default ? ` (default ${slot.default})` : ""}`
        )
      }
      if ((first?.optional.length ?? 0) > 0) {
        lines.push(`  Optional: ${first?.optional.map((choice) => choice.title).join(", ")}`)
      }
    }
    this.io.stdout(`${lines.join("\n")}\n`)
    return 0
  }

  /** `catalog check [path]`: a template package in a folder, merged in, with every option set of its templates planned. */
  async #checkPack(folder: string, json: boolean): Promise<number> {
    const loaded = await loadLocalPack(folder)
    const merged = mergePacks(this.options.catalog, [loaded])
    const templates = loaded.pack.templates.map((template) => `${loaded.name}#${template.id}`)
    const problems = checkCatalog(merged, { matrix: true, templates })
    const label = `${loaded.name}@${loaded.version}`
    if (problems.length > 0) {
      throw new PlanError("E_INVALID_PACK", `${label} has problems. ${problems.join(" ")}`)
    }
    return this.#emit(
      {
        status: "unchanged",
        notices: [
          {
            code: "pack-checked",
            text: `${label} works with ${this.options.catalog.id}@${this.options.catalog.version}. Every option set of ${templates.join(", ")} plans.`
          }
        ]
      },
      json
    )
  }

  async schema(argv: string[]): Promise<number> {
    parseFlags(argv, spec({}))
    const config: unknown = z.toJSONSchema(projectConfigSchema, { io: "input", unrepresentable: "any" })
    if (isRecord(config) && isRecord(config.properties) && isRecord(config.properties.addons)) {
      config.properties.addons = {
        ...config.properties.addons,
        properties: Object.fromEntries(this.#catalog.addons.map((addon) => [addon.id, optionsSchema(addon)]))
      }
    }
    const schemas = {
      config,
      lock: z.toJSONSchema(lockSchema, { unrepresentable: "any" }),
      request: z.toJSONSchema(planRequestSchema, { unrepresentable: "any" })
    }
    this.io.stdout(`${JSON.stringify(schemas, null, argv.includes("--json") ? undefined : 2)}\n`)
    return 0
  }

  async recover(argv: string[]): Promise<number> {
    const flags = parseFlags(argv, spec({}))
    const result = await recover(this.#root(flags), this.#settings)
    const { report } = result
    const notices = [
      ...report.restored.map((path) => ({ code: "restored", text: `Restored ${path}.` })),
      ...report.changed.map((path) => ({
        code: "changed-elsewhere",
        text: `${path} changed after the interrupted apply, so it was left as it is.`
      }))
    ]
    return this.#emit(
      {
        status: result.status === "recovered" ? "applied" : "unchanged",
        ...(notices.length > 0 ? { notices } : {}),
        ...(result.status === "unchanged"
          ? { notices: [{ code: "nothing-to-recover", text: "There's no interrupted apply to roll back." }] }
          : {})
      },
      flags.booleans.has("json")
    )
  }
}

const savedEnvelopeSchema = z.object({
  status: z.enum(["planned", "applied", "unchanged", "needs-decision", "conflict", "error"]),
  operations: z
    .array(
      z.object({
        path: z.string(),
        action: z.enum(["create", "update", "delete"]),
        class: z.string(),
        linesAdded: z.number(),
        linesRemoved: z.number()
      })
    )
    .optional()
})
