/**
 * Thin helpers over D1. Raw SQL on purpose: the schema is small and every query stays readable
 * next to the code that uses it. Tests run the same SQL against node:sqlite (test/helpers/d1.ts).
 */

export type Row = Record<string, unknown>

export async function all<T = Row>(db: D1Database, sql: string, ...params: unknown[]): Promise<T[]> {
  const { results } = await db.prepare(sql).bind(...params).all<T>()
  return results ?? []
}

export async function first<T = Row>(db: D1Database, sql: string, ...params: unknown[]): Promise<T | null> {
  return (await db.prepare(sql).bind(...params).first<T>()) ?? null
}

export async function run(db: D1Database, sql: string, ...params: unknown[]): Promise<D1Result> {
  return db.prepare(sql).bind(...params).run()
}

export function now(): number {
  return Date.now()
}

/** UTC day key, e.g. "2026-09-25". Used for daily limits, budgets and salts. */
export function dayKey(at: number = Date.now()): string {
  return new Date(at).toISOString().slice(0, 10)
}

export function newId(prefix = ''): string {
  return prefix + crypto.randomUUID()
}

/** Parse a JSON column, returning the fallback on null or malformed input. */
export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || value === '') return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

// ── meta table ───────────────────────────────────────────────────────────────

export async function getMeta(db: D1Database, key: string): Promise<string | null> {
  const row = await first<{ value: string }>(db, 'SELECT value FROM meta WHERE key = ?', key)
  return row?.value ?? null
}

export async function setMeta(db: D1Database, key: string, value: string): Promise<void> {
  await run(
    db,
    'INSERT INTO meta (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
    key,
    value,
    now(),
  )
}

/** Monotonic counter bumped on every ingest; retrieval caches key off it. */
export async function getCorpusVersion(db: D1Database): Promise<number> {
  return Number((await getMeta(db, 'corpus_version')) ?? 0)
}

export async function bumpCorpusVersion(db: D1Database): Promise<number> {
  const row = await first<{ value: string }>(
    db,
    "UPDATE meta SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT), updated_at = ? WHERE key = 'corpus_version' RETURNING value",
    now(),
  )
  return Number(row?.value ?? 0)
}
