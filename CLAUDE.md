# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

curlycloud.dev: Raj Dholakia's interactive AI-Engineer resume, an AI clone of Raj that answers in his
voice with citations (RAG), a terminal mode, an MCP server for visiting agents, a private studio, and an
offline interview stack Raj uses to feed the clone. The 1984 Mac desktop lives on at `/mac`.

**Read `CLONE-PLAN.md` first.** It holds the architecture, privacy model, contracts and module ownership.

## Commands

```bash
bun run dev              # Next dev server with Cloudflare bindings (D1 local, Workers AI remote)
bun run test             # Vitest (D1 emulated with node:sqlite)
bun run typecheck        # tsc --noEmit
bun run preview          # OpenNext build + wrangler dev (closest to production)
bun run deploy           # Build and deploy to Cloudflare
bun run db:migrate:local # Apply migrations/ to the local D1
bun run cf-typegen       # Regenerate cloudflare-env.d.ts after editing wrangler.jsonc
bun run clone:seed       # Load the public resume into the knowledge base
bun run clone:ingest <file.json>   # Ingest answers exported from interview/raj-interview.html
bun run clone:persona    # Rebuild the distilled persona after a batch of answers
bun run clone:eval       # Retrieval + answer evals
```

### Dev server is usually running
Raj keeps `bun run dev` running in another terminal. Don't start a second one on port 3000. For an
isolated end-to-end check use `bun run preview` on another port, and stop it when done.

## Layout

- `app/` — routes. `page.tsx` is the resume site, `terminal/`, `studio/`, `mac/`, `api/` (chat, fit, mcp, admin, auth).
- `lib/` — server and shared modules: `rag/`, `llm/`, `mcp/`, `auth/`, `security/`, `db/`, `shell/`, `client/`.
- `content/` — public data: `resume.ts` (single source for site, terminal, MCP, public corpus), `topics.ts`, `questions/`.
- `interview/raj-interview.html` — standalone interview stack. Answers export to `private/` (gitignored).
- `migrations/` — D1 schema. `test/helpers/d1.ts` runs the same SQL in tests.

## Privacy rules (don't break these)

- Raj's interview answers, notes and corrections are private. They live only in D1 and `private/`.
  Never commit them, never put them in client bundles, never return raw private text from a public route.
- Public routes return generated answers plus citation labels. Snippets only for public sources.
- New routes under `/api/admin` must call `requireAdmin` first.

## Code style

- Collocate: Tailwind classes inline; `app/global.css` holds only design tokens (`@theme`), base styles and the scoped Mac theme.
- Use the design tokens (`bg-paper`, `text-ink`, `text-forest`, `bg-term-bg`, `font-mono`) — no ad-hoc hex in components.
- Explicit return types on server functions and route helpers.
- Raw SQL through `lib/db` helpers; no ORM.
- Hooks live in `app/lib/`.

## Traps

- **TypeScript is `strict: false` + `strictNullChecks: true`.** `const xs = []` infers `never[]` — annotate empty arrays.
- **Tailwind v4 (stable), no config file.** Tokens live in `@theme` in `app/global.css`.
- **Workers AI is always remote**, even in dev. It needs `wrangler login` and costs neurons.
- **`database_id` in wrangler.jsonc is a placeholder** until `wrangler d1 create raj-clone` is run for production.
- **Bindings in route handlers** come from `getAppEnv()` (`lib/env.ts`), not `process.env`.
- **Mac theme is scoped** to `.mac-root` (set by `app/mac/layout.tsx`). Don't style `body` for it.
