/**
 * Signed assistant turns. Clients replay the conversation with every request, so an "assistant"
 * turn in a request is only as trustworthy as the client that sent it: a visitor could invent one
 * where the clone agreed to recite its notes. The server therefore signs what the clone actually
 * said (`sig` on the `done` event) and drops replayed assistant turns without a valid signature
 * before prompting.
 *
 *   sig = base64url(HMAC-SHA256(SESSION_SECRET, "clone-turn:v2:" + sha256hex(question) + ":" + text))
 *
 * `text` is the answer exactly as streamed (all `delta` texts joined), trimmed: the chat route trims
 * replayed assistant turns, and surrounding whitespace carries no meaning. `question` is the user
 * turn it answered (trimmed), so a signed answer only verifies after the question it was given for;
 * it can't be spliced in after a different one. The prefix keeps these signatures apart from every
 * other HMAC made with the same secret (session tokens sign base64url, which can't contain ":").
 *
 * Not bound to the session: the same question/answer pair can be replayed later. It is still text
 * the clone really said, in context, and that passed the output guard.
 */
import type { AppEnv } from '@/lib/env'
import type { ChatTurn } from '@/lib/rag/types'
import { hmacSha256, sha256Hex, timingSafeEqual, toBase64Url } from '@/lib/security/crypto'

const TURN_CONTEXT = 'clone-turn:v2:'
/** base64url of a 32-byte HMAC is 43 chars; anything much longer is not ours. */
const MAX_SIG_CHARS = 64

/** The signing secret, or null when none is configured (then nothing is signed or trusted). */
export function turnSecret(env: Pick<AppEnv, 'SESSION_SECRET'>): string | null {
  const s = env.SESSION_SECRET
  return typeof s === 'string' && s.length > 0 ? s : null
}

/** Sign an answer to `question`. */
export async function signTurn(secret: string, question: string, text: string): Promise<string> {
  const q = await sha256Hex(question.trim())
  return toBase64Url(await hmacSha256(secret, `${TURN_CONTEXT}${q}:${text.trim()}`))
}

/** Timing-safe check of a replayed assistant turn's signature against the question it followed. */
export async function verifyTurn(secret: string, question: string, text: string, sig: unknown): Promise<boolean> {
  if (typeof sig !== 'string' || !sig || sig.length > MAX_SIG_CHARS) return false
  return timingSafeEqual(await signTurn(secret, question, text), sig)
}

/** The nearest user turn before index `i`, or null. */
function questionBefore(turns: ChatTurn[], i: number): string | null {
  for (let j = i - 1; j >= 0; j--) if (turns[j].role === 'user') return turns[j].content
  return null
}

/** Drop leading assistant turns: a conversation starts with the visitor. Consecutive user turns are fine. */
export function startWithUser(turns: ChatTurn[]): ChatTurn[] {
  const first = turns.findIndex((t) => t.role === 'user')
  return first === -1 ? [] : turns.slice(first)
}

/**
 * The conversation as the model may see it: user turns as sent, assistant turns only when their
 * signature verifies (without the `sig` field), starting with a user turn.
 */
export async function trustedTurns(secret: string | null, turns: ChatTurn[]): Promise<ChatTurn[]> {
  const keep = await Promise.all(
    turns.map(async (t, i) => {
      if (t.role === 'user') return true
      const question = questionBefore(turns, i)
      return secret !== null && question !== null && (await verifyTurn(secret, question, t.content, t.sig))
    }),
  )
  return startWithUser(turns.filter((_, i) => keep[i]).map((t) => ({ role: t.role, content: t.content })))
}

/** Sign every assistant turn (admin-trusted input, e.g. eval histories). */
export async function signTurns(secret: string | null, turns: ChatTurn[]): Promise<ChatTurn[]> {
  if (secret === null) return turns
  return Promise.all(
    turns.map(async (t, i) => {
      const question = questionBefore(turns, i)
      return t.role === 'assistant' && question !== null ? { ...t, sig: await signTurn(secret, question, t.content) } : t
    }),
  )
}
