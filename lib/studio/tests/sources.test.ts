import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SourceRecord } from '@/lib/rag/types'
import { controls, ingestSources, resetControls } from '@/lib/studio/tests/fake-rag'
import { ctx, json, req, resetEnv, seedLog, state } from '@/lib/studio/tests/harness'

vi.mock('@/lib/env', async (importOriginal) => {
  const { state } = await import('@/lib/studio/tests/harness')
  return { ...(await importOriginal<typeof import('@/lib/env')>()), getAppEnv: async () => state.env }
})
vi.mock('@/lib/rag', () => import('@/lib/studio/tests/fake-rag'))

const sources = await import('@/app/api/admin/sources/route')
const source = await import('@/app/api/admin/sources/[id]/route')

const RESUME_ID = 'resume:exp:eddy:2'

beforeEach(async () => {
  resetEnv()
  resetControls()
  await ingestSources(state.env, [
    { id: RESUME_ID, kind: 'resume', visibility: 'public', title: 'Eddy — agent platform', topic: 'experience', anchor: 'r-exp-eddy-2', body: 'Built the agent platform.' },
    { id: 'interview:principles-001', kind: 'interview', visibility: 'private', title: 'What won’t you compromise on?', topic: 'principles', body: 'Honesty with users.', meta: { stack: 'principles' } },
  ])
})

describe('GET /api/admin/sources', () => {
  it('lists with kind/topic/q filters and pagination', async () => {
    const all = await json(await sources.GET(await req('/api/admin/sources', { auth: 'token' })))
    expect(all.total).toBe(2)
    const interview = await json(await sources.GET(await req('/api/admin/sources?kind=interview', { auth: 'token' })))
    expect(interview.items.map((s: SourceRecord) => s.id)).toEqual(['interview:principles-001'])
    const byQuery = await json(await sources.GET(await req('/api/admin/sources?q=agent&topic=', { auth: 'token' })))
    expect(byQuery.items.map((s: SourceRecord) => s.id)).toEqual([RESUME_ID])
    const paged = await json(await sources.GET(await req('/api/admin/sources?limit=1&offset=1', { auth: 'token' })))
    expect(paged.items).toHaveLength(1)
    expect(paged.total).toBe(2)
  })

  it('rejects bad filters', async () => {
    expect((await sources.GET(await req('/api/admin/sources?kind=secret', { auth: 'token' }))).status).toBe(400)
    expect((await sources.GET(await req('/api/admin/sources?limit=9999', { auth: 'token' }))).status).toBe(400)
  })

  it('reports 503 while lib/rag is still a stub', async () => {
    controls.stubbed = true
    const res = await sources.GET(await req('/api/admin/sources', { auth: 'token' }))
    expect(res.status).toBe(503)
    expect((await json(res)).error.message).toContain('not implemented')
  })
})

describe('POST /api/admin/sources', () => {
  it('creates a private note and returns its SourceRecord', async () => {
    const res = await sources.POST(await req('/api/admin/sources', { method: 'POST', auth: 'session', body: { title: 'On pairing', body: 'I like pairing on hard bugs.' } }))
    expect(res.status).toBe(201)
    const note: SourceRecord = await json(res)
    expect(note.id).toMatch(/^note:[0-9a-f-]{36}$/)
    expect(note).toMatchObject({ kind: 'note', visibility: 'private', title: 'On pairing', topic: 'notes', chunkCount: 1 })
  })

  it('keeps an explicit topic and validates input', async () => {
    const res = await sources.POST(await req('/api/admin/sources', { method: 'POST', auth: 'token', body: { title: 'T', body: 'B', topic: 'ai' } }))
    expect((await json(res)).topic).toBe('ai')
    expect((await sources.POST(await req('/api/admin/sources', { method: 'POST', auth: 'token', body: { title: '', body: 'B' } }))).status).toBe(400)
    expect((await sources.POST(await req('/api/admin/sources', { method: 'POST', auth: 'token', body: 'nope' }))).status).toBe(400)
  })
})

describe('/api/admin/sources/:id', () => {
  it('gets a source by its URL-encoded id', async () => {
    const res = await source.GET(await req(`/api/admin/sources/${encodeURIComponent(RESUME_ID)}`, { auth: 'token' }), ctx(encodeURIComponent(RESUME_ID)))
    expect(res.status).toBe(200)
    expect((await json(res)).anchor).toBe('r-exp-eddy-2')
    const missing = await source.GET(await req('/api/admin/sources/note%3Anope', { auth: 'token' }), ctx('note:nope'))
    expect(missing.status).toBe(404)
  })

  it('patches interview answers, keeping kind, anchor and meta', async () => {
    const id = 'interview:principles-001'
    const res = await source.PATCH(
      await req(`/api/admin/sources/${encodeURIComponent(id)}`, { method: 'PATCH', auth: 'session', body: { body: 'Honesty, always.', topic: 'decisions' } }),
      ctx(id),
    )
    expect(res.status).toBe(200)
    const updated: SourceRecord = await json(res)
    expect(updated).toMatchObject({ id, kind: 'interview', visibility: 'private', title: 'What won’t you compromise on?', topic: 'decisions', body: 'Honesty, always.' })
    expect(updated.meta).toEqual({ stack: 'principles' })
    expect(controls.calls.ingest).toBe(2)
  })

  it('rejects an empty patch', async () => {
    const id = 'interview:principles-001'
    const res = await source.PATCH(await req(`/api/admin/sources/${id}`, { method: 'PATCH', auth: 'token', body: {} }), ctx(id))
    expect(res.status).toBe(400)
  })

  it('treats resume sources as read-only', async () => {
    const patch = await source.PATCH(await req(`/api/admin/sources/${RESUME_ID}`, { method: 'PATCH', auth: 'token', body: { title: 'Hacked' } }), ctx(RESUME_ID))
    expect(patch.status).toBe(403)
    expect((await json(patch)).error.message).toContain('edit content/resume.ts and re-seed')
    const del = await source.DELETE(await req(`/api/admin/sources/${RESUME_ID}`, { method: 'DELETE', auth: 'token' }), ctx(RESUME_ID))
    expect(del.status).toBe(403)
    const still = await source.GET(await req(`/api/admin/sources/${RESUME_ID}`, { auth: 'token' }), ctx(RESUME_ID))
    expect((await json(still)).title).toBe('Eddy — agent platform')
  })

  it('deletes a note, and deleting a correction unlinks its log', async () => {
    await seedLog(state.env, { id: 'log-9' })
    await ingestSources(state.env, [{ id: 'correction:log-9', kind: 'correction', visibility: 'private', title: 'Q', body: 'A', topic: 'notes' }])
    await state.env.DB.prepare("UPDATE chat_logs SET correction_source_id = 'correction:log-9' WHERE id = 'log-9'").run()

    const res = await source.DELETE(await req('/api/admin/sources/correction%3Alog-9', { method: 'DELETE', auth: 'session' }), ctx('correction%3Alog-9'))
    expect(res.status).toBe(200)
    expect(await json(res)).toEqual({ deleted: 1 })
    const row = await state.env.DB.prepare("SELECT correction_source_id FROM chat_logs WHERE id = 'log-9'").first<{ correction_source_id: string | null }>()
    expect(row?.correction_source_id).toBeNull()
    const again = await source.DELETE(await req('/api/admin/sources/correction%3Alog-9', { method: 'DELETE', auth: 'token' }), ctx('correction:log-9'))
    expect(again.status).toBe(404)
  })
})
