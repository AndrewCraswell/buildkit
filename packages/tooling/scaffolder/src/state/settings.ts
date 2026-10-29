/** Product file names are settings: Buildkit uses `buildkit.jsonc` and `.buildkit/`, and SpawnKit picks its own. */
export interface ProductSettings {
  /** The CLI's name, used in suggested commands and generated-file headers. */
  product: string
  /** The config file, relative to the project root. */
  configFile: string
  /** The folder for the lock, journal, backups and plans. */
  stateDir: string
  /** `$schema` written into new config files. */
  schemaUrl?: string
  /** Where the wizard writes required secrets. It's never part of a plan or the lock. */
  secretsFile: string
  /**
   * Where an upgrade finds the seed text it last wrote, to merge your edits three-way. `regenerate` (the default) renders
   * it with the catalog version the lock records. `stored` keeps it in the lock, for a catalog that isn't published, so
   * an old version can't be fetched.
   */
  seedBases?: "regenerate" | "stored"
}

export function defineSettings(settings: Pick<ProductSettings, "product"> & Partial<ProductSettings>): ProductSettings {
  return {
    configFile: `${settings.product}.jsonc`,
    stateDir: `.${settings.product}`,
    secretsFile: ".env",
    ...settings
  }
}

export function lockPath(settings: ProductSettings): string {
  return `${settings.stateDir}/lock.json`
}

/** Paths under the state folder that never belong in git. */
export function stateIgnoreFile(settings: ProductSettings): { path: string; content: string } {
  return {
    path: `${settings.stateDir}/.gitignore`,
    content: ["apply.lock", "journal.json", "backup/", "plans/", ""].join("\n")
  }
}
