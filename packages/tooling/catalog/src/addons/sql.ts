import { defineAddon, type Contribution } from "@buildkitgg/scaffolder"
import { dependency, fromTemplate, jsonItems } from "../files.js"
import { betterAppsDependency } from "../versions.js"

/** What the database add-on gives the add-ons that need a database, through `ctx.provided("database")`. */
export interface DatabaseProvision {
  dialect: "sqlite"
  /** The app module that exports the Drizzle database, relative to the project root. */
  module: string
  /** The Drizzle database's export name. */
  export: string
  /** The folder drizzle-kit reads tables from. Add-ons put their own `<name>-schema.ts` there. */
  schemaFolder: string
}

const provision: DatabaseProvision = {
  dialect: "sqlite",
  module: "./src/db/db.server.ts",
  export: "db",
  schemaFolder: "src/db"
}

/** Narrows what `ctx.provided("database")` returns. */
export function isDatabaseProvision(value: unknown): value is DatabaseProvision {
  return (
    typeof value === "object" &&
    value !== null &&
    "dialect" in value &&
    value.dialect === "sqlite" &&
    "module" in value &&
    typeof value.module === "string" &&
    "export" in value &&
    typeof value.export === "string" &&
    "schemaFolder" in value &&
    typeof value.schemaFolder === "string"
  )
}

const set = "sql"

/**
 * A SQL database through Better Apps' SQL capability, with Drizzle. The app declares the database in its own code, and
 * Better Apps' deploy service provisions and migrates it; the app names no cloud and holds no bindings.
 */
export const sql = defineAddon({
  id: "@buildkit/sql",
  version: "1.0.0",
  title: "SQL database",
  description: "A SQL database declared in your code with Better Apps' SQL capability, queried with Drizzle.",
  slot: "database",
  provides: { database: provision },
  contribute: (ctx): Contribution[] => [
    ...betterAppsDependency("@better-apps/sql"),
    dependency(ctx, "drizzle-orm"),
    dependency(ctx, "drizzle-kit", true),
    { kind: "script", name: "db:generate", command: "drizzle-kit generate" },
    jsonItems("tsconfig.json", "/include", ["drizzle.config.ts"]),
    fromTemplate(set, "src/db/db.server.ts"),
    fromTemplate(set, "src/db/schema.ts"),
    fromTemplate(set, "drizzle.config.ts"),
    {
      kind: "notice",
      code: "sql-transactions",
      text: "The SQL capability runs on a backend without interactive transactions: use db.batch() for writes that must commit together."
    }
  ],
  nextSteps: () => ["Add tables to src/db/schema.ts, then run pnpm db:generate to write their migration."]
})
