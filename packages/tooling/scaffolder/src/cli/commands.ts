import { readdirSync, readFileSync, statSync } from "node:fs"
import { basename, dirname, resolve } from "node:path"
import { z } from "zod"
import { findPreset } from "../manifest/catalog.js"
import type { CatalogManifest } from "../manifest/types.js"
import { recover, type ApplyHooks } from "../node/apply.js"
import { CatalogStore, userCacheDir, type CommandRunner } from "../node/catalogs.js"
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
import { describeCatalog, optionsSchema } from "../resolve/questions.js"
import { projectNameProblem, requireAddonId } from "../resolve/resolve.js"
import { readConfig, readLock } from "../state/files.js"
import { lockSchema, projectConfigSchema } from "../state/schemas.js"
import { lockPath, type ProductSettings } from "../state/settings.js"
import { parseFlags, parseSet, type FlagSpec, type ParsedFlags } from "./flags.js"
import { describeEnvelope } from "./output.js"
import { cancelled, clackPrompter, type Prompter } from "./prompter.js"
import { askSecrets, completeAnswers, emptyAnswers, runWizard, type PartialAnswers } from "./wizard.js"

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

  constructor(options: CliOptions) {
    this.options = options
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
      init: (args) => this.init(args),
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

  /** Loads the catalog version the lock records when it differs from the installed one, so old baselines render. */
  async #context(root: string): Promise<ProjectContext> {
    const store = this.#catalogStore()
    const state = readSafely(root, lockPath(this.#settings))
    if (state.kind === "file") {
      try {
        const lock = readLock(lockPath(this.#settings), state.content)
        if (lock.catalog.version !== this.options.catalog.version) {
          await store.load(lock.catalog.version, lock.catalog.integrity)
        }
      } catch {
        // The planner reports an unreadable lock, and plans two-way without the old catalog.
      }
    }
    return {
      root,
      catalog: this.options.catalog,
      settings: this.#settings,
      catalogs: (version) => store.get(version),
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

  #artifacts(root: string, plan: Plan, flags: ParsedFlags): string | undefined {
    const out = flags.strings.get("out")
    if (out === undefined) {
      return undefined
    }
    const folder = out === "" ? defaultArtifactFolder(root, this.#settings, plan) : resolve(this.io.cwd, out)
    return writeArtifacts(plan, folder, { product: this.#product, diff: this.#diff(flags) })
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
      const reviewed = readPlanFile(resolve(this.io.cwd, planFile))
      const { plan, status } = await applyReviewed(
        context,
        reviewed,
        this.options.hooks ? { hooks: this.options.hooks } : {}
      )
      return this.#emit(toEnvelope(plan, { product: this.#product, status }), json)
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
    const artifacts = this.#artifacts(root, current, flags)
    const envelope = (plan: Plan, status?: EnvelopeStatus) =>
      toEnvelope(plan, { product: this.#product, ...(status ? { status } : {}), ...(artifacts ? { artifacts } : {}) })
    if (current.status !== "planned" || flags.booleans.has("dry-run") || options.applies === false) {
      return this.#emit(envelope(current), json)
    }
    const secretsNeeded = current.env.filter((variable) => variable.secret && variable.required)
    let secrets: Record<string, string> | undefined
    if (secretsNeeded.length > 0) {
      if (interactive) {
        const answer = await askSecrets(secretsNeeded, this.io.prompter)
        if (answer === cancelled) {
          return this.#cancel(json)
        }
        secrets = answer
      } else {
        current.nextSteps.push(
          ...secretsNeeded.map(
            (variable) => `Set ${variable.name} in ${this.#settings.secretsFile}: ${variable.description}`
          )
        )
      }
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
    return this.#emit(envelope(plan, status), json)
  }

  #slotIds(): string[] {
    return this.options.catalog.slots.map((slot) => slot.id)
  }

  #options(flags: ParsedFlags): Record<string, Record<string, unknown>> {
    const options: Record<string, Record<string, unknown>> = {}
    for (const { addon, key, value } of parseSet(flags.lists.get("set") ?? [])) {
      const id = requireAddonId(this.options.catalog, addon)
      options[id] = { ...options[id], [key]: value }
    }
    return options
  }

  async init(argv: string[]): Promise<number> {
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
    const catalog = this.options.catalog
    // With --preset, the template comes from the preset, so a lone argument is the folder.
    const positionals =
      flags.strings.has("preset") && flags.positionals.length === 1
        ? [undefined, ...flags.positionals]
        : flags.positionals
    const [templateArg, folderArg, ...extra] = positionals
    if (extra.length > 0) {
      throw new PlanError("E_USAGE", `init takes a template and a folder. Remove ${extra.join(" ")}.`)
    }
    if (flags.strings.get("plan") !== undefined) {
      const reviewed = readPlanFile(resolve(this.io.cwd, flags.strings.get("plan") ?? ""))
      const name = reviewed.request.intent.command === "init" ? reviewed.request.intent.answers.name : undefined
      return this.#planAndApply(resolve(this.io.cwd, folderArg ?? name ?? "."), reviewed.request, flags)
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
      partial.name = basename(resolve(this.io.cwd, folderArg))
    }
    const interactive = this.#interactive(flags)
    if (folderArg === undefined && !interactive) {
      throw new PlanError("E_USAGE", `init needs a folder: ${this.#product} init <template> <folder>.`)
    }
    const answers = interactive
      ? await runWizard({ catalog, partial, prompter: this.io.prompter, askName: folderArg === undefined })
      : completeAnswers(catalog, partial)
    if (answers === cancelled) {
      return this.#cancel(json)
    }
    const folder = resolve(this.io.cwd, folderArg ?? answers.name ?? ".")
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
        throw new PlanError("E_USAGE", `--no-${slot} only applies to init.`)
      }
      names.push(value)
    }
    if (names.length === 0 && flags.strings.get("plan") === undefined) {
      const slots = this.options.catalog.slots.map((slot) => slot.id).join(", ")
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
        const id = requireAddonId(this.options.catalog, addon)
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
      throw new PlanError("E_NOT_INITIALIZED", "This folder isn't a project yet. Run init first.")
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
    const id = requireAddonId(this.options.catalog, dot === -1 ? subject : subject.slice(0, dot))
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
    return names.length > 0 ? { addons: names.map((name) => requireAddonId(this.options.catalog, name)) } : {}
  }

  /** Fails when generated files, the lock or seeds are out of date, or seeds still hold conflict markers. */
  async check(argv: string[]): Promise<number> {
    const flags = parseFlags(argv, spec({}))
    const json = flags.booleans.has("json")
    const root = this.#root(flags)
    const plan = await planProject(await this.#context(root), { intent: { command: "sync" } })
    if (plan.status === "error" || plan.status === "needs-decision") {
      return this.#emit(toEnvelope(plan, { product: this.#product }), json)
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
        ...toEnvelope(plan, { product: this.#product }),
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
      catalog: this.options.catalog,
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
    if (action !== undefined) {
      throw new PlanError("E_USAGE", `catalog takes fetch, not "${action}".`)
    }
    const description = describeCatalog(this.options.catalog)
    if (json) {
      this.io.stdout(`${JSON.stringify(description)}\n`)
      return 0
    }
    const lines = [`${description.catalog.id}@${description.catalog.version}`]
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

  async schema(argv: string[]): Promise<number> {
    parseFlags(argv, spec({}))
    const config: unknown = z.toJSONSchema(projectConfigSchema, { io: "input", unrepresentable: "any" })
    if (isRecord(config) && isRecord(config.properties) && isRecord(config.properties.addons)) {
      config.properties.addons = {
        ...config.properties.addons,
        properties: Object.fromEntries(this.options.catalog.addons.map((addon) => [addon.id, optionsSchema(addon)]))
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
