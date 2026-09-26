/**
 * Test support (imported by *.test.ts only): an AppEnv backed by node:sqlite D1 and the
 * deterministic fake Workers AI binding.
 */
import type { AppEnv } from '@/lib/env'
import { createFakeAi, type FakeAi, type FakeAiOptions } from '@/lib/llm/fake'
import type { SourceInput } from '@/lib/rag/types'
import { createTestD1 } from '@/test/helpers/d1'

export type TestEnv = AppEnv & { AI: FakeAi; DB: ReturnType<typeof createTestD1> }

export const TEST_ADMIN_TOKEN = 'test-admin-token'

export function createTestEnv(ai: FakeAiOptions = {}, vars: Record<string, string> = {}): TestEnv {
  return {
    DB: createTestD1(),
    AI: createFakeAi(ai),
    EMBEDDING_MODEL: '@cf/baai/bge-m3',
    RERANK_MODEL: '@cf/baai/bge-reranker-base',
    ANTHROPIC_MODEL: 'claude-opus-5',
    WORKERS_AI_CHAT_MODEL: '@cf/meta/llama-4-scout-17b-16e-instruct',
    CHAT_PER_HOUR: '30',
    CHAT_PER_DAY: '120',
    FIT_PER_DAY: '10',
    MCP_ANON_PER_DAY: '40',
    DAILY_TOKEN_BUDGET: '3000000',
    MCP_REQUIRE_KEY: 'false',
    ADMIN_TOKEN: TEST_ADMIN_TOKEN,
    ADMIN_PASSWORD: 'test-password',
    SESSION_SECRET: 'test-session-secret',
    ...vars,
  } as unknown as TestEnv
}

/** Same env (same DB and AI), different vars. Vars are typed as literals by wrangler, hence the cast. */
export function withVars(env: TestEnv, vars: Record<string, string>): TestEnv {
  return { ...env, ...vars } as unknown as TestEnv
}

/** Clearly fake private answers used across tests. */
export const FAKE_PRIVATE: SourceInput[] = [
  {
    id: 'interview:engineering-001',
    kind: 'interview',
    visibility: 'private',
    title: 'How do you approach debugging a flaky production issue?',
    topic: 'engineering',
    body: 'My favourite debugging approach is to write down the smallest reproduction before touching any code, then bisect the change history until the flaky behaviour flips, because guessing wastes whole afternoons and a written repro keeps me honest about what I actually know.',
  },
  {
    id: 'interview:work-style-001',
    kind: 'interview',
    visibility: 'private',
    title: 'What kind of team do you do your best work in?',
    topic: 'work-style',
    body: 'I do my best work in small teams that write things down, argue about trade-offs early and then commit, with long blocks of focus time and very few status meetings.',
  },
]
