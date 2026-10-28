import type { z } from "zod"

/** Classes a file contribution can claim. `shared` files are edited by key, and `user` files are never touched. */
export type Ownership = "owned" | "seed" | "sample"
export type FileClass = Ownership | "shared" | "user"

export type Band = "pre" | "framework" | "post"
export type PointKind = "list" | "nest" | "wrap" | "map" | "single" | "chain"

/** Entries are data, never code strings. Each renderer prints them in its own language. */
export type EntryValue =
  | { ref: { module: string; export: string } }
  | { call: { module: string; export: string; args?: unknown[] } }
  | { value: unknown }

export interface Order {
  band?: Band
  before?: string[]
  after?: string[]
}

export interface PointDefinition {
  /** Point id, such as `vite.plugins` or `app.providers`. */
  id: string
  /** Contract version. Bump it when entries change shape. */
  version: number
  kind: PointKind
  title?: string
  /** Generated file the point renders into, relative to the project root. Points may share a file. */
  file: string
  /** Name of the binding the generated file exports for this point. */
  export: string
  /** Schema for `{ value }` entries. */
  payload?: z.ZodType
}

export type JsonOp = "set" | "append" | "merge"

export type Contribution =
  | { kind: "dependency"; name: string; version: string; dev?: boolean }
  | { kind: "script"; name: string; command: string }
  | {
      kind: "env"
      name: string
      scope: "server" | "client" | "build"
      secret: boolean
      required: boolean
      description: string
      example?: string
    }
  | { kind: "file"; path: string; content: string; ownership: Ownership }
  | {
      kind: "entry"
      point: string
      id: string
      value: EntryValue
      order?: Order
      when?: "required" | "if-present"
    }
  | {
      kind: "json"
      path: string
      pointer: string
      op: JsonOp
      value: unknown
      /** For `append`: the field that identifies an item, making the array keyed. Without it, the array is a set. */
      key?: string
    }
  | { kind: "yaml"; path: string; pointer: string; op: JsonOp; value: unknown; key?: string }
  | { kind: "lines"; path: string; lines: string[] }
  | { kind: "command"; run: string; when: "after-install" | "after-apply"; why: string }
  | { kind: "notice"; code: string; text: string }

export interface TargetInfo {
  id: string
  family: string
  mode: string
  renderModel: string
  /** True when the target's mode has the facet. Throws for a facet the catalog doesn't register. */
  has(facet: string): boolean
}

export interface ResolveContext<O> {
  options: O
  target: TargetInfo
  /** Data another selected add-on provides, such as `{ dialect: "sqlite" }`. Narrow it before use. */
  provided(name: string): unknown
  /** True when the add-on is part of the resolved selection. */
  selected(id: string): boolean
}

export interface ContributeContext<O> extends ResolveContext<O> {
  project: { name: string }
  /** Catalog-pinned versions, keyed by package name. */
  versions: Readonly<Record<string, string>>
  /** The pinned version of a package. A package the catalog doesn't pin is a plan error. */
  version(name: string): string
  /** Picks the integration module for the target's framework family. A missing family is a plan error. */
  runtimeModule(map: Record<string, string>): string
  /** Records that an option doesn't apply to this target, as an `option-ignored` notice. */
  ignored(option: string, reason: string): void
}

/** A file view that migrations and adoption codemods read and edit. Changes become plan operations. */
export interface MutableTree {
  read(path: string): string | undefined
  write(path: string, content: string): void
  delete(path: string): void
}

export interface Migration {
  /** Runs when the recorded version < `version` <= the new version. */
  version: string
  description: string
  kind: "codemod" | "packages" | "options" | "agent"
  run?(tree: MutableTree): void
  /** Rewrites the add-on's recorded options. */
  options?(old: Record<string, unknown>): Record<string, unknown>
  /** An agent task, surfaced in the plan and never run. */
  prompt?: string
}

export interface AddonManifest<S extends z.ZodType = z.ZodType> {
  /** Namespaced id, such as `@buildkit/i18n`. */
  id: string
  version: string
  title: string
  description: string
  /** One add-on per slot, such as `database` or `auth`. */
  slot?: string
  /** Typed data other add-ons read with `ctx.provided()`. */
  provides?: Record<string, unknown>
  /** Add-on ids, `slot:<id>` or `provides:<name>`. */
  requires?: string[]
  conflicts?: string[]
  /** Ordering only: contribute after these add-ons when they're selected. */
  after?: string[]
  points?: PointDefinition[]
  options?: S
  /** Option keys the wizard asks about. The rest take their defaults. */
  ask?: string[]
  supports?(ctx: ResolveContext<z.infer<S>>): true | string
  contribute(ctx: ContributeContext<z.infer<S>>): Contribution[]
  migrations?: Migration[]
  nextSteps?(ctx: ContributeContext<z.infer<S>>): string[]
}

export interface TargetMode {
  id: string
  title: string
  renderModel: string
  facets: string[]
}

export interface TargetContext {
  target: TargetInfo
  project: { name: string }
  versions: Readonly<Record<string, string>>
  version(name: string): string
}

export interface TargetManifest {
  id: string
  title: string
  description: string
  family: string
  modes: TargetMode[]
  /** Points this target owns. Each one is wired at `init`, so `add` never edits your files. */
  points?: PointDefinition[]
  /** Base files, dependencies and wiring for a new project. */
  base(ctx: TargetContext): Contribution[]
  /** Codemods that wire an existing project once, when it's adopted with `init --adopt`. */
  adopt?(tree: MutableTree, ctx: TargetContext): void
}

export interface SlotDefinition {
  id: string
  title: string
  /** Asked only when a template makes the slot optional, such as "Add a database?". */
  question: string
  /** Asked to pick one add-on, such as "Which database?". */
  choose: string
}

export type SlotPolicy = { required: true; default?: string } | { required: false; default?: string }

export interface TemplateManifest {
  id: string
  title: string
  description: string
  target: string
  /** Modes offered, asked when there's more than one. Defaults to all the target's modes. */
  modes?: string[]
  /** Add-ons installed every time, never asked about. */
  required?: string[]
  /** Add-ons offered in one multi-select. `default: true` preselects one. */
  optional?: Record<string, { default: boolean }>
  /** Slots this template offers, asked in this order. */
  slots?: Record<string, SlotPolicy>
}

export interface Answers {
  template: string
  mode?: string
  /** The project name, used for the folder and `package.json`. */
  name?: string
  /** A slot's add-on id, or `null` for "no" to an optional slot. */
  slots?: Record<string, string | null>
  /** Add-ons to include beyond the required ones. Unlisted optional add-ons are declined. */
  optional?: string[]
  /** Options keyed by add-on id. */
  options?: Record<string, Record<string, unknown>>
  /** Adopt an existing project: existing files stay yours, and the target wires it once. */
  adopt?: boolean
}

export interface PresetManifest {
  id: string
  title: string
  /** Saved answers. The wizard asks only what's left. */
  answers: Omit<Answers, "name">
}

export interface CatalogManifest {
  /** Package name of the catalog, such as `@buildkitgg/catalog`. */
  id: string
  version: string
  /** Every facet a target may declare. Checking an unregistered facet throws. */
  facets: readonly string[]
  /** Package versions pinned by the catalog. */
  versions?: Record<string, string>
  targets: TargetManifest[]
  templates: TemplateManifest[]
  slots: SlotDefinition[]
  addons: AddonManifest[]
  presets?: PresetManifest[]
}
