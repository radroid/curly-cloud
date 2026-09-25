import type { AnswerEvent } from '@/lib/rag/types'

/**
 * Server side: turn an async iterable of events into a text/event-stream Response.
 * Each event is written as `event: <type>\ndata: <json>\n\n`.
 */
export function sseResponse(events: AsyncIterable<AnswerEvent>, init: ResponseInit = {}): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of events) {
          controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`))
        }
      } catch (err) {
        const event: AnswerEvent = { type: 'error', code: 'internal', message: 'The clone hit an error. Try again.' }
        controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify(event)}\n\n`))
        console.error('sse stream failed', err)
      } finally {
        controller.close()
      }
    },
  })
  const headers = new Headers(init.headers)
  headers.set('content-type', 'text/event-stream; charset=utf-8')
  headers.set('cache-control', 'no-store, no-transform')
  headers.set('x-accel-buffering', 'no')
  return new Response(stream, { ...init, headers })
}

/**
 * Client side: POST to an SSE endpoint and yield parsed events.
 * Non-2xx JSON errors become a single `error` event so callers handle one shape.
 */
export async function* streamAnswer(
  url: string,
  body: unknown,
  signal?: AbortSignal,
): AsyncGenerator<AnswerEvent> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok || !res.body) {
    let message = 'The clone is unavailable right now.'
    let code: Extract<AnswerEvent, { type: 'error' }>['code'] = 'unavailable'
    try {
      const data = (await res.json()) as { error?: { code?: string; message?: string } }
      if (data.error?.message) message = data.error.message
      if (data.error?.code === 'rate_limited' || data.error?.code === 'budget_exceeded' || data.error?.code === 'bad_request') {
        code = data.error.code
      }
    } catch {
      // Non-JSON error body; keep the generic message.
    }
    yield { type: 'error', code, message }
    return
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += value
    let sep: number
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, sep)
      buffer = buffer.slice(sep + 2)
      const data = raw
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trimStart())
        .join('\n')
      if (!data) continue
      try {
        yield JSON.parse(data) as AnswerEvent
      } catch {
        // Ignore malformed frames rather than killing the stream.
      }
    }
  }
}

/** Split answer text into plain text and citation markers, e.g. "I built it [2]." */
export function splitCitations(text: string): ({ type: 'text'; text: string } | { type: 'cite'; n: number })[] {
  const parts: ({ type: 'text'; text: string } | { type: 'cite'; n: number })[] = []
  const re = /\[(\d{1,2})\]/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ type: 'text', text: text.slice(last, m.index) })
    parts.push({ type: 'cite', n: Number(m[1]) })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ type: 'text', text: text.slice(last) })
  return parts
}
