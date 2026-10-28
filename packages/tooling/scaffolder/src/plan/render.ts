import type { CatalogManifest, Contribution, ContributeContext, Ownership, TargetContext } from "../manifest/types.js"
import type { Desired, DesiredDocument, DesiredEnv, DesiredItem } from "../merge/shared.js"
import { itemIdentity } from "../merge/shared.js"
import { renderPoints, type OwnedPoint, type PointEntry } from "../points/render.js"
import type { ResolvedSelection } from "../resolve/resolve.js"
import type { ProductSettings } from "../state/settings.js"
import { stateIgnoreFile } from "../state/settings.js"
import { PlanError } from "./errors.js"
import { formatPointer, isJsonValue, isRecord, isUnsafeKey, jsonEqual, parsePointer } from "./json.js"
import { caseCollision, pathProblem } from "./paths.js"
import type { CommandHint, EnvVar, Notice } from "./types.js"

export interface RenderedFile {
  content: string
  ownership: Ownership
  contributors: string[]
}

export interface Rendered {
  files: Map<string, RenderedFile>
  documents: Map<string, { format: "json" | "yaml"; desired: DesiredDocument }>
  lines: Map<string, Map<string, Desired>>
  env: Map<string, Map<string, DesiredEnv>>
  envVars: EnvVar[]
  commands: CommandHint[]
  notices: Notice[]
  nextSteps: string[]
  /** Every point entry contributed, for `explain`. */
  entries: PointEntry[]
}

export const envExampleFile = ".env.example"
const engineContributor = "engine"

/** Runs the target's `base()` and every add-on's `contribute()`, and collects the desired state of each path. */
export function render(catalog: CatalogManifest, resolved: ResolvedSelection, settings: ProductSettings): Rendered {
  const result: Rendered = {
    files: new Map(),
    documents: new Map(),
    lines: new Map(),
    env: new Map(),
    envVars: [],
    commands: [],
    notices: [],
    nextSteps: [],
    entries: []
  }
  const versions = catalog.versions ?? {}
  const version = (name: string) => {
    const pinned = versions[name]
    if (pinned === undefined) {
      throw new PlanError("E_CONTRIBUTION", `Catalog ${catalog.id} doesn't pin a version of ${name}.`)
    }
    return pinned
  }
  const ignoreFile = stateIgnoreFile(settings)
  collect(result, engineContributor, [
    { kind: "file", path: ignoreFile.path, content: ignoreFile.content, ownership: "owned" }
  ])
  const targetContext: TargetContext = { target: resolved.info, project: { name: resolved.name }, versions, version }
  const entries: PointEntry[] = []
  collect(result, resolved.target.id, resolved.target.base(targetContext), entries)
  const points: OwnedPoint[] = (resolved.target.points ?? []).map((definition) => ({
    definition,
    owner: resolved.target.id
  }))
  const provided = (name: string): unknown =>
    resolved.addons.find((addon) => addon.manifest.provides && Object.hasOwn(addon.manifest.provides, name))?.manifest
      .provides?.[name]
  const selected = (id: string) => resolved.addons.some((addon) => addon.manifest.id === id)
  for (const addon of resolved.addons) {
    const manifest = addon.manifest
    const context: ContributeContext<unknown> = {
      options: addon.options,
      target: resolved.info,
      provided,
      selected,
      project: { name: resolved.name },
      versions,
      version,
      runtimeModule(map) {
        const module = map[resolved.target.family]
        if (module === undefined) {
          throw new PlanError("E_CONTRIBUTION", `${manifest.title} has no integration for ${resolved.target.family}.`)
        }
        return module
      },
      ignored(option, reason) {
        result.notices.push({ code: "option-ignored", text: `${manifest.title}: ${option} doesn't apply. ${reason}` })
      }
    }
    collect(result, manifest.id, manifest.contribute(context), entries)
    for (const definition of manifest.points ?? []) {
      points.push({ definition, owner: manifest.id })
    }
    result.nextSteps.push(...(manifest.nextSteps?.(context) ?? []))
  }
  result.entries = entries
  const rendered = renderPoints({ points, entries, product: settings.product })
  for (const [path, file] of rendered.files) {
    claimFile(result, path, { content: file.content, ownership: "owned", contributors: file.contributors })
  }
  result.notices.push(...rendered.notices)
  const kinds = new Map<string, string>()
  for (const [kind, paths] of [
    ["file", result.files.keys()],
    ["document", result.documents.keys()],
    ["lines", result.lines.keys()],
    ["env", result.env.keys()]
  ] as const) {
    for (const path of paths) {
      const other = kinds.get(path)
      if (other) {
        throw new PlanError("E_CONTRIBUTION", `${path} is contributed both as a ${other} and as a ${kind}.`, {
          paths: [path]
        })
      }
      kinds.set(path, kind)
    }
  }
  const collision = caseCollision(kinds.keys())
  if (collision) {
    throw new PlanError("E_UNSAFE_PATH", `${collision[0]} and ${collision[1]} differ only in case.`, {
      paths: collision
    })
  }
  return result
}

