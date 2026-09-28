# Raj Clone — Implementation Plan

> Persistent plan for the curlycloud.dev rebuild: an interactive AI-Engineer resume, an AI clone of Raj
> that answers in his voice with citations, a terminal mode, an MCP server for visiting agents, a
> private studio, and an offline interview stack for feeding the clone. Humans and agents working in
> this repo should treat this file as the source of truth. Update it when a decision changes.

## 1. Deliverables

| # | Deliverable | Where |
|---|-------------|-------|
| D1 | Interactive resume website (human view) with the clone embedded | `/` |
| D2 | The clone: RAG over public resume + private interview answers, answers in first person, cites sources | `lib/rag`, `/api/chat` |
| D3 | MCP server for agents: ask, profile, resume, fit assessment, topics | `/mcp` (alias of `/api/mcp`) |
| D4 | Terminal mode (switchable from the top bar) that teaches shell commands and variables | `/terminal`, `lib/shell` |
| D5 | Private studio: knowledge, conversation logs, corrections, API keys, playground, persona | `/studio` |
| D6 | Offline interview stack (fun, standalone HTML) that exports answers for an agent to ingest | `interview/raj-interview.html` |
| D7 | Ingest pipeline + repo skill so an agent can load exported answers | `scripts/clone.ts`, `.claude/skills/ingest-answers` |
| D8 | Evals: retrieval hit@k/MRR, answer faithfulness, refusal probes | `evals/`, `bun run clone:eval` |
| D9 | The 1984 Mac desktop preserved at `/mac` | `app/mac` |

## 2. Privacy model (non-negotiable)

- Raj's interview answers, notes and corrections are **private sources**. They live only in D1.
  They are never committed to git, never bundled into client JS, never returned verbatim by any
  public endpoint (web, terminal, MCP).
- Public endpoints return **generated answers** plus **citation labels**. For private sources the
  label is the question/topic only; snippets are shown only for public sources (resume, profile).
- A streaming **verbatim guard** holds back output and stops the answer if it reproduces private
  text (private sources, the system prompt with the persona), including disguised copies: filler
  words, separators, spelled-out letters, look-alike characters, leetspeak, base64/hex
  (`lib/rag/guard.ts`). Fit assessments run it over all fields joined. Translation isn't caught.
- Every user turn (and each fit field) goes through the prompt-extraction check
  (`lib/rag/injection.ts`). Replayed assistant turns are trusted only with the server's signature
  (`sig` from `done`, HMAC over the answer text; `lib/rag/turns.ts`).
- Retrieved text is wrapped as untrusted data in the prompt; instructions inside sources are ignored.
- Exported answer files live in `private/` (gitignored). Only the studio (after login) and the admin
  API (bearer `ADMIN_TOKEN`) can read raw private text.
- Visitors see that they're talking to an AI clone and that questions are logged to improve answers.
  Logs store a salted, daily-rotating hash of the IP, never the IP. Emails/phones are redacted.

## 3. Stack & decisions

| Area | Choice | Why |
|------|--------|-----|
| App | Next.js 15 App Router on Cloudflare Workers via OpenNext (existing setup) | Already deployed at curlycloud.dev |
| DB | Cloudflare D1 (SQLite) + FTS5 | Local emulation works out of the box; FTS5 gives BM25 |
| Vectors | Float32 BLOBs in D1, exact cosine in the Worker, cached per isolate by `corpus_version` | Corpus is hundreds to low thousands of chunks; exact search beats ANN at this size. Vectorize is the upgrade path past ~20k chunks |
| Embeddings | Workers AI `@cf/baai/bge-m3` (1024-d) | No extra key; probed and working |
| Rerank | Workers AI `@cf/baai/bge-reranker-base` | Probed and working; optional stage |
| Generation | Anthropic `claude-opus-5` when `ANTHROPIC_API_KEY` is set (server-side refusal fallbacks on); otherwise Workers AI `@cf/meta/llama-4-scout-17b-16e-instruct` | Claude for voice quality; Workers AI so everything runs with zero keys |
| Citations | Numbered `[n]` markers against numbered sources, validated server-side | Provider-agnostic, streams cleanly |
| MCP | `@modelcontextprotocol/sdk` `WebStandardStreamableHTTPServerTransport`, stateless, JSON responses | Official SDK, Workers-compatible |
| Auth (studio) | Passphrase → HMAC-signed HttpOnly cookie; `ADMIN_TOKEN` bearer for CLI | Single owner; no external IdP needed. Cloudflare Access on top in prod (CLI uses a service token) |
| Auth (MCP) | Optional per-company API keys (hashed), anonymous tier with lower limits | Raj can see which company's agent asked what, and revoke |
| Rate limits | Fixed-window counters in D1 + daily token budget | Cost exposure bounded |
| Tests | Vitest; D1 emulated with `node:sqlite` (FTS5 supported) | Real SQL in unit tests |
| Package manager | bun | Existing `bun.lock` |

