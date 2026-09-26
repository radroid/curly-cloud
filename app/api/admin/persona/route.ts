import { getPersona, rebuildPersona } from '@/lib/rag'
import { adminHandler } from '@/lib/rag/http'
import { jsonResponse } from '@/lib/security'

export const dynamic = 'force-dynamic'

/** → `{ text, updatedAt } | null` */
export const GET = adminHandler(async (_request, env) => jsonResponse(await getPersona(env)))

/** Rebuild the persona from private answers. → `{ text, sourcesUsed }` */
export const POST = adminHandler(async (_request, env) => jsonResponse(await rebuildPersona(env)))
