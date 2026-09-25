import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { detectFormat, loadConfig, parseDevVars, run } from '@/scripts/clone'
import { SAMPLE_PACK, sampleExport } from './test-fixtures'

const dir = mkdtempSync(join(tmpdir(), 'clone-cli-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))
const exportFile = join(dir, 'raj-clone-answers-2026-09-25.json')
writeFileSync(exportFile, JSON.stringify(sampleExport()))
writeFileSync(join(dir, 'pack.json'), JSON.stringify(SAMPLE_PACK))

const ENV = { CLONE_URL: 'http://localhost:3205', ADMIN_TOKEN: 't0k' }

function capture(): { log: (l: string) => void; text: () => string } {
  const lines: string[] = []
  return { log: (l) => lines.push(l), text: () => lines.join('\n') }
}

describe('clone CLI', () => {
  it('parses .dev.vars and prefers the environment', () => {
    expect(parseDevVars('# c\nADMIN_TOKEN="abc"\nexport CLONE_URL=http://localhost:3201 # dev\nBAD LINE\n')).toEqual({
      ADMIN_TOKEN: 'abc',
      CLONE_URL: 'http://localhost:3201',
    })
    const cfg = loadConfig({ CLONE_URL: 'https://curlycloud.dev/', ADMIN_TOKEN: 'x' }, dir)
    expect(cfg).toEqual({ url: 'https://curlycloud.dev', token: 'x', tokenSource: 'env', local: false })
    expect(loadConfig({}, dir).url).toBe('http://localhost:3000')
  })

  it('detects file formats', () => {
    expect(detectFormat(sampleExport())).toBe('answers')
    expect(detectFormat(SAMPLE_PACK)).toBe('pack')
    expect(detectFormat({ sources: [] })).toBe('sources')
    expect(detectFormat({ format: 'raj-clone-stack-backup' })).toBe('backup')
    expect(detectFormat([1])).toBe('unknown')
  })

  it('posts exports to /api/admin/import and reports counts; skips question packs', async () => {
    const out = capture()
    const calls: { url: string; auth: string | null }[] = []
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, auth: new Headers(init.headers).get('authorization') })
      return new Response(
        JSON.stringify({ result: { upserted: 8, unchanged: 0, deleted: 0, chunks: 9, embedded: 9, errors: [], corpusVersion: 3 }, answers: 8, skipped: 0 }),
        { status: 200 },
      )
    }) as typeof fetch
    const code = await run(['ingest', dir], { log: out.log, env: ENV, fetchImpl })
    expect(code).toBe(0)
    expect(calls).toEqual([{ url: 'http://localhost:3205/api/admin/import', auth: 'Bearer t0k' }])
    expect(out.text()).toMatch(/8 answers imported\. 8 new or changed, 0 unchanged, 9 chunks, 9 embedded, corpus v3/)
    expect(out.text()).toMatch(/pack\.json: a question pack/)
  })

  it('explains an unreachable server, a wrong token and a server error', async () => {
    const down = capture()
    const refused = (async () => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof fetch
    expect(await run(['ingest', exportFile], { log: down.log, env: ENV, fetchImpl: refused })).toBe(1)
    expect(down.text()).toMatch(/Can't reach http:\/\/localhost:3205\. Start the dev server/)

    const denied = capture()
    const unauthorized = (async () => new Response('{"error":{"code":"unauthorized"}}', { status: 401 })) as unknown as typeof fetch
    expect(await run(['stats'], { log: denied.log, env: ENV, fetchImpl: unauthorized })).toBe(1)
    expect(denied.text()).toMatch(/rejected the admin token \(401\)/)

    const broken = capture()
    const failing = (async () =>
      new Response('{"error":{"code":"internal","message":"Ingest failed: lib/rag.ingestSources is not implemented yet"}}', { status: 500 })) as unknown as typeof fetch
    expect(await run(['ingest', exportFile], { log: broken.log, env: ENV, fetchImpl: failing })).toBe(1)
    expect(broken.text()).toMatch(/failed with 500 internal: Ingest failed: lib\/rag\.ingestSources is not implemented yet/)
  })

  it('refuses to write to production without --yes', async () => {
    const out = capture()
    const code = await run(['ingest', exportFile], { log: out.log, env: { CLONE_URL: 'https://curlycloud.dev', ADMIN_TOKEN: 'x' } })
    expect(code).toBe(1)
    expect(out.text()).toMatch(/explicit go-ahead.*--yes/)
  })

  it('validates exports and packs locally', async () => {
    const out = capture()
    expect(await run(['validate', dir], { log: out.log, env: ENV })).toBe(0)
    expect(out.text()).toMatch(/✓ pack\.json: question pack "Follow-ups from round 1" with 2 questions/)
    expect(out.text()).toMatch(/✓ raj-clone-answers-2026-09-25\.json: 8 answers/)
  })
})
