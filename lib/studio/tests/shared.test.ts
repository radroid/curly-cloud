import { describe, expect, it } from 'vitest'
import { correctionInput, correctionText, splitCitations, truncate } from '@/lib/studio/shared'
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
