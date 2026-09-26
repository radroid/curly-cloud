import { describe, expect, it } from 'vitest'
import { createTestD1 } from '@/test/helpers/d1'

describe('chunks_fts', () => {
  it('keeps full-text hits pointing at the right chunks after deletes and VACUUM', async () => {
    const db = createTestD1()
    db.sqlite.exec(`INSERT INTO sources (id, kind, visibility, title, body, content_hash, created_at, updated_at)
      VALUES ('s1', 'note', 'private', 't', 'b', 'h', 0, 0)`)
    const words = ['alpha', 'bravo', 'charlie', 'delta', 'echo']
    for (const [i, w] of words.entries()) {
      db.sqlite.prepare('INSERT INTO chunks (id, source_id, ord, text) VALUES (?, ?, ?, ?)').run(`c-${w}`, 's1', i, `chunk about ${w}`)
    }
    db.sqlite.exec(`DELETE FROM chunks WHERE id IN ('c-alpha', 'c-charlie')`)
    db.sqlite.exec('VACUUM')

    const hit = (term: string) =>
      db.sqlite
        .prepare('SELECT c.id FROM chunks_fts JOIN chunks c ON c.rowid = chunks_fts.rowid WHERE chunks_fts MATCH ?')
        .all(term)
        .map((r) => (r as { id: string }).id)

    expect(hit('echo')).toEqual(['c-echo'])
    expect(hit('delta')).toEqual(['c-delta'])
    expect(hit('alpha')).toEqual([])
  })
})
