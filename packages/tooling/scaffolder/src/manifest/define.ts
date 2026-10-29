import type { z } from "zod"
import type {
  AddonManifest,
  CatalogManifest,
  PointDefinition,
  PresetManifest,
  SlotDefinition,
  TargetManifest,
  TemplateManifest
} from "./types.js"

/** Identity helpers that give manifests their types. Catalog CI checks them with `checkCatalog()`. */
export function defineAddon<S extends z.ZodType = z.ZodObject<Record<string, never>>>(
  manifest: AddonManifest<S>
): AddonManifest<S> {
  return manifest
}

export function defineTarget(manifest: TargetManifest): TargetManifest {
  return manifest
}

export function defineTemplate(manifest: TemplateManifest): TemplateManifest {
  return manifest
}

export function defineSlot(manifest: SlotDefinition): SlotDefinition {
  return manifest
}

export function definePreset(manifest: PresetManifest): PresetManifest {
  return manifest
}

export function definePoint(definition: PointDefinition): PointDefinition {
  return definition
}

export function defineCatalog(manifest: CatalogManifest): CatalogManifest {
  return manifest
}
