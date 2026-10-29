import { defineDatabase } from "@better-apps/sql"
import { drizzle } from "@better-apps/sql/drizzle"
import * as schema from "./schema"

/**
 * The app's SQL database. Better Apps provisions it for each environment from this declaration, and applies the
 * migrations drizzle-kit writes to `migrations/main`. The name and options must stay literals: the build reads them.
 */
export const main = defineDatabase("main", { dialect: "sqlite", migrations: "./migrations/main" })

/** Drizzle on the main database. Each query reaches the database of the environment the request runs in. */
export const db = drizzle(main, { schema })
