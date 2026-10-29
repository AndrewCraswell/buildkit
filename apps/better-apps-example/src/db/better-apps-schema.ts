import { relations } from "drizzle-orm"
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core"

export const note = sqliteTable(
  "note",
  {
    id: text("id").primaryKey(),
    text: text("text").notNull(),
    authorId: text("author_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull()
  },
  (table) => [index("note_createdAt_idx").on(table.createdAt)]
)
