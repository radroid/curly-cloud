import { describe, expect, it } from 'vitest'
import { chunkHeader, chunkSource, contentHash, splitBody, stripHeader, CHUNK_OVERLAP, CHUNK_TARGET } from '@/lib/rag/chunk'
import { createCitationFilter, stripCitations, validateCitations } from '@/lib/rag/citations'
import { buildFtsQuery, queryTokens } from '@/lib/rag/fts'
import { createVerbatimGuard, normalizeWords } from '@/lib/rag/guard'
import { cosine, decodeVector, encodeVector, rrf, topKByCosine } from '@/lib/rag/vector'
import type { SourceInput } from '@/lib/rag/types'
import { createTestD1 } from '@/test/helpers/d1'

const sentence = (i: number): string => `Sentence number ${i} talks about building reliable retrieval systems with care.`

describe('chunking', () => {
  const base: SourceInput = { id: 'interview:x', kind: 'interview', visibility: 'private', title: 'Why RAG?', topic: 'ai', body: 'Short answer.' }

  it('keeps short sources as one chunk with a contextual header', () => {
    const chunks = chunkSource(base)
    expect(chunks).toHaveLength(1)
    expect(chunks[0].id).toBe('interview:x#0')
    expect(chunks[0].text).toBe('Interview answer · AI engineering · Why RAG?\nShort answer.')
    expect(stripHeader(chunks[0].text)).toBe('Short answer.')
    expect(chunkHeader({ kind: 'resume', topic: null, title: 'A\ntitle' })).toBe('Resume · General · A title')
  })

  it('splits long answers on sentence boundaries with a small overlap', () => {
    const body = Array.from({ length: 40 }, (_, i) => sentence(i)).join(' ')
    const pieces = splitBody(body)
    expect(pieces.length).toBeGreaterThan(2)
    for (const p of pieces) {
      expect(p.length).toBeLessThanOrEqual(CHUNK_TARGET + CHUNK_OVERLAP)
      expect(p).toMatch(/^Sentence number \d+/)
      expect(p).toMatch(/care\.$/)
    }
    // The last sentence of each chunk starts the next one.
    for (let i = 1; i < pieces.length; i++) {
      const prevLast = pieces[i - 1].split(/(?<=\.)\s+/).pop()
      expect(pieces[i].startsWith(prevLast!)).toBe(true)
    }
    // Every sentence survives.
    const joined = pieces.join(' ')
    for (let i = 0; i < 40; i++) expect(joined).toContain(sentence(i))
  })

  it('keeps paragraph breaks and hard-splits a giant sentence', () => {
    const giant = 'word '.repeat(600).trim()
    const pieces = splitBody(`${'Intro paragraph here. '.repeat(30)}\n\n${giant}`)
    expect(pieces.every((p) => p.length <= CHUNK_TARGET + CHUNK_OVERLAP)).toBe(true)
    expect(pieces.join('')).toContain('word word')
  })

  it('hashes everything that affects chunks', async () => {
    const h = await contentHash(base)
    expect(await contentHash({ ...base })).toBe(h)
    expect(await contentHash({ ...base, title: 'Other' })).not.toBe(h)
    expect(await contentHash({ ...base, body: 'Changed.' })).not.toBe(h)
    expect(await contentHash({ ...base, topic: 'principles' })).not.toBe(h)
  })
})

describe('FTS query sanitizer', () => {
  it('quotes tokens, ORs them and drops stopwords', () => {
    expect(buildFtsQuery('What did you build at Eddy?')).toBe('"build" OR "eddy"')
    expect(buildFtsQuery('who are you')).toBeNull()
    expect(buildFtsQuery('')).toBeNull()
  })

  it('never lets FTS syntax through', () => {
    expect(buildFtsQuery('"foo" OR bar* NEAR(')).toBe('"foo" OR "bar"')
    expect(buildFtsQuery('title:secret ^start -neg AND "unterminated')).toBe('"title" OR "secret" OR "start" OR "neg" OR "unterminated"')
    expect(queryTokens("C# .NET, Node.js & 'quotes' \"double\"")).toEqual(['net', 'node', 'js', 'quotes', 'double'])
    const q = buildFtsQuery('a'.repeat(50) + ' ' + Array.from({ length: 40 }, (_, i) => `tok${i}`).join(' '))
    expect(q?.split(' OR ')).toHaveLength(24)
  })

  it('produces queries FTS5 accepts for hostile input', async () => {
    const db = createTestD1()
    await db.exec("INSERT INTO sources (id, kind, visibility, title, body, content_hash, created_at, updated_at) VALUES ('s', 'note', 'private', 't', 'b', 'h', 0, 0)")
    await db.exec("INSERT INTO chunks (id, source_id, ord, text) VALUES ('s#0', 's', 0, 'building reliable systems at Eddy')")
    const hostile = ['"foo" OR bar* NEAR(', ')))(((', 'NOT', '"', "'; DROP TABLE chunks; --", 'col:val*', 'build* AND eddy^']
    for (const h of hostile) {
      const match = buildFtsQuery(h)
      if (!match) continue
      const rows = await db.prepare('SELECT rowid FROM chunks_fts WHERE chunks_fts MATCH ?').bind(match).all()
      expect(Array.isArray(rows.results)).toBe(true)
    }
    const hit = await db.prepare('SELECT rowid FROM chunks_fts WHERE chunks_fts MATCH ?').bind(buildFtsQuery('builds at eddy')).all()
    expect(hit.results).toHaveLength(1)
  })
})

