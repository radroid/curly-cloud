import { seedPublicSources } from '@/lib/rag'
import { adminHandler } from '@/lib/rag/http'
import { jsonResponse } from '@/lib/security'

export const dynamic = 'force-dynamic'

/** Seed/refresh the public resume sources (replaceKind 'resume'). → IngestResult */
export const POST = adminHandler(async (_request, env) => jsonResponse(await seedPublicSources(env)))
