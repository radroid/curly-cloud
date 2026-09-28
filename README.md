# curlycloud.dev

Raj Dholakia's AI-Engineer resume, with an AI clone of Raj built in.

| Where | What |
|-------|------|
| `/` | The interactive resume. A point-cloud portrait opens it, and each bright point is a source the clone can cite. Numbers are drawn as charts and the work history as a timeline. Every line is a citable source: a citation opens it and lights it up. It also has a skill filter, a role-fit check and setup instructions for agents. Motion comes in High, Medium and Saver tiers and respects reduced motion. |
| `/terminal` | The same information as a shell, which also teaches how a terminal works: commands, variables, quoting, pipes, `learn`. |
| `/mcp` | An MCP server so a company's agent can interview the clone and assess fit (`ask_raj`, `assess_fit`, `get_profile`, `get_resume`, `list_topics`). |
| `/llms.txt` | A plain-text brief for agents. |
| `/studio` | Raj's private back office: knowledge, conversations and corrections, API keys, playground, persona. |
| `/mac` | The 1984 Macintosh version of the site. |
| `interview/raj-interview.html` | An offline, HyperCard-style interview stack Raj uses to feed the clone. |

Read [`CLONE-PLAN.md`](CLONE-PLAN.md) for the architecture, privacy model and API contracts, [`REDESIGN-PLAN.md`](REDESIGN-PLAN.md) for the design of `/`, and [`CLAUDE.md`](CLAUDE.md) for working conventions.

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
bun run clone:persona --yes
bun run clone ask "What do you refuse to compromise on?"
```

Commands default to `CLONE_URL=http://localhost:3000`.

## Deploy (Cloudflare Workers via OpenNext)

One-time setup (done for curlycloud.dev on 2026-09-26; needed again only for a fresh account):

```bash
bunx wrangler login
bunx wrangler d1 create raj-clone             # paste the database_id into wrangler.jsonc
bun run db:migrate:remote
bunx wrangler secret put ADMIN_PASSWORD
bunx wrangler secret put ADMIN_TOKEN
bunx wrangler secret put SESSION_SECRET
bunx wrangler secret put ANTHROPIC_API_KEY    # optional: answers with Claude instead of Workers AI
```

Each release (production sits behind Cloudflare Access, so the CLI also needs the `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` service token; Bun loads them from `.env.local`):

```bash
bun run deploy
CLONE_URL=https://curlycloud.dev ADMIN_TOKEN=… bun run clone:seed --yes
CLONE_URL=https://curlycloud.dev ADMIN_TOKEN=… bun run clone:ingest private/answers/<file>.json --yes
CLONE_URL=https://curlycloud.dev ADMIN_TOKEN=… bun run clone:persona --yes
```

**Cloudflare Access** guards `/studio*`, `/api/admin/*` and `/api/auth/*` as a second lock on top of the studio passphrase: browsers sign in with an emailed code, and the CLI uses a service token allowed by a Service Auth policy. The `workers.dev` and preview URLs are off (`wrangler.jsonc`), so `curlycloud.dev` is the only way in.

Cost controls are set in `wrangler.jsonc` vars: `CHAT_PER_HOUR`, `CHAT_PER_DAY`, `FIT_PER_DAY`, `FIT_GLOBAL_PER_DAY`, `MCP_ANON_PER_DAY`, `DAILY_TOKEN_BUDGET`. Studio logout signs out every session. Set `MCP_REQUIRE_KEY=true` to turn off anonymous MCP access.