function collect(result: Rendered, contributor: string, contributions: Contribution[], entries?: PointEntry[]) {
  for (const contribution of contributions) {
    switch (contribution.kind) {
      case "dependency":
        setKey(
          result,
          contributor,
          "package.json",
          "json",
          [contribution.dev ? "devDependencies" : "dependencies", contribution.name],
          contribution.version
        )
        break
      case "script":
        setKey(result, contributor, "package.json", "json", ["scripts", contribution.name], contribution.command)
        break
      case "env": {
        const existing = result.envVars.find((variable) => variable.name === contribution.name)
        const variable: EnvVar = {
          name: contribution.name,
          scope: contribution.scope,
          secret: contribution.secret,
          required: contribution.required,
          description: contribution.description,
          ...(contribution.example === undefined ? {} : { example: contribution.example })
        }
        if (existing && !jsonEqual(existing, variable)) {
          throw new PlanError(
            "E_CONTRIBUTION",
            `Two contributions describe ${contribution.name} differently, including ${contributor}.`
          )
        }
        if (!existing) {
          result.envVars.push(variable)
        }
        const desired = result.env.get(envExampleFile) ?? new Map<string, DesiredEnv>()
        const current = desired.get(contribution.name)
        desired.set(contribution.name, {
          value: contribution.secret ? "" : (contribution.example ?? ""),
          description: contribution.description,
          contributors: [...(current?.contributors ?? []), contributor]
        })
        result.env.set(envExampleFile, desired)
        break
      }
      case "file":
        checkPath(contributor, contribution.path)
        claimFile(result, contribution.path, {
          content: contribution.content,
          ownership: contribution.ownership,
          contributors: [contributor]
        })
        break
      case "entry":
        if (!entries) {
          throw new PlanError("E_CONTRIBUTION", `${contributor} can't contribute entries.`)
        }
        entries.push({
          point: contribution.point,
          id: contribution.id,
          value: contribution.value,
          contributor,
          ...(contribution.order ? { order: contribution.order } : {}),
          ...(contribution.when ? { when: contribution.when } : {})
        })
        break
      case "json":
      case "yaml": {
        checkPath(contributor, contribution.path)
        const segments = parsePointer(contribution.pointer)
        if (!isJsonValue(contribution.value)) {
          throw new PlanError(
            "E_CONTRIBUTION",
            `${contributor} sets ${contribution.pointer} in ${contribution.path} to a value that isn't JSON.`
          )
        }
        if (contribution.op === "set") {
          setKey(result, contributor, contribution.path, contribution.kind, segments, contribution.value)
        } else if (contribution.op === "merge") {
          for (const [leaf, value] of flatten(segments, contribution.value)) {
            setKey(result, contributor, contribution.path, contribution.kind, leaf, value)
          }
        } else {
          const items = Array.isArray(contribution.value) ? contribution.value : [contribution.value]
          for (const item of items) {
            appendItem(result, contributor, contribution.path, contribution.kind, segments, item, contribution.key)
          }
        }
        break
      }
      case "lines": {
        checkPath(contributor, contribution.path)
        const desired = result.lines.get(contribution.path) ?? new Map<string, Desired>()
        for (const line of contribution.lines) {
          const key = line.trim()
          if (key === "") {
            continue
          }
          const current = desired.get(key)
          desired.set(key, { value: key, contributors: [...(current?.contributors ?? []), contributor] })
        }
        result.lines.set(contribution.path, desired)
        break
      }
      case "command":
        if (
          !result.commands.some((command) => command.run === contribution.run && command.when === contribution.when)
        ) {
          result.commands.push({ run: contribution.run, when: contribution.when, why: contribution.why })
        }
        break
      case "notice":
        result.notices.push({ code: contribution.code, text: contribution.text })
        break
    }
  }
}

function checkPath(contributor: string, path: string) {
  const problem = pathProblem(path)
  if (problem) {
    throw new PlanError("E_UNSAFE_PATH", `${contributor} contributes ${JSON.stringify(path)}: ${problem}`, {
      paths: [path]
    })
  }
}

