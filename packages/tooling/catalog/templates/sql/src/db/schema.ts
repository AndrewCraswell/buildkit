// The app's own tables. drizzle-kit reads this file and add-ons' tables beside it, such as auth-schema.ts, then
// `pnpm db:generate` writes a migration for what changed.
//
// import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
//
// export const note = sqliteTable("note", {
//   id: text("id").primaryKey(),
//   body: text("body").notNull(),
//   createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull()
// })
export {}