## 4. Architecture

```
Browser (website / terminal / studio)          Visiting agent (Claude, Cursor…)
   │  POST /api/chat (SSE)  POST /api/fit            │  POST /mcp (JSON-RPC, Streamable HTTP)
   ▼                                                 ▼
Next.js route handlers ── lib/security (rate limit, budget, client id, redact)
   │                         lib/auth (session, admin, api keys)
   ▼
lib/rag ── retrieve (FTS5 BM25 ∥ dense cosine → RRF → rerank) ── lib/llm (anthropic | workers-ai)
   │        prompt (persona + numbered untrusted sources) → stream → verbatim guard → citations
   ▼
D1: sources · chunks · chunks_fts · meta · chat_logs · api_keys · rate_limits · usage_daily
```

### 4.1 Data model — `migrations/0001_init.sql`
- `sources` — one unit of knowledge (resume bullet, profile fact, interview answer, note, correction).
  `id` is stable (`resume:exp:eddy:2`, `interview:principles-004`, `note:<uuid>`), `visibility`
  public|private, `title` is the citation label, `anchor` is the DOM id on the website (public only).
- `chunks` — retrieval units with a contextual header (kind · topic · title) prepended, embedding BLOB.
- `chunks_fts` — FTS5 external-content index over `chunks.text` (porter unicode61), kept in sync by triggers.
- `meta` — `corpus_version` (bumped on every ingest), `persona` (distilled voice/principles profile).
- `chat_logs`, `api_keys`, `rate_limits`, `usage_daily`.

### 4.2 Stream protocol — `POST /api/chat`
Request: `{ messages: {role, content, sig?}[] (≤ 12 turns), channel: 'web' | 'terminal' }`.
Response: `text/event-stream`, events in order:
`sources` → `delta`* → `done` (or `error` at any point). Payload types live in `lib/rag/types.ts`
(`AnswerEvent`). Client parser: `lib/client/sse.ts`. `done.sig` signs the streamed text; clients
send it back as `sig` on that assistant turn, and assistant turns without a valid `sig` are dropped.

### 4.3 Public API surface
| Route | Auth | Purpose |
|-------|------|---------|
| `POST /api/chat` | public, rate limited | Clone answer stream |
| `POST /api/fit` | public, rate limited | Role-fit assessment (JSON) |
| `GET /api/profile` | public | Public profile + resume JSON (same data as `content/resume.ts`) |
| `POST/GET/DELETE /mcp` | anonymous or `Authorization: Bearer rc_…` | MCP |
| `GET /llms.txt` | public | Agent-facing description + MCP instructions |
| `POST /api/auth/login`, `POST /api/auth/logout` | — | Studio session |
| `/api/admin/*` | session cookie or `ADMIN_TOKEN` | Studio + CLI |

Admin routes: `seed`, `ingest`, `sources` (list/get/patch/delete), `notes`, `logs` (list/flag/correct),
`keys` (list/create/revoke), `persona` (get/rebuild), `stats`, `debug/retrieve`, `debug/answer`, `eval/case`.

### 4.4 MCP tools
`ask_raj(question)`, `assess_fit(role_title, job_description, company?, culture_notes?)`,
`get_profile()`, `get_resume(format)`, `list_topics()`. Resource `resume://raj-dholakia/ai-engineer`.
Prompt `evaluate_candidate`. Server `instructions` explain that answers come from Raj's own words,
are AI-generated, and cite sources.

