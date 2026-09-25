/**
 * Ready-to-paste MCP connection snippets for a company's agent. Pure, so the keys page and tests
 * share one source of truth.
 */

export type SnippetId = 'claude-code' | 'cursor' | 'claude-desktop' | 'curl'

export const SNIPPET_TABS: { id: SnippetId; label: string; where: string }[] = [
  { id: 'claude-code', label: 'Claude Code', where: 'Run in a terminal.' },
  { id: 'cursor', label: 'Cursor', where: 'Add to ~/.cursor/mcp.json (or .cursor/mcp.json in a project).' },
  { id: 'claude-desktop', label: 'Claude Desktop', where: 'Add to claude_desktop_config.json. Uses mcp-remote to bridge the HTTP server.' },
  { id: 'curl', label: 'curl', where: 'One-off call to the ask_raj tool.' },
]

export function snippet(id: SnippetId, origin: string, token: string): string {
  const url = `${origin}/mcp`
  switch (id) {
    case 'claude-code':
      return `claude mcp add --transport http raj-dholakia ${url} --header "Authorization: Bearer ${token}"`
    case 'cursor':
      return JSON.stringify({ mcpServers: { 'raj-dholakia': { url, headers: { Authorization: `Bearer ${token}` } } } }, null, 2)
    case 'claude-desktop':
      return JSON.stringify(
        {
          mcpServers: {
            'raj-dholakia': {
              command: 'npx',
              args: ['-y', 'mcp-remote', url, '--header', 'Authorization:${AUTH_HEADER}'],
              env: { AUTH_HEADER: `Bearer ${token}` },
            },
          },
        },
        null,
        2,
      )
    case 'curl':
      return [
        `curl -s ${url} \\`,
        `  -H "Authorization: Bearer ${token}" \\`,
        `  -H "Content-Type: application/json" \\`,
        `  -H "Accept: application/json, text/event-stream" \\`,
        `  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"ask_raj","arguments":{"question":"What are you building right now?"}}}'`,
      ].join('\n')
  }
}
