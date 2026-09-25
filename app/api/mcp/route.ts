import { getAppEnv } from '@/lib/env'
import { handleMcpPost, mcpMethodNotAllowed, mcpPreflight } from '@/lib/mcp/http'

// MCP endpoint for visiting agents. Also served at /mcp (rewrite in next.config.ts).
export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  return handleMcpPost(request, await getAppEnv())
}

// Stateless JSON mode: no standalone SSE stream to open and no session to delete.
export function GET(): Response {
  return mcpMethodNotAllowed()
}

export function DELETE(): Response {
  return mcpMethodNotAllowed()
}

export function OPTIONS(): Response {
  return mcpPreflight()
}