## 5. Module ownership (parallel build)

Contracts are fixed in the foundation commit. Each workstream owns its files and must not edit files
owned by another stream; if a contract needs to change, note it in the stream's final report.

| Stream | Branch | Owns |
|--------|--------|------|
| Foundation | `feat/clone-site` | config, migrations, `lib/env.ts`, `lib/auth/*`, `lib/security/*`, `lib/db/*`, `lib/rag/types.ts`, `lib/client/sse.ts`, `content/resume.ts`, `content/topics.ts`, `test/helpers/*`, `app/mac`, `app/api/health`, design tokens in `app/global.css` |
| RAG | `feat/clone-rag` | `lib/rag/**` (except types.ts), `lib/llm/**`, `app/api/{chat,fit,profile}`, `app/api/admin/{seed,ingest,persona,debug,eval}`, `evals/**`, `scripts/eval.ts` |
| MCP | `feat/clone-mcp` | `lib/mcp/**`, `app/api/mcp/**`, `app/llms.txt/**` |
| Studio | `feat/clone-studio` | `app/studio/**`, `lib/studio/**`, `app/api/auth/**`, `app/api/admin/{sources,logs,keys,stats}` |
| Terminal | `feat/clone-terminal` | `lib/shell/**`, `app/terminal/**` |
| Interview | `feat/clone-interview` | `interview/**`, `content/questions/**`, `lib/interview/**`, `app/api/admin/import`, `scripts/clone.ts`, `scripts/build-interview.ts`, `.claude/skills/ingest-answers/**` |
| Website | `feat/clone-site` (lead) | `app/page.tsx`, `app/components/site/**`, integration of all streams |

The site under `app/components/site/` was rebuilt in the visual refresh (`REDESIGN-PLAN.md`, PRs #11–#18 and
P7). One file per section keeps later changes small:

| File | Section |
|------|---------|
| `site-context.tsx` | Shared state: citations (`focusAnchor`, `data-flash`), skill filter, Ask panel requests, deep links, print |
| `resume.tsx`, `resume-helpers.tsx` | `SectionHeading`, `Bullet`, `Lines`: one citable line per `resumeAnchor` |
| `hero.tsx`, `cloud/*` | Curly-cloud hero: WebGL renderer (loaded with `import()`), sampler, source stars, static poster |
| `profile.tsx`, `numbers.tsx`, `stats.ts` | Path and summary; the six numbers drawn as charts |
| `skills.tsx`, `timeline.tsx`, `timeline-data.ts`, `work.tsx` | Skill lens, swimlane timeline, role rows, study |
| `builds.tsx`, `community.tsx` | Build cards with diagrams; Open Invite |
| `fit-check.tsx`, `agents-section.tsx`, `closing.tsx` | Fit check, MCP setup, how the clone answers, contact, footer |
| `top-bar.tsx`, `dock.tsx`, `boot.tsx`, `marquee.tsx`, `footer-bar.tsx`, `ask-panel.tsx` | Chrome and the Ask panel |

Hooks live in `app/lib/` (`motion.ts` holds the motion tiers and the inline head script).

### 5.1 Admin API contracts (all require `requireAdmin`)

| Route | Body → Response |
|-------|-----------------|
| `POST /api/admin/seed` | — → `IngestResult` (public resume sources, `replaceKind: 'resume'`) |
| `POST /api/admin/ingest` | `{ sources: SourceInput[], replaceKind?: SourceKind }` → `IngestResult` (max 500 sources per call) |
| `POST /api/admin/import` | a `raj-clone-answers` v1 export (from the interview stack) → `{ result: IngestResult, answers: number }`; mapping lives in `lib/interview` |
| `GET /api/admin/persona` | → `{ text, updatedAt } \| null` |
| `POST /api/admin/persona` | — → `{ text, sourcesUsed }` (rebuild) |
| `POST /api/admin/debug/retrieve` | `{ query, k? }` → `{ chunks: RetrievedChunk[] }` |
| `POST /api/admin/debug/answer` | `{ question }` → `Answer` (channel `studio`) |
| `POST /api/admin/eval/case` | `EvalCase` (see `evals/README.md`) → `EvalCaseResult` |
| `GET /api/admin/sources?kind&topic&q&limit&offset` | → `{ items: SourceRecord[], total }` |
| `POST /api/admin/sources` | `{ title, body, topic? }` → `SourceRecord` (creates a private `note:`) |
| `GET/PATCH/DELETE /api/admin/sources/:id` | `PATCH { title?, body?, topic?, visibility? }`; resume sources are read-only |
| `GET /api/admin/logs?channel&flagged&limit&offset` | → `{ items, total }` |
| `GET /api/admin/logs/:id`, `PATCH { flagged }`, `POST { correction }` | correction creates a private `correction:<logId>` source |
| `GET/POST /api/admin/keys`, `DELETE /api/admin/keys/:id` | `POST { label, dailyLimit? }` → `{ token, record }` (token shown once) |
| `GET /api/admin/stats` | → corpus stats + usage today + recent activity |

