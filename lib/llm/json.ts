/** Helpers for JSON-mode generation shared by both providers. */
import { z } from 'zod'

/** JSON Schema for a zod schema, without the `$schema` marker some providers reject. */
export function jsonSchemaFor(schema: z.ZodType): Record<string, unknown> {
  const out = z.toJSONSchema(schema, { unrepresentable: 'any' }) as Record<string, unknown>
  delete out.$schema
  return out
}

/**
 * Pull a JSON value out of model output: an already-parsed object, a bare JSON string, or JSON
 * wrapped in prose / a ``` fence. Returns undefined when nothing parses.
 */
export function extractJson(value: unknown): unknown {
  if (value && typeof value === 'object') return value
  if (typeof value !== 'string') return undefined
  const text = value.trim()
  const attempts: string[] = [text]
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) attempts.push(fence[1].trim())
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end > start) attempts.push(text.slice(start, end + 1))
  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate)
    } catch {
      // try the next shape
    }
  }
  return undefined
}

/** Compact, model-readable description of why output failed validation. */
export function describeIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 8)
    .map((i) => `${i.path.length ? i.path.join('.') : '(root)'}: ${i.message}`)
    .join('; ')
}
