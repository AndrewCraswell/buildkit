import { defineConfig } from "drizzle-kit"

// Migrations for the `main` database in src/db/db.server.ts. drizzle-kit reads every src/db/*schema.ts file: your
// tables in schema.ts and add-ons' tables beside it. Commit the migrations; Better Apps applies them on deploy.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/*schema.ts",
  out: "./migrations/main"
})
