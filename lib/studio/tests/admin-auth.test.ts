import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createApiKey } from '@/lib/auth'
import { ingestSources } from '@/lib/studio/tests/fake-rag'
import { type AuthMode, ctx, req, resetEnv, seedLog, state } from '@/lib/studio/tests/harness'

vi.mock('@/lib/env', async (importOriginal) => {
  const { state } = await import('@/lib/studio/tests/harness')
  return { ...(await importOriginal<typeof import('@/lib/env')>()), getAppEnv: async () => state.env }
})
vi.mock('@/lib/rag', () => import('@/lib/studio/tests/fake-rag'))

const sources = await import('@/app/api/admin/sources/route')
const source = await import('@/app/api/admin/sources/[id]/route')
const logs = await import('@/app/api/admin/logs/route')
const log = await import('@/app/api/admin/logs/[id]/route')
const keys = await import('@/app/api/admin/keys/route')
const key = await import('@/app/api/admin/keys/[id]/route')
const stats = await import('@/app/api/admin/stats/route')

type Handler = (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>

interface Case {
  name: string
  path: string
  method: string
  handler: Handler
  /** Fresh fixtures per auth mode (e.g. a new note to delete). Returns the id for `:id` routes. */
  setup?: () => Promise<string>
  body?: unknown
}

let noteCount = 0
async function newNote(): Promise<string> {
  const id = `note:test-${++noteCount}`
  await ingestSources(state.env, [{ id, kind: 'note', visibility: 'private', title: 'A note', body: 'Some text', topic: 'notes' }])
  return id
}
async function newKey(): Promise<string> {
  return (await createApiKey(state.env.DB, 'Acme')).record.id
}

const cases: Case[] = [
  { name: 'list sources', path: '/api/admin/sources', method: 'GET', handler: sources.GET },
  { name: 'create note', path: '/api/admin/sources', method: 'POST', handler: sources.POST, body: { title: 'T', body: 'B' } },
  { name: 'get source', path: '/api/admin/sources/:id', method: 'GET', handler: source.GET, setup: newNote },
  { name: 'patch source', path: '/api/admin/sources/:id', method: 'PATCH', handler: source.PATCH, setup: newNote, body: { title: 'New' } },
  { name: 'delete source', path: '/api/admin/sources/:id', method: 'DELETE', handler: source.DELETE, setup: newNote },
  { name: 'list logs', path: '/api/admin/logs', method: 'GET', handler: logs.GET },
  { name: 'get log', path: '/api/admin/logs/:id', method: 'GET', handler: log.GET, setup: async () => 'log-1' },
  { name: 'flag log', path: '/api/admin/logs/:id', method: 'PATCH', handler: log.PATCH, setup: async () => 'log-1', body: { flagged: true } },
  { name: 'correct log', path: '/api/admin/logs/:id', method: 'POST', handler: log.POST, setup: async () => 'log-1', body: { correction: 'Like this.' } },
  { name: 'list keys', path: '/api/admin/keys', method: 'GET', handler: keys.GET },
  { name: 'create key', path: '/api/admin/keys', method: 'POST', handler: keys.POST, body: { label: 'Acme' } },
  { name: 'revoke key', path: '/api/admin/keys/:id', method: 'DELETE', handler: key.DELETE, setup: newKey },
  { name: 'stats', path: '/api/admin/stats', method: 'GET', handler: stats.GET },
]

async function call(c: Case, auth: AuthMode, headers: Record<string, string> = {}): Promise<Response> {
  const id = c.setup ? await c.setup() : ''
  const path = c.path.replace(':id', encodeURIComponent(id))
  const request = await req(path, { method: c.method, body: c.body, auth, headers })
  return c.handler(request, ctx(id))
}

beforeAll(async () => {
  resetEnv()
  await seedLog(state.env, { id: 'log-1' })
})

describe.each(cases)('$method $path ($name)', (c) => {
  it('401 without credentials', async () => {
    const res = await call(c, 'none')
    expect(res.status).toBe(401)
  })

  it('works with the bearer admin token', async () => {
    const res = await call(c, 'token')
    expect(res.status, await res.clone().text()).toBeLessThan(300)
  })

  it('works with a studio session cookie', async () => {
    const res = await call(c, 'session')
    expect(res.status, await res.clone().text()).toBeLessThan(300)
  })

  if (c.method !== 'GET') {
    it('blocks cookie-authenticated cross-site mutations', async () => {
      const res = await call(c, 'session', { 'sec-fetch-site': 'cross-site' })
      expect(res.status).toBe(403)
    })
  }
})
