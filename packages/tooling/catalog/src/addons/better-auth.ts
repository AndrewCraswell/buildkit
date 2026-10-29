import { defineAddon, type Contribution } from "@buildkitgg/scaffolder"
import { dependency, fromTemplate } from "../files.js"
import { betterAppsDependency } from "../versions.js"
import { isDatabaseProvision } from "./sql.js"

const set = "better-auth"

/**
 * Email and password sign-in with Better Auth, read through Better Apps' identity interface. Users and sessions live in
 * the database add-on's `main` database, so the auth slot needs the database slot.
 */
export const betterAuth = defineAddon({
  id: "@buildkit/better-auth",
  version: "1.0.0",
  title: "Better Auth",
  description: "Email and password sign-in with Better Auth, in your database, read through Better Apps' identity.",
  slot: "auth",
  provides: { identity: { module: "./src/auth/identity.server.ts", export: "identity" } },
  requires: ["slot:database"],
  supports: ({ target }) => (target.has("server-functions") ? true : "Better Auth needs server routes."),
  contribute(ctx): Contribution[] {
    const database = ctx.provided("database")
    // The starter files import the Drizzle database from the SQL add-on's module and keep their tables beside its own.
    if (!isDatabaseProvision(database) || database.module !== "./src/db/db.server.ts") {
      throw new Error("Better Auth's starter files need the SQL database add-on's Drizzle database in src/db.")
    }
    return [
      dependency(ctx, "better-auth"),
      ...betterAppsDependency("@better-apps/better-auth"),
      fromTemplate(set, "src/auth/auth.server.ts"),
      fromTemplate(set, "src/auth/identity.server.ts"),
      fromTemplate(set, "src/auth/viewer.functions.ts"),
      fromTemplate(set, "src/auth/client.ts"),
      fromTemplate(set, "src/routes/api/auth/$.ts"),
      fromTemplate(set, `${database.schemaFolder}/auth-schema.ts`),
      fromTemplate(set, "src/routes/sign-in.tsx", "sample"),
      {
        kind: "env",
        name: "BETTER_AUTH_SECRET",
        scope: "server",
        secret: true,
        required: true,
        description:
          "Signs session cookies. Use a random value of at least 32 characters, different in each environment."
      },
      {
        kind: "env",
        name: "BETTER_AUTH_URL",
        scope: "server",
        secret: false,
        required: false,
        description: "The app's own address. Better Auth accepts sign-ins sent only from it.",
        example: "http://localhost:3000"
      },
      {
        kind: "command",
        run: "pnpm db:generate",
        when: "after-install",
        why: "Writes the migration that creates Better Auth's tables in migrations/main."
      }
    ]
  },
  nextSteps: () => ["Open /sign-in to create the first account. Read the viewer in a loader with getViewer()."]
})
