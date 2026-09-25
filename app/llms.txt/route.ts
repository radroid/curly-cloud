import { getAppEnv, getLimits, type Limits } from '@/lib/env'
import { buildLlmsTxt } from '@/lib/mcp/llms'

// Agent-facing description of the site and the MCP server (llmstxt.org convention).
export const dynamic = 'force-dynamic'

async function currentLimits(): Promise<Limits> {
  try {
    return getLimits(await getAppEnv())
  } catch {
    // No bindings (e.g. a static render): fall back to the defaults.
    return getLimits({} as Parameters<typeof getLimits>[0])
  }
}

export async function GET(request: Request): Promise<Response> {
  const body = buildLlmsTxt(new URL(request.url).origin, await currentLimits())
  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
      'access-control-allow-origin': '*',
    },
  })
}
