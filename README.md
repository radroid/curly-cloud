# curlycloud.dev

Raj Dholakia's AI-Engineer resume, with an AI clone of Raj built in.

| Where | What |
|-------|------|
| `/` | The interactive resume. Every line is a source the clone can cite, and cited lines light up. It also has a skill filter, a role-fit check, and setup instructions for agents. |
| `/terminal` | The same information as a shell, which also teaches how a terminal works: commands, variables, quoting, pipes, `learn`. |
| `/mcp` | An MCP server so a company's agent can interview the clone and assess fit (`ask_raj`, `assess_fit`, `get_profile`, `get_resume`, `list_topics`). |
| `/llms.txt` | A plain-text brief for agents. |
| `/studio` | Raj's private back office: knowledge, conversations and corrections, API keys, playground, persona. |
| `/mac` | The 1984 Macintosh version of the site. |
| `interview/raj-interview.html` | An offline, HyperCard-style interview stack Raj uses to feed the clone. |

Read [`CLONE-PLAN.md`](CLONE-PLAN.md) for the architecture, privacy model and API contracts, and [`CLAUDE.md`](CLAUDE.md) for working conventions.

## How the clone works

```
resume lines (public) ─┐
                       ├─ D1: sources → chunks → FTS5 + bge-m3 vectors
interview answers ─────┘   (private: never in git, never returned verbatim)

question → BM25 ∥ dense → RRF → rerank → numbered sources
         → Claude (or Workers AI) answers in first person, citing [n]
         → server validates citations, verbatim guard, rate limits, token budget, PII-safe logs
```

## Develop

```bash
bun install
cp .dev.vars.example .dev.vars   # fill ADMIN_PASSWORD, ADMIN_TOKEN, SESSION_SECRET
bunx wrangler login              # Workers AI runs remotely, even in dev
bun run db:migrate:local
bun run dev                      # http://localhost:3000
bun run clone:seed               # load the resume into the knowledge base
```

Checks: `bun run typecheck`, `bun run test`, `bun run clone:eval`.

## Feed the clone

1. Open `interview/raj-interview.html` in a browser and answer cards. Everything saves locally.
2. Click **Export**. You get `raj-clone-answers-YYYY-MM-DD.json` in Downloads.
3. Ask Claude Code in this repo to *"ingest my answers"*. The `ingest-answers` skill:
   - moves the file into `private/answers/` (gitignored)
   - loads it
   - rebuilds the persona
   - spot-checks the clone
   - writes a follow-up question pack you can import back into the stack

Manual equivalent:

```bash
bun run clone:ingest private/answers/raj-clone-answers-2026-09-25.json
bun run clone:persona
bun run clone ask "What do you refuse to compromise on?"
```

Commands default to `CLONE_URL=http://localhost:3000`.

## Deploy (Cloudflare Workers via OpenNext)

One-time setup:

```bash
bunx wrangler login
bunx wrangler d1 create raj-clone             # paste the database_id into wrangler.jsonc
bun run db:migrate:remote
bunx wrangler secret put ADMIN_PASSWORD
bunx wrangler secret put ADMIN_TOKEN
bunx wrangler secret put SESSION_SECRET
bunx wrangler secret put ANTHROPIC_API_KEY    # optional: answers with Claude instead of Workers AI
```

Each release:

```bash
bun run deploy
CLONE_URL=https://curlycloud.dev ADMIN_TOKEN=… bun run clone:seed
CLONE_URL=https://curlycloud.dev ADMIN_TOKEN=… bun run clone:ingest private/answers/<file>.json
CLONE_URL=https://curlycloud.dev ADMIN_TOKEN=… bun run clone:persona
```

Recommended: put `/studio*` and `/api/admin/*` behind **Cloudflare Access** as a second lock on top of the studio passphrase.

Cost controls are set in `wrangler.jsonc` vars: `CHAT_PER_HOUR`, `CHAT_PER_DAY`, `FIT_PER_DAY`, `FIT_GLOBAL_PER_DAY`, `MCP_ANON_PER_DAY`, `DAILY_TOKEN_BUDGET`. Studio logout signs out every session. Set `MCP_REQUIRE_KEY=true` to turn off anonymous MCP access.
