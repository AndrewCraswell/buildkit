// Test databases on node:sqlite, reached through Drizzle's own drivers so the adapter runs the queries it builds for
// each kind of database.
import { DatabaseSync, type SQLInputValue } from "node:sqlite"
import { defineFeature } from "better-apps"
import { drizzle as drizzleD1 } from "drizzle-orm/d1"
import { boolean, datetime, int, mysqlTable, text as mysqlText, varchar } from "drizzle-orm/mysql-core"
import { drizzle as drizzleMysqlProxy } from "drizzle-orm/mysql-proxy"
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { drizzle as drizzleSqliteProxy } from "drizzle-orm/sqlite-proxy"
import type { DrizzleDatabase } from "../src/index.js"

export const comments = defineFeature({
  id: "comments",
  schema: {
    comment: {
      fields: {
        subjectId: { type: "string", required: true },
        body: { type: "string", required: true },
        authorName: { type: "string", required: false, fieldName: "author" },
        score: { type: "number", required: true, defaultValue: 0 },
        pinned: { type: "boolean", required: true, defaultValue: false },
        tags: { type: "string[]", required: false },
        metadata: { type: "json", required: false },
        createdAt: { type: "date", required: true, defaultValue: () => new Date() },
        updatedAt: { type: "date", required: false, onUpdate: () => new Date() }
      }
    },
    reaction: {
      fields: {
        commentId: { type: "string", required: true, references: { model: "comment", field: "id" } },
        emoji: { type: "string", required: true }
      }
    }
  }
})

