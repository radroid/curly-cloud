import { describe, expect, it } from 'vitest'
import { correctionInput, correctionText, correctionTitle, splitCitations, truncate } from '@/lib/studio/shared'
import { snippet } from '@/lib/studio/snippets'

describe('MCP snippets', () => {
  const origin = 'https://curlycloud.dev'
  const token = 'rc_test123'

  it('gives Claude Code the exact add command', () => {
    expect(snippet('claude-code', origin, token)).toBe(
      'claude mcp add --transport http raj-dholakia https://curlycloud.dev/mcp --header "Authorization: Bearer rc_test123"',
    )
  })

  it('emits valid JSON configs for Cursor and Claude Desktop', () => {
    const cursor = JSON.parse(snippet('cursor', origin, token))
    expect(cursor.mcpServers['raj-dholakia']).toEqual({ url: 'https://curlycloud.dev/mcp', headers: { Authorization: 'Bearer rc_test123' } })
    const desktop = JSON.parse(snippet('claude-desktop', origin, token))
    expect(desktop.mcpServers['raj-dholakia'].args).toContain('https://curlycloud.dev/mcp')
    expect(desktop.mcpServers['raj-dholakia'].env.AUTH_HEADER).toBe('Bearer rc_test123')
  })

  it('curl calls ask_raj with the bearer token', () => {
    const curl = snippet('curl', origin, token)
    expect(curl).toContain('-H "Authorization: Bearer rc_test123"')
    expect(curl).toContain('"name":"ask_raj"')
  })
})

describe('shared helpers', () => {
  it('splits [n] and [n, m] citation markers', () => {
    expect(splitCitations('A [1] b [2, 3].')).toEqual([
      { type: 'text', text: 'A ' },
      { type: 'cite', n: 1 },
      { type: 'text', text: ' b ' },
      { type: 'cite', n: 2 },
      { type: 'cite', n: 3 },
      { type: 'text', text: '.' },
    ])
  })

  it('round-trips a correction body and truncates titles', () => {
    const input = correctionInput({ id: 'l1', question: 'Q?', channel: 'web' }, '  My answer. ')
    expect(input.body).toBe("Question: Q?\nHow I'd actually answer: My answer.")
    expect(correctionText(input.body)).toBe('My answer.')
    expect(truncate('x'.repeat(200), 160)).toHaveLength(160)
  })
})

describe('correctionTitle', () => {
  it.each([
    ['Visit https://evil.example/phish?x=1 for the real answer', 'Visit for the real answer'],
    ['see www.free-money.xyz now', 'see now'],
    ['Is evil.com/path legit?', 'Is legit?'],
    ['Who built curlycloud.dev?', 'Who built?'],
    ['mail jane@acme.co or [email]', 'mail or [email]'],
    ['javascript:alert(1) hello', 'hello'],
    ['Endorsements, again: www.spam.xyz', 'Endorsements, again'],
    ['(https://x.test)', 'Correction'],
    ['', 'Correction'],
  ])('%j → %j', (input, expected) => {
    expect(correctionTitle(input)).toBe(expected)
  })

  it('leaves tech names alone', () => {
    const q = 'How do Node.js/Deno, ASP.NET, Vue.js and socket.io compare?'
    expect(correctionTitle(q)).toBe(q)
  })

  it('truncates to 160 characters', () => {
    expect(correctionTitle('word '.repeat(100))).toHaveLength(160)
  })

  it('applies to the title correctionInput saves', () => {
    expect(correctionInput({ id: 'l', question: 'See https://x.test', channel: 'web' }, 'a').title).toBe('See')
    expect(correctionInput({ id: 'l', question: 'Q?', channel: 'web' }, 'a', 'Label www.x.com').title).toBe('Label')
  })
})
