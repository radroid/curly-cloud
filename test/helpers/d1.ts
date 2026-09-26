/**
 * A D1Database stand-in backed by node:sqlite, so unit tests run the real SQL (including FTS5
 * and triggers) from migrations/. Covers the subset of the D1 API this codebase uses:
 * prepare().bind().all()/first()/run()/raw(), batch(), exec().
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

type Params = unknown[]

function toSqlite(value: unknown): unknown {
  if (value === undefined) return null
  if (typeof value === 'boolean') return value ? 1 : 0
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  return value
}

function fromSqlite(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    // D1 returns BLOBs as ArrayBuffer; mirror that so decoding code is exercised.
    out[k] = v instanceof Uint8Array ? v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength) : v
  }
  return out
}

class Statement {
  constructor(
    private db: DatabaseSync,
    private sql: string,
    private params: Params = [],
  ) {}

  bind(...params: Params): Statement {
    return new Statement(this.db, this.sql, params)
  }

  private stmt() {
    return this.db.prepare(this.sql)
  }

  async all<T>() {
    const rows = this.stmt().all(...(this.params.map(toSqlite) as never[])) as Record<string, unknown>[]
    return { results: rows.map(fromSqlite) as T[], success: true, meta: {} }
  }

  async first<T>(column?: string): Promise<T | null> {
    const row = this.stmt().get(...(this.params.map(toSqlite) as never[])) as Record<string, unknown> | undefined
    if (!row) return null
    const r = fromSqlite(row)
    return (column ? r[column] : r) as T
  }

  async run() {
    const trimmed = this.sql.trim().toUpperCase()
    if (/\bRETURNING\b/.test(trimmed)) {
      const rows = this.stmt().all(...(this.params.map(toSqlite) as never[])) as Record<string, unknown>[]
      return { results: rows.map(fromSqlite), success: true, meta: { changes: rows.length } }
    }
    const info = this.stmt().run(...(this.params.map(toSqlite) as never[]))
    return { results: [], success: true, meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) } }
  }

  async raw<T>() {
    const rows = this.stmt().all(...(this.params.map(toSqlite) as never[])) as Record<string, unknown>[]
    return rows.map((r) => Object.values(fromSqlite(r))) as T[]
  }
}

export function createTestD1(options: { migrate?: boolean } = {}): D1Database & { sqlite: DatabaseSync } {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON;')
  if (options.migrate !== false) {
    const dir = join(process.cwd(), 'migrations')
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
      sqlite.exec(readFileSync(join(dir, file), 'utf8'))
    }
  }
  const db = {
    sqlite,
    prepare: (sql: string) => new Statement(sqlite, sql),
    async batch(statements: Statement[]) {
      sqlite.exec('BEGIN')
      try {
        const out: unknown[] = []
        for (const s of statements) out.push(await s.run())
        sqlite.exec('COMMIT')
        return out
      } catch (err) {
        sqlite.exec('ROLLBACK')
        throw err
      }
    },
    async exec(sql: string) {
      sqlite.exec(sql)
      return { count: 0, duration: 0 }
    },
    dump: async () => new ArrayBuffer(0),
    withSession: () => db,
  }
  return db as unknown as D1Database & { sqlite: DatabaseSync }
}
