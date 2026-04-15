# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun run dev          # Start development server
bun run build        # Build for production (Next.js)
bun run cloud-build  # Build for Cloudflare (OpenNext)
bun run preview      # Build and preview Cloudflare deployment locally
bun run deploy       # Build and deploy to Cloudflare Pages
```

### Dev server is always running
Assume `bun run dev` is already running in another terminal. Do **not** start it yourself. If you need to verify changes, ask the user to check in the browser, or use `bunx tsc --noEmit` for a type-only check.

## Architecture

This is a minimal "coming soon" portfolio site themed after **Mac OS System 1 (1984)**. It has a single page with two states:

1. **Boot Sequence** — CRT flicker → Happy Mac icon on dithered gray background with startup sound. Stored in `sessionStorage` so it only plays once per session.
2. **Welcome Screen** — "Welcome to Macintosh." dialog on a dithered gray desktop background with a decorative menu bar.

### Key Files
- `app/page.tsx` — Client component with `BootScreen` and `WelcomeScreen` components
- `app/global.css` — Mac OS 1984 theme (Chicago font, crosshatch pattern, dialog/menu styles)
- `app/layout.tsx` — Minimal root layout with JetBrains Mono font
- `app/lib/use-reduced-motion.ts` — Accessibility hook for animation preferences
- `app/lib/utils.ts` — `cn()` utility (clsx + tailwind-merge)
- `app/not-found.tsx` — Mac-style "system error" 404 page

### Content Archive
All previous site content (projects, blog posts, timeline, skills) is preserved in `CONTENT-ARCHIVE.md` at the project root.

### Implementation Plan
The full desktop experience implementation plan is in `DESKTOP-PLAN.md` at the project root. Reference this file when creating plans, working on implementation, or briefing subagents. It contains all design decisions, architecture details, git/PR strategy, subagent contracts, and a progress tracker.

## Code Style

### Collocate Everything
Keep styles, logic, and UI together. Uses Tailwind CSS for utility classes and inline `style` attributes for Mac OS theme values.

### No Separate CSS Files
The only CSS file is `app/global.css` which defines the Mac OS 1984 theme variables, crosshatch pattern, and shared styles (dialog, menu bar). Don't add component-specific CSS there.

## Common Mistakes & Traps

### Tailwind v4 Alpha — No Config File
This project uses **Tailwind CSS v4 alpha** with `@tailwindcss/postcss`. There is **no `tailwind.config.ts`**. Do not create one. The CSS uses `@import 'tailwindcss'`.

### Mac OS 1984 Theme — Single Theme, No Switching
There is only one theme. CSS variables use standard hex values (not RGB triplets). There are no `data-theme` attributes, no theme switcher, no localStorage theme state.

### Chicago Bitmap Font
The site uses ChicagoFLF (`public/fonts/ChicagoFLF.woff`) for the Mac OS look. `--font-chicago` falls back to VT323 then monospace. Anti-aliasing is disabled (`-webkit-font-smoothing: none`) to preserve the bitmap aesthetic.

### Two Wrangler Configs
Both `wrangler.toml` and `wrangler.jsonc` exist at the root with identical settings. Edit both or consolidate.

### No Test Framework
There are no tests, no test runner, no test dependencies. Do not assume you can validate changes with automated tests.

### TypeScript Is `strict: false` with `strictNullChecks: true`
This unusual combo means no `noImplicitAny`, no strict property initialization, but null checks are enforced.

### Hooks Live in `app/lib/`
Custom hooks live in `app/lib/`, not `app/hooks/`.
