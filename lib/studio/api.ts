/**
 * The studio's browser-side fetch helper. Same-origin requests carry the session cookie, and
 * requireAdmin's CSRF check passes because browsers send Sec-Fetch-Site: same-origin.
 *
 * Every call resolves (never throws, except on abort) to either `{ ok: true, data }` or an error
 * with a message fit to show. `missing` marks routes that don't exist in this build yet
 * (Next's HTML 404), as opposed to a JSON 404 for an unknown record.
 */
import type { SourceKind, SourceRecord } from '@/lib/rag/types'
import type {
  Answer,
  Channel,
  CorrectionResult,
  CreatedKey,
  ImportResult,
  KeyItem,
  LogDetail,
  LogItem,
  Page,
  PersonaRebuild,
  PersonaRecord,
  RetrievedChunk,
  StudioStats,
} from '@/lib/studio/types'

export interface ApiFailure {
  ok: false
  status: number
  code: string
  message: string
  missing: boolean
}

export type ApiResult<T> = { ok: true; status: number; data: T } | ApiFailure

interface CallOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  /** Send a string body as-is (e.g. an exported JSON file). */
  raw?: string
  signal?: AbortSignal
}

export async function api<T>(path: string, opts: CallOptions = {}): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { accept: 'application/json' }
  let body: string | undefined
  if (opts.raw !== undefined) body = opts.raw
  else if (opts.body !== undefined) body = JSON.stringify(opts.body)
  if (body !== undefined) headers['content-type'] = 'application/json'

  let res: Response
  try {
    res = await fetch(path, { method: opts.method ?? 'GET', headers, body, signal: opts.signal, credentials: 'same-origin', cache: 'no-store' })
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err
    return { ok: false, status: 0, code: 'network', message: 'Network error. Is the server running?', missing: false }
  }

  const text = await res.text()
  let data: unknown = null
  let isJson = false
  try {
    data = text ? JSON.parse(text) : null
    isJson = true
  } catch {
    // Not JSON: Next's HTML 404/500 page.
  }
  if (res.ok) return { ok: true, status: res.status, data: data as T }

  if (res.status === 401 && typeof window !== 'undefined') {
    const next = window.location.pathname + window.location.search
    window.location.assign(`/studio/login?next=${encodeURIComponent(next)}`)
  }
  const error = isJson && data && typeof data === 'object' ? (data as { error?: { code?: string; message?: string } }).error : undefined
  const missing = res.status === 404 && !error
  return {
    ok: false,
    status: res.status,
    code: error?.code ?? (missing ? 'missing' : 'http_error'),
    message: error?.message ?? (missing ? `${path.split('?')[0]} isn't part of this build yet.` : `Request failed (HTTP ${res.status}).`),
    missing,
  }
}

function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') sp.set(k, String(v))
  const s = sp.toString()
  return s ? `?${s}` : ''
}

const enc = encodeURIComponent

export interface SourceQuery {
  kind?: SourceKind | ''
  topic?: string
  q?: string
  limit?: number
  offset?: number
}

export interface LogQuery {
  channel?: Channel | ''
  flagged?: boolean | null
  q?: string
  key?: string
  limit?: number
  offset?: number
}

export const studio = {
  stats: (signal?: AbortSignal) => api<StudioStats>('/api/admin/stats', { signal }),

  sources: {
    list: (q: SourceQuery, signal?: AbortSignal) => api<Page<SourceRecord>>(`/api/admin/sources${qs({ ...q })}`, { signal }),
    get: (id: string) => api<SourceRecord>(`/api/admin/sources/${enc(id)}`),
    create: (body: { title: string; body: string; topic?: string | null }) => api<SourceRecord>('/api/admin/sources', { method: 'POST', body }),
    update: (id: string, patch: { title?: string; body?: string; topic?: string | null; visibility?: 'public' | 'private' }) =>
      api<SourceRecord>(`/api/admin/sources/${enc(id)}`, { method: 'PATCH', body: patch }),
    remove: (id: string) => api<{ deleted: number }>(`/api/admin/sources/${enc(id)}`, { method: 'DELETE' }),
  },

  logs: {
    list: (q: LogQuery, signal?: AbortSignal) =>
      api<Page<LogItem>>(`/api/admin/logs${qs({ ...q, flagged: q.flagged == null ? undefined : q.flagged ? 1 : 0 })}`, { signal }),
    get: (id: string, signal?: AbortSignal) => api<LogDetail>(`/api/admin/logs/${enc(id)}`, { signal }),
    flag: (id: string, flagged: boolean) => api<LogItem>(`/api/admin/logs/${enc(id)}`, { method: 'PATCH', body: { flagged } }),
    correct: (id: string, correction: string) => api<CorrectionResult>(`/api/admin/logs/${enc(id)}`, { method: 'POST', body: { correction } }),
  },

  keys: {
    list: () => api<{ items: KeyItem[] }>('/api/admin/keys'),
    create: (label: string, dailyLimit?: number) => api<CreatedKey>('/api/admin/keys', { method: 'POST', body: { label, dailyLimit } }),
    revoke: (id: string) => api<{ revoked: true }>(`/api/admin/keys/${enc(id)}`, { method: 'DELETE' }),
  },

  // Routes owned by other streams; the UI handles `missing` until they merge.
  importAnswers: (fileText: string) => api<ImportResult>('/api/admin/import', { method: 'POST', raw: fileText }),
  persona: {
    get: () => api<PersonaRecord | null>('/api/admin/persona'),
    rebuild: () => api<PersonaRebuild>('/api/admin/persona', { method: 'POST' }),
  },
  debug: {
    answer: (question: string, signal?: AbortSignal) => api<Answer>('/api/admin/debug/answer', { method: 'POST', body: { question }, signal }),
    retrieve: (query: string, k: number, signal?: AbortSignal) =>
      api<{ chunks: RetrievedChunk[] }>('/api/admin/debug/retrieve', { method: 'POST', body: { query, k }, signal }),
  },
}
