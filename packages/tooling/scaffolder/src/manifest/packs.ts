import { PlanError } from "../plan/errors.js"
import { isRecord } from "../plan/json.js"
import { checkCatalog } from "../resolve/check.js"
import { satisfiesRange } from "../upgrade/semver.js"
import type { CatalogManifest, PackRecord, TemplatePack } from "./types.js"

/** A template package named on the command line: `@scope/name`, `@scope/name@^2`, `npm:name`, `@scope/name#id`. */
export interface TemplateSource {
  package: string
  /** A version, a range or a dist-tag. */
  range: string
  /** The template, when the package has several. */
  template?: string
}

const scopedName = /^@[a-z0-9][a-z0-9-._~]*\/[a-z0-9][a-z0-9-._~]*$/
const unscopedName = /^[a-z0-9][a-z0-9-._~]*$/
const localId = /^[a-z0-9][a-z0-9-._]*$/i

/**
 * Reads a template argument as a package. A scoped name, or any name after `npm:`, is a package. Catalog template ids
 * can't look like either, so a mistyped built-in id is never fetched. Returns `undefined` for anything else.
 */
export function templateSource(argument: string): TemplateSource | undefined {
  const npm = argument.startsWith("npm:")
  const text = npm ? argument.slice(4) : argument
  if (!npm && !text.startsWith("@")) {
    return undefined
  }
  const [spec = "", template, ...rest] = text.split("#")
  const at = spec.indexOf("@", spec.startsWith("@") ? 1 : 0)
  const name = at === -1 ? spec : spec.slice(0, at)
  const range = at === -1 ? "latest" : spec.slice(at + 1)
  if (
    rest.length > 0 ||
    !(scopedName.test(name) || (npm && unscopedName.test(name))) ||
    range === "" ||
    /\s/.test(range) ||
    (template !== undefined && !localId.test(template))
  ) {
    throw new PlanError(
      "E_USAGE",
      `"${argument}" isn't a template package. Use @scope/name, @scope/name@<version> or npm:name, and #<template> to pick one of several.`
    )
  }
  return { package: name, range, ...(template === undefined ? {} : { template }) }
}

export function isTemplatePack(value: unknown): value is TemplatePack {
  return (
    isRecord(value) &&
    isRecord(value.extends) &&
    typeof value.extends.catalog === "string" &&
    typeof value.extends.versions === "string" &&
    Array.isArray(value.templates) &&
    (value.addons === undefined || Array.isArray(value.addons))
  )
}

export interface LoadedPack extends PackRecord {
  name: string
  pack: TemplatePack
}

/**
 * The product catalog with template packages merged in. Each pack must extend this catalog, at a version in its
 * range, and keep to its own ids. The merged catalog then has to pass `checkCatalog`, so a pack that breaks a rule
 * stops before anything is planned.
 */
export function mergePacks(catalog: CatalogManifest, packs: readonly LoadedPack[]): CatalogManifest {
  if (packs.length === 0) {
    return catalog
  }
  const merged: CatalogManifest = {
    ...catalog,
    templates: [...catalog.templates],
    addons: [...catalog.addons],
    packs: { ...catalog.packs }
  }
  for (const { name, version, integrity, pack } of packs) {
    const label = `${name}@${version}`
    if (pack.extends.catalog !== catalog.id) {
      throw new PlanError("E_INVALID_PACK", `${label} extends ${pack.extends.catalog}, not ${catalog.id}.`)
    }
    let compatible: boolean
    try {
      compatible = satisfiesRange(catalog.version, pack.extends.versions)
    } catch {
      throw new PlanError("E_INVALID_PACK", `${label} has "${pack.extends.versions}" as its catalog range.`)
    }
    if (!compatible) {
      throw new PlanError(
        "E_CATALOG_MISMATCH",
        `${label} works with ${catalog.id} ${pack.extends.versions}, and this CLI has ${catalog.version}. Use a CLI with a catalog in that range, or another version of ${name}.`
      )
    }
    if (pack.templates.length === 0) {
      throw new PlanError("E_INVALID_PACK", `${label} has no templates.`)
    }
    for (const template of pack.templates) {
      if (!localId.test(template.id)) {
        throw new PlanError(
          "E_INVALID_PACK",
          `${label} has a template with the id "${template.id}". Use letters, digits, ., - and _.`
        )
      }
      merged.templates.push({ ...template, id: `${name}#${template.id}` })
    }
    for (const addon of pack.addons ?? []) {
      if (!addon.id.startsWith(`${name}/`)) {
        throw new PlanError(
          "E_INVALID_PACK",
          `${label} has an add-on with the id ${addon.id}. Its ids start with ${name}/.`
        )
      }
      merged.addons.push(addon)
    }
    merged.packs![name] = { version, ...(integrity === undefined ? {} : { integrity }) }
  }
  const problems = checkCatalog(merged)
  if (problems.length > 0) {
    throw new PlanError(
      "E_INVALID_PACK",
      `${packs.map((loaded) => loaded.name).join(", ")} can't be used with ${catalog.id}: ${problems.join(" ")}`
    )
  }
  return merged
}
