# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

curlycloud.dev: Raj Dholakia's interactive AI-Engineer resume, an AI clone of Raj that answers in his
voice with citations (RAG), a terminal mode, an MCP server for visiting agents, a private studio, and an
offline interview stack Raj uses to feed the clone. The 1984 Mac desktop lives on at `/mac`.

**Read `CLONE-PLAN.md` first.** It holds the architecture, privacy model, contracts and module ownership.
`REDESIGN-PLAN.md` records the design of `/` (the curly-cloud hero, motion tiers, how citations open lines).

## Commands

```bash
bun run dev              # Next dev server with Cloudflare bindings (D1 local, Workers AI remote)
bun run test             # Vitest (D1 emulated with node:sqlite)
bun run typecheck        # tsc --noEmit
bun run preview          # OpenNext build + wrangler dev (closest to production)
bun run deploy           # Build and deploy to Cloudflare (curlycloud.dev, live)
bun run db:migrate:local # Apply migrations/ to the local D1
bun run cf-typegen       # Regenerate cloudflare-env.d.ts after editing wrangler.jsonc
bun run clone:seed       # Load the public resume into the knowledge base
bun run clone:ingest <file.json>   # Ingest answers exported from interview/raj-interview.html
bun run clone:persona    # Rebuild the distilled persona after a batch of answers
bun run clone:eval       # Retrieval + answer evals (--only retrieval is cheap; --no-rerank to A/B)
bun run clone ask "…"    # Spot-check the clone (admin debug route)
bun run clone validate <file|dir>   # Check an answers export or question pack without a server
bun scripts/build-interview.ts      # Rebuild interview/raj-interview.html after editing content/questions or interview/src
```

CLI commands target `CLONE_URL` (default `http://localhost:3000`) with `ADMIN_TOKEN` from `.dev.vars`.
Writes to a non-local `CLONE_URL` require `--yes`. Production is behind Cloudflare Access, so the CLI also needs
`CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` (a service token; Bun loads them from `.env.local`).

### Dev server is usually running
Raj keeps `bun run dev` running in another terminal. Don't start a second one on port 3000. For an
isolated end-to-end check use `bun run preview` on another port, and stop it when done.

## Layout

- `app/` — routes. `page.tsx` is the resume site, `terminal/`, `studio/`, `mac/`, `api/` (chat, fit, mcp, admin, auth).
- `app/components/site/` — one file per section of `/` (`hero.tsx` + `cloud/`, `profile`, `numbers`, `work`, `builds`, …), plus `site-context.tsx` (citations, skill filter, the Ask panel) and the chrome (`top-bar`, `dock`, `boot`, `footer-bar`).
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
- **Production D1 is `raj-clone`** (`database_id` in wrangler.jsonc). `bun run db:migrate:remote` changes the live database; new migrations must be additive.
- **Bindings in route handlers** come from `getAppEnv()` (`lib/env.ts`), not `process.env`.
- **`interview/raj-interview.html` is generated.** Edit `content/questions/` or `interview/src/`, then rebuild; a test fails if the committed HTML is stale. Shared export/XP logic lives in `lib/interview/core.ts` (compiled into the page).
- **Stale `.next/types` after merging routes.** With a dev server running, `tsc` can report unknown routes until the dev server compiles them. Hit the route once or delete `.next/types`.
- **Worker size.** The OpenNext bundle is ~2.3 MiB gzipped (free plan limit 3 MiB). Check `bunx wrangler deploy --dry-run` before adding heavy dependencies.
- **Replayed assistant turns need their `sig`.** The clone drops assistant turns without the signature from that answer's `done` event (`lib/rag/turns.ts`), so a test or eval history with plain assistant turns loses them silently. Sign admin-trusted histories with `signTurns`.
- **Rerank is a vote, not a verdict.** `bge-reranker-base` scores long chunks near zero; it's fused into RRF with BM25 and dense. Keep it that way unless evals say otherwise.
- **Mac theme is scoped** to `.mac-root` (set by `app/mac/layout.tsx`). Don't style `body` for it.
- **Motion has tiers.** `BOOT_SCRIPT` (`app/lib/motion.ts`, inlined in `<head>`) sets `html[data-motion]` (`high`, `medium`, `saver`) and `data-boot` before first paint. For "no motion" styles use the `still:` variant (Saver, or reduced motion unless the visitor picked a tier), and `motionOff()` in scripts. Don't check `prefers-reduced-motion` on its own.
- **Every resume line renders exactly once**, under its `resumeAnchor` id (`anchors.test.ts`). Jump to one with `focusAnchor` (`site-context.tsx`): it opens ancestor `<details>` and `data-opens` targets, scrolls, then sets `data-flash`. Anything collapsible that can hide a line must be a `<details>` or declare `data-opens`.
- **Every number on `/` comes from `content/resume.ts`.** The stats, numbers, work, builds and community tests fail if a figure on screen isn't in the resume. Change the resume (with Raj's approval), not the component.
- **Print.** `beforeprint` opens every `<details>`. Browsers drop background colours, so a dark block needs `print:bg-transparent print:text-ink` (or `print-color-adjust: exact` for a chart).
- **Anton is loaded in `app/page.tsx` only** (on its wrapper `div`), so `/terminal` and `/mac` don't download it. `type-display` works only inside that wrapper; elsewhere `--font-anton` is unset and the text inherits the body font.
- **Keep heavy client code behind `import()`.** The hero's WebGL renderer (`cloud/renderer.ts`) loads in an effect and links its shaders with `KHR_parallel_shader_compile`, yielding between steps; a synchronous link cost a 500 ms long task.
- **Vitest renders TSX via `oxc.jsx.runtime: 'automatic'`** (`vitest.config.mts`), because tsconfig keeps `jsx: preserve`.
- **The global focus ring is in `@layer base`**, so a component's `outline-none` (with its own border or ring) wins.