const comment = sqliteTable("comment", {
  id: text("id").primaryKey(),
  subjectId: text("subject_id").notNull(),
  body: text("body").notNull(),
  author: text("author"),
  score: integer("score").notNull(),
  pinned: integer("pinned", { mode: "boolean" }).notNull(),
  tags: text("tags"),
  metadata: text("metadata"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
})
const reaction = sqliteTable("reaction", {
  id: text("id").primaryKey(),
  commentId: text("comment_id")
    .notNull()
    .references(() => comment.id, { onDelete: "cascade" }),
  emoji: text("emoji").notNull()
})
export const sqliteSchema = { comment, reaction }

const mysqlComment = mysqlTable("comment", {
  id: varchar("id", { length: 36 }).primaryKey(),
  subjectId: varchar("subject_id", { length: 255 }).notNull(),
  body: mysqlText("body").notNull(),
  author: mysqlText("author"),
  score: int("score").notNull(),
  pinned: boolean("pinned").notNull(),
  tags: mysqlText("tags"),
  metadata: mysqlText("metadata"),
  createdAt: datetime("created_at", { mode: "date", fsp: 3 }).notNull(),
  updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
})
const mysqlReaction = mysqlTable("reaction", {
  id: varchar("id", { length: 36 }).primaryKey(),
  commentId: varchar("comment_id", { length: 36 }).notNull(),
  emoji: varchar("emoji", { length: 32 }).notNull()
})

const ddl = `
  PRAGMA foreign_keys = ON;
  CREATE TABLE comment (
    id TEXT PRIMARY KEY, subject_id TEXT NOT NULL, body TEXT NOT NULL, author TEXT, score INTEGER NOT NULL,
    pinned INTEGER NOT NULL, tags TEXT, metadata TEXT, created_at INTEGER NOT NULL, updated_at INTEGER
  );
  CREATE TABLE reaction (
    id TEXT PRIMARY KEY, comment_id TEXT NOT NULL REFERENCES comment(id) ON DELETE CASCADE, emoji TEXT NOT NULL
  );
`

type Method = "run" | "all" | "values" | "get" | "execute"

function open() {
  const sqlite = new DatabaseSync(":memory:")
  sqlite.exec(ddl)
  const query = (sql: string, params: unknown[], method: Method) => {
    const statement = sqlite.prepare(sql)
    const values = params as SQLInputValue[]
    if (method === "run" || method === "execute") {
      const { changes, lastInsertRowid } = statement.run(...values)
      return { rows: [{ affectedRows: Number(changes), insertId: Number(lastInsertRowid) }] }
    }
    statement.setReturnArrays(true)
    // setReturnArrays makes rows arrays of values, which node:sqlite's types don't follow.
    const rows: unknown = method === "get" ? statement.get(...values) : statement.all(...values)
    return { rows: rows as unknown[] }
  }
  const atomic = async <T>(run: () => T | Promise<T>): Promise<T> => {
    sqlite.exec("BEGIN")
    try {
      const result = await run()
      sqlite.exec("COMMIT")
      return result
    } catch (error) {
      sqlite.exec("ROLLBACK")
      throw error
    }
  }
  return { sqlite, query, atomic }
}

/** A Cloudflare D1 binding over node:sqlite, with D1's limit of 100 bound parameters per statement. */
class D1Statement {
  constructor(
    private readonly sqlite: DatabaseSync,
    private readonly sql: string,
    private readonly params: SQLInputValue[] = []
  ) {}

  bind(...params: SQLInputValue[]) {
    if (params.length > 100) {
      throw new Error("D1_ERROR: too many SQL variables")
    }
    return new D1Statement(this.sqlite, this.sql, params)
  }

  async all() {
    return { results: this.sqlite.prepare(this.sql).all(...this.params), success: true, meta: {} }
  }

  async run() {
    const { changes } = this.sqlite.prepare(this.sql).run(...this.params)
    return { results: [], success: true, meta: { changes: Number(changes) } }
  }

  async raw() {
    const statement = this.sqlite.prepare(this.sql)
    statement.setReturnArrays(true)
    return statement.all(...this.params)
  }
}

export interface TestDatabase {
  db: DrizzleDatabase
  provider: "sqlite" | "mysql"
  schema: Record<string, unknown>
  close(): void
}

export const databases: { name: string; connect(): TestDatabase }[] = [
  {
    name: "SQLite with batch()",
    connect() {
      const { sqlite, query, atomic } = open()
      const db = drizzleSqliteProxy(
        async (sql, params, method) => query(sql, params, method),
        (queries) => atomic(() => queries.map(({ sql, params, method }) => query(sql, params, method))),
        { schema: sqliteSchema }
      )
      return { db, provider: "sqlite", schema: sqliteSchema, close: () => sqlite.close() }
    }
  },
  {
    // Drivers such as node-postgres and mysql2 have transactions but no batch().
    name: "SQLite with transactions",
    connect() {
      const { sqlite, query } = open()
      const db = drizzleSqliteProxy(async (sql, params, method) => query(sql, params, method), { schema: sqliteSchema })
      Object.defineProperty(db, "batch", { value: undefined })
      return { db, provider: "sqlite", schema: sqliteSchema, close: () => sqlite.close() }
    }
  },
  {
    name: "Cloudflare D1",
    connect() {
      const { sqlite, atomic } = open()
      const binding = {
        prepare: (sql: string) => new D1Statement(sqlite, sql),
        batch: (statements: D1Statement[]) =>
          atomic(async () => {
            const results = []
            for (const statement of statements) {
              results.push(await statement.all())
            }
            return results
          })
      }
      const db = drizzleD1(binding as unknown as Parameters<typeof drizzleD1>[0], { schema: sqliteSchema })
      return { db, provider: "sqlite", schema: sqliteSchema, close: () => sqlite.close() }
    }
  },
  {
    // MySQL-dialect queries run on SQLite after small rewrites: SQLite has no DEFAULT in VALUES, no FOR UPDATE, and no
    // boolean parameters. This covers the adapter's MySQL query flow, not MySQL itself.
    name: "MySQL dialect",
    connect() {
      const { sqlite, query, atomic } = open()
      const db = drizzleMysqlProxy(
        async (sql, params, method) =>
          query(
            sql.replaceAll(/\bdefault\b/g, "null").replace(/ for update$/, ""),
            params.map((value) => (typeof value === "boolean" ? Number(value) : value)),
            method
          ),
        { schema: { comment: mysqlComment, reaction: mysqlReaction } }
      )
      // Drizzle's MySQL proxy driver has no transactions, so the test supplies them.
      Object.defineProperty(db, "transaction", { value: (run: (tx: unknown) => unknown) => atomic(() => run(db)) })
      return {
        db,
        provider: "mysql",
        schema: { comment: mysqlComment, reaction: mysqlReaction },
        close: () => sqlite.close()
      }
    }
  }
]