function claimFile(result: Rendered, path: string, file: RenderedFile) {
  const existing = result.files.get(path)
  if (existing) {
    throw new PlanError(
      "E_CONTRIBUTION",
      `${path} is contributed by both ${existing.contributors.join(", ")} and ${file.contributors.join(", ")}.`,
      {
        paths: [path]
      }
    )
  }
  result.files.set(path, file)
}

function documentFor(result: Rendered, path: string, format: "json" | "yaml"): DesiredDocument {
  const existing = result.documents.get(path)
  if (existing) {
    if (existing.format !== format) {
      throw new PlanError("E_CONTRIBUTION", `${path} is edited both as JSON and as YAML.`, { paths: [path] })
    }
    return existing.desired
  }
  const desired: DesiredDocument = { keys: new Map(), items: new Map() }
  result.documents.set(path, { format, desired })
  return desired
}

function checkSegments(contributor: string, path: string, segments: string[]) {
  if (segments.length === 0 || segments.some((segment) => isUnsafeKey(segment))) {
    throw new PlanError(
      "E_UNSAFE_KEY",
      `${contributor} edits ${formatPointer(segments) || "the whole document"} in ${path}, which isn't allowed.`,
      {
        paths: [path]
      }
    )
  }
}

function overlaps(left: string, right: string): boolean {
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`)
}

function setKey(
  result: Rendered,
  contributor: string,
  path: string,
  format: "json" | "yaml",
  segments: string[],
  value: unknown
) {
  checkSegments(contributor, path, segments)
  const desired = documentFor(result, path, format)
  const pointer = formatPointer(segments)
  const existing = desired.keys.get(pointer)
  if (existing) {
    if (!jsonEqual(existing.value, value)) {
      throw new PlanError(
        "E_CONTRIBUTION",
        `${existing.contributors.join(", ")} and ${contributor} set ${pointer} in ${path} to different values.`,
        { paths: [path] }
      )
    }
    existing.contributors.push(contributor)
    return
  }
  for (const other of [...desired.keys.keys(), ...desired.items.keys()]) {
    if (overlaps(other, pointer)) {
      throw new PlanError("E_CONTRIBUTION", `${contributor} sets ${pointer} in ${path}, which overlaps ${other}.`, {
        paths: [path]
      })
    }
  }
  desired.keys.set(pointer, { value, contributors: [contributor] })
}

function appendItem(
  result: Rendered,
  contributor: string,
  path: string,
  format: "json" | "yaml",
  segments: string[],
  item: unknown,
  keyField: string | undefined
) {
  checkSegments(contributor, path, segments)
  const desired = documentFor(result, path, format)
  const pointer = formatPointer(segments)
  for (const other of desired.keys.keys()) {
    if (overlaps(other, pointer)) {
      throw new PlanError(
        "E_CONTRIBUTION",
        `${contributor} appends to ${pointer} in ${path}, which overlaps ${other}.`,
        { paths: [path] }
      )
    }
  }
  if (keyField !== undefined && !(isRecord(item) && Object.hasOwn(item, keyField))) {
    throw new PlanError(
      "E_CONTRIBUTION",
      `${contributor} appends an item to ${pointer} in ${path} without its "${keyField}" field.`,
      {
        paths: [path]
      }
    )
  }
  const items = desired.items.get(pointer) ?? new Map<string, DesiredItem>()
  const identity = itemIdentity(item, keyField)
  const existing = items.get(identity)
  if (existing) {
    if (!jsonEqual(existing.value, item)) {
      throw new PlanError(
        "E_CONTRIBUTION",
        `${existing.contributors.join(", ")} and ${contributor} append different items with the same ${keyField ?? "value"} to ${pointer} in ${path}.`,
        { paths: [path] }
      )
    }
    existing.contributors.push(contributor)
  } else {
    items.set(identity, { value: item, contributors: [contributor], ...(keyField === undefined ? {} : { keyField }) })
  }
  desired.items.set(pointer, items)
}

/** Leaves of a merged object. Arrays and scalars are leaves, set as a whole. */
function flatten(prefix: string[], value: unknown): [string[], unknown][] {
  if (!isRecord(value)) {
    return [[prefix, value]]
  }
  const entries = Object.entries(value)
  if (entries.length === 0) {
    return [[prefix, value]]
  }
  return entries.flatMap(([key, nested]) => flatten([...prefix, key], nested))
}
