/**
 * HTTP side of the MCP endpoint (/mcp → /api/mcp): API-key auth, CORS, a body-size cap, and a
 * fresh stateless server + Streamable HTTP transport per request, answering with plain JSON.
 */
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { RESUME } from '@/content/resume'
import { verifyApiKey, type ApiKeyRecord } from '@/lib/auth'
import { getLimits, type AppEnv } from '@/lib/env'
import { createRajMcpServer } from '@/lib/mcp/server'
import { clientIdFromRequest } from '@/lib/security'

export const MAX_BODY_BYTES = 64 * 1024

const REALM = 'curlycloud.dev'

const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-expose-headers': 'mcp-session-id, mcp-protocol-version, www-authenticate, retry-after',
}

const PREFLIGHT_HEADERS: Record<string, string> = {
  ...CORS_HEADERS,
  'access-control-allow-methods': 'POST, GET, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, mcp-protocol-version, mcp-session-id',
  'access-control-max-age': '86400',
}

/** Copy a response with CORS (and no-store) headers added. */
export function withCors(res: Response): Response {
  const headers = new Headers(res.headers)
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v)
  if (!headers.has('cache-control')) headers.set('cache-control', 'no-store')
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
}

/** A JSON-RPC error body, the shape the SDK transport itself uses for HTTP-level failures. */
export function rpcErrorResponse(status: number, code: number, message: string, headers: Record<string, string> = {}): Response {
  return withCors(
    new Response(JSON.stringify({ jsonrpc: '2.0', error: { code, message }, id: null }), {
      status,
      headers: { 'content-type': 'application/json', ...headers },
    }),
  )
}

export function mcpPreflight(): Response {
  return new Response(null, { status: 204, headers: PREFLIGHT_HEADERS })
}

/** Stateless JSON mode has no standalone SSE stream (GET) and no session to end (DELETE). */
export function mcpMethodNotAllowed(): Response {
  return rpcErrorResponse(405, -32000, 'Method not allowed. This MCP server is stateless: send JSON-RPC messages with POST.', {
    allow: 'POST, OPTIONS',
  })
}

type AuthResult = { ok: true; key: ApiKeyRecord | null } | { ok: false; response: Response }

function unauthorized(message: string, invalidToken: boolean): Response {
  const challenge = invalidToken ? `Bearer realm="${REALM}", error="invalid_token"` : `Bearer realm="${REALM}"`
  return rpcErrorResponse(401, -32001, message, { 'www-authenticate': challenge })
}

/** `Authorization: Bearer rc_…` → an active key. No header → anonymous unless MCP_REQUIRE_KEY. */
export async function authenticate(request: Request, env: AppEnv): Promise<AuthResult> {
  const header = request.headers.get('authorization')?.trim()
  if (header) {
    const match = /^Bearer(?:\s+(.*))?$/i.exec(header)
    if (!match) {
      return { ok: false, response: unauthorized('Unsupported Authorization scheme. Send "Authorization: Bearer rc_…", or omit the header.', true) }
    }
    const token = match[1]?.trim() ?? ''
    // An empty token (e.g. an unset env var in a client config) is treated as no key.
    if (token) {
      const key = await verifyApiKey(env.DB, token)
      if (!key) {
        return {
          ok: false,
          response: unauthorized(`Invalid or revoked API key. Check the token, or email Raj at ${RESUME.email} for a new one.`, true),
        }
      }
      return { ok: true, key }
    }
  }
  if (getLimits(env).mcpRequireKey) {
    return {
      ok: false,
      response: unauthorized(
        `An API key is required. Email Raj at ${RESUME.email} with your company and what your agent will do, then send the key as "Authorization: Bearer rc_…".`,
        false,
      ),
    }
  }
  return { ok: true, key: null }
}

export async function handleMcpPost(request: Request, env: AppEnv): Promise<Response> {
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    return rpcErrorResponse(413, -32000, `Payload too large: the limit is ${MAX_BODY_BYTES / 1024} KB.`)
  }

  let server: ReturnType<typeof createRajMcpServer> | null = null
  try {
    const auth = await authenticate(request, env)
    if (!auth.ok) return auth.response

    const clientId = auth.key ? `key:${auth.key.id}` : await clientIdFromRequest(request, env.SESSION_SECRET)
    server = createRajMcpServer({ env, clientId, key: auth.key, origin: new URL(request.url).origin })
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
      maxRequestBodySize: MAX_BODY_BYTES,
    })
    await server.connect(transport)
    // In JSON mode this resolves once every response is ready, so the server can close afterwards.
    return withCors(await transport.handleRequest(request))
  } catch (err) {
    console.error('mcp: request failed', err)
    return rpcErrorResponse(500, -32603, 'Internal error. Try again shortly.')
  } finally {
    await server?.close().catch(() => undefined)
  }
}