### 5.2 Local dev ports per worktree

RAG 3201 · MCP 3202 · Studio 3203 · Terminal 3204 · Interview 3205 · Integration 3190.
Raj's own `bun run dev` owns 3000 — never start anything there.

## 6. Configuration

Secrets (`.dev.vars` locally, `wrangler secret put` in prod): `ANTHROPIC_API_KEY` (optional),
`ADMIN_PASSWORD`, `ADMIN_TOKEN`, `SESSION_SECRET`.
Vars (`wrangler.jsonc`): model ids, limits (`CHAT_PER_HOUR`, `CHAT_PER_DAY`, `FIT_PER_DAY` per client,
`FIT_GLOBAL_PER_DAY` across everyone, `MCP_ANON_PER_DAY`, `DAILY_TOKEN_BUDGET`), `MCP_REQUIRE_KEY`.
Per-client limits key on a daily-salted hash of the IP (IPv6 grouped by /64). Web and MCP share the
per-client fit bucket. `/api/chat` and `/api/fit` accept same-origin `application/json` only.

## 7. Status

- [x] Foundation
- [x] RAG core + chat/fit APIs + evals (reranker fused as a third RRF list; see `lib/rag/retrieve.ts`)
- [x] MCP server (+ `/llms.txt`)
- [x] Studio
- [x] Terminal
- [x] Interview stack + ingest skill (211 questions)
- [x] Website
- [x] Integration: typecheck, 609 tests, `next build`, OpenNext build, smoke on `wrangler dev` (chat SSE with signed history, fit, MCP tools, admin auth + session revocation, full evals)
- [x] Visual refresh of `/` (`REDESIGN-PLAN.md`): built in PRs #11–#18 plus the P7 integration PR, into `feat/visual-refresh`

### Next (needs Raj)
- Answer interview cards → `ingest my answers` in Claude Code. The persona builds from them.
- Optional `ANTHROPIC_API_KEY` for Claude-quality voice (Workers AI Llama 4 Scout is the default).
- ~~Production~~ Deployed 2026-09-26: D1 `raj-clone` migrated, secrets set, resume seeded (40 sources), baseline persona built.
- ~~Cloudflare Access~~ On since 2026-09-27 for `/studio*`, `/api/admin/*`, `/api/auth/*`. The CLI sends a service token (`CF_ACCESS_CLIENT_ID`/`CF_ACCESS_CLIENT_SECRET`).

### Latest eval baseline (Workers AI, resume-only corpus, production worker, 2026-09-25)
Retrieval (47 cases incl. answer-case expectations): hit@1 93.6%, hit@3 97.9%, hit@8 100%, MRR 0.961.
Answers 11/11, refusal 10/10, injection 5/5. Re-run after each batch of answers: `bun run clone:eval`.

### Security review (2026-09-25)
An adversarial review found output-guard and input-filter bypasses, per-field fit filtering, and IPv6 /
cross-site limit bypasses. All fixed (`fix/clone-privacy`, `fix/clone-abuse`, question-bound turn
signatures). Accepted residual risks: translation or close paraphrase of private answers, runs under the
guard thresholds (<12 net words, ~72 letters), custom encodings, anonymous MCP quota spend via CORS `*`,
subscribers holding a whole /56-/48 IPv6 block.