describe('vectors and RRF', () => {
  it('computes cosine similarity', () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1)
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0)
    expect(cosine([1, 1], [-1, -1])).toBeCloseTo(-1)
    expect(cosine([], [])).toBe(0)
  })

  it('round-trips Float32 BLOBs from ArrayBuffer, views and byte arrays', () => {
    const bytes = encodeVector([3, 4])
    const fromBuffer = decodeVector(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
    expect(Array.from(fromBuffer!)).toEqual([expect.closeTo(0.6, 5), expect.closeTo(0.8, 5)])
    expect(Array.from(decodeVector(bytes)!)).toEqual(Array.from(fromBuffer!))
    expect(Array.from(decodeVector(Array.from(bytes))!)).toEqual(Array.from(fromBuffer!))
    expect(decodeVector(null)).toBeNull()
    expect(decodeVector(new Uint8Array(3))).toBeNull()
  })

  it('ranks rows by cosine', () => {
    const m = new Float32Array([1, 0, 0, 1, 0.7071, 0.7071])
    const top = topKByCosine(m, 2, [0.9, 0.1], 2)
    expect(top.map((t) => t.index)).toEqual([0, 2])
  })

  it('fuses rankings with RRF (k=60)', () => {
    const fused = rrf([
      ['a', 'b', 'c'],
      ['c', 'a', 'd'],
    ])
    expect(fused.map((f) => f.id)).toEqual(['a', 'c', 'b', 'd'])
    expect(fused[0].score).toBeCloseTo(1 / 61 + 1 / 62)
    expect(fused[0].ranks).toEqual([1, 2])
    expect(fused.find((f) => f.id === 'd')?.ranks).toEqual([null, 3])
  })
})

describe('verbatim guard', () => {
  const secret =
    'My favourite debugging approach is to write down the smallest reproduction before touching any code, then bisect the change history until the flaky behaviour flips.'

  it('trips when the output copies a long run, even split across deltas', () => {
    const guard = createVerbatimGuard([secret])
    const copied = 'Honestly? write down the smallest reproduction before touching any code, then bisect the change history until it flips'
    let tripped = false
    for (const piece of copied.match(/.{1,7}/g)!) tripped = guard.push(piece) || tripped
    expect(tripped).toBe(true)
    expect(guard.tripped).toBe(true)
  })

  it('lets a paraphrase through', () => {
    const guard = createVerbatimGuard([secret])
    const paraphrase =
      'I start by pinning down a minimal repro before I change anything, then I bisect through recent changes until the flaky behaviour flips [1]. Guessing costs too much time.'
    expect(guard.push(paraphrase)).toBe(false)
    expect(guard.finish()).toBe(false)
  })

  it('ignores citation markers and case when matching', () => {
    const guard = createVerbatimGuard([secret])
    // 14 complete words; "cod" is held until the word ends.
    expect(guard.push('MY FAVOURITE debugging approach is to write [2] down the smallest reproduction before touching any cod')).toBe(false)
    expect(guard.push('e, then')).toBe(true)
  })

  it('does not protect text that is also public', () => {
    const guard = createVerbatimGuard([secret], { allowTexts: [secret] })
    expect(guard.push(secret) || guard.finish()).toBe(false)
  })

  it('normalises words', () => {
    expect(normalizeWords("I don't [3] Know—it's FINE.")).toEqual(['i', 'dont', 'know', 'its', 'fine'])
  })
})

describe('citations', () => {
  it('keeps valid markers, drops out-of-range ones and records first-use order', () => {
    const r = validateCitations('I led a team [2]. I built a tracker [1][9]. Also [0] and [3, 7] and [Source 1].', 3)
    expect(r.text).toBe('I led a team [2]. I built a tracker [1]. Also and [3] and [1].')
    expect(r.cited).toEqual([2, 1, 3])
  })

  it('holds back markers split across deltas', () => {
    const f = createCitationFilter(2)
    expect(f.push('Built it [')).toBe('Built it')
    expect(f.push('1')).toBe('')
    expect(f.push('] and more [')).toBe(' [1] and more')
    expect(f.push('5] done')).toBe(' done')
    expect(f.flush()).toBe('')
    expect(f.cited()).toEqual([1])
  })

  it('passes ordinary brackets through', () => {
    expect(validateCitations('See [the docs](https://x.dev) and [note].', 2).text).toBe('See [the docs](https://x.dev) and [note].')
    const f = createCitationFilter(2)
    expect(f.push('trailing [open')).toBe('trailing')
    expect(f.flush()).toBe(' [open')
  })

  it('strips markers from replayed history', () => {
    expect(stripCitations('I built it [1][2], twice [3].')).toBe('I built it, twice.')
  })
})
