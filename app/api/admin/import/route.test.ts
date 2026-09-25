import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestD1 } from '@/test/helpers/d1'
import type { IngestResult, SourceInput } from '@/lib/rag/types'
import { sampleExport } from '@/lib/interview/test-fixtures'

const env = { ADMIN_TOKEN: 'admin-token-123', SESSION_SECRET: 'session-secret-xyz', DB: createTestD1() }

vi.mock('@/lib/env', () => ({ getAppEnv: vi.fn(async () => env) }))
vi.mock('@/lib/rag', () => ({ ingestSources: vi.fn() }))

const { ingestSources } = await import('@/lib/rag')
const { POST } = await import('./route')
const ingest = vi.mocked(ingestSources)

function post(body: string | null, headers: Record<string, string> = {}): Request {
  return new Request('https://x.test/api/admin/import', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.ADMIN_TOKEN}`, 'content-type': 'application/json', ...headers },
    body,
  })
}

const OK: IngestResult = { upserted: 8, unchanged: 0, deleted: 0, chunks: 9, embedded: 9, errors: [], corpusVersion: 4 }

describe('POST /api/admin/import', () => {
  beforeEach(() => {
    ingest.mockReset()
    ingest.mockResolvedValue(OK)
  })

  it('401s without the admin token, before reading the body', async () => {
    const res = await POST(new Request('https://x.test/api/admin/import', { method: 'POST', body: '{}' }))
    expect(res.status).toBe(401)
    const wrong = await POST(post('{}', { authorization: 'Bearer nope' }))
    expect(wrong.status).toBe(401)
    expect(ingest).not.toHaveBeenCalled()
  })

  it('400s on a body that is not JSON', async () => {
    const res = await POST(post('{not json'))
    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: { message: string } }).error.message).toMatch(/not valid JSON/)
  })

  it('400s on a bad export with friendly, per-card issues', async () => {
    const bad = JSON.parse(JSON.stringify(sampleExport())) as { answers: { answer: { value?: number }; type: string }[] }
    bad.answers.find((a) => a.type === 'scale')!.answer.value = 42
    const res = await POST(post(JSON.stringify(bad)))
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { code: string; issues: string[] } }
    expect(body.error.code).toBe('bad_request')
    expect(body.error.issues.join('\n')).toMatch(/Card \d+ \(.+\): answer\.value must be between 1 and 5/)
    const wrongFile = await POST(post(JSON.stringify({ format: 'raj-clone-question-pack', version: 1 })))
    expect(wrongFile.status).toBe(400)
    expect(ingest).not.toHaveBeenCalled()
  })

  it('413s on an export over 2 MB', async () => {
    const declared = await POST(post('{}', { 'content-length': String(3 * 1024 * 1024) }))
    expect(declared.status).toBe(413)
    const actual = await POST(post(JSON.stringify({ padding: 'x'.repeat(2 * 1024 * 1024 + 10) })))
    expect(actual.status).toBe(413)
    expect(ingest).not.toHaveBeenCalled()
  })

  it('ingests every non-empty answer as a private source', async () => {
    const exported = JSON.parse(JSON.stringify(sampleExport())) as { answers: { answer: Record<string, unknown> }[] }
    exported.answers[0].answer = { text: '' }
    const res = await POST(post(JSON.stringify(exported)))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ result: OK, answers: 7, skipped: 1 })
    expect(ingest).toHaveBeenCalledTimes(1)
    const sources = ingest.mock.calls[0][1] as SourceInput[]
    expect(sources).toHaveLength(7)
    for (const s of sources) {
      expect(s.visibility).toBe('private')
      expect(s.id).toMatch(/^interview:/)
    }
    expect(sources.filter((s) => s.kind === 'note')).toHaveLength(1)
  })

  it('returns a clean 500 when ingest fails', async () => {
    ingest.mockRejectedValue(new Error('lib/rag.ingestSources is not implemented yet'))
    const res = await POST(post(JSON.stringify(sampleExport())))
    expect(res.status).toBe(500)
    const body = (await res.json()) as { error: { code: string; message: string } }
    expect(body.error).toMatchObject({ code: 'internal', message: 'Ingest failed: lib/rag.ingestSources is not implemented yet' })
  })
})
