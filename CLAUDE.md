# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Start development server
pnpm build        # Build for production (Next.js)
pnpm cloud-build  # Build for Cloudflare (OpenNext)
pnpm preview      # Build and preview Cloudflare deployment locally
pnpm deploy       # Build and deploy to Cloudflare Pages
```

## Code Style (Theo-Inspired AI Guidelines)

### Collocate Everything

Keep styles, logic, and UI together. This codebase uses Tailwind CSS exclusively—never create separate CSS files. All styling context should be in the same file as the component.

### Type Safety as Feedback Loop

TypeScript provides immediate feedback when something breaks. When modifying API boundaries or data structures, rely on the type system to surface cascading changes. The `PortfolioProject` interface in `app/lib/projects.ts` is the contract for project data.

### Explicit Return Types for Complex Functions

For utility functions and API routes, prefer explicit return types so the code is self-documenting without needing IDE hover. Simple component functions can rely on inference.

### Search Before Reading

When exploring unfamiliar areas of the codebase, search for specific entry points (function names, component names, route patterns) rather than reading entire directories. Start from the specific and expand outward.

### No Separate CSS Files

All styling uses Tailwind classes inline. The only CSS file is `app/global.css` which defines CSS custom properties for themes and prose styling—don't add component-specific CSS there.

## Common Mistakes & Traps

This section documents real pitfalls in the codebase. If you encounter something surprising not listed here, alert the developer and add it.

### Tailwind v4 Alpha — No Config File

This project uses **Tailwind CSS v4 alpha** with `@tailwindcss/postcss`. There is **no `tailwind.config.ts`**. Do not create one. The CSS uses `@import 'tailwindcss'` (not `@tailwind base/components/utilities`). PostCSS is configured with `@tailwindcss/postcss` (not `tailwindcss`). All Tailwind v3 patterns (theme extensions in config, `@apply` with v3 syntax) will break.

### Theme Colors Are RGB Triplets — Not `hsl()` or Hex

CSS variables in `global.css` store **space-separated RGB triplets** without wrappers:
```css
--background: 224 242 254;
--foreground: 15 23 42;
```
They are consumed as `rgb(var(--background))` in inline `style` attributes. Writing `hsl()` values or hex codes into these variables will break every themed element. There are **no Tailwind color tokens** (`text-foreground`, `bg-card`, etc.) — all theme-aware colors must use inline styles with `rgb(var(--variable))`.

### Blog Posts Require Manual Registration

The blog does **not** use `@next/mdx` or auto-discover `.mdx` files. Posts are loaded as raw text via a custom webpack rule (`?raw` suffix). Adding a new post requires three steps in `app/blog/posts/index.ts`:
1. Create the `.mdx` file
2. Add an `import` with the `?raw` suffix
3. Add an entry to the `posts` array with the slug

### Client vs Server Component Boundaries

- `app/page.tsx` (home) and `app/history/page.tsx` are **client components** (`'use client'`).
- `app/blog/[slug]/page.tsx` and `app/projects/[slug]/page.tsx` are **server components** (no directive).

Do not add React hooks to server component files or `async`/server-only imports to client component files.

### Import Path Styles Are Split by Area

Two import styles coexist. Match the convention of the file you're editing:
- **Blog files** (`app/blog/`, `app/components/mdx.tsx`, `app/components/posts.tsx`): bare paths like `import { formatDate } from 'app/blog/utils'`
- **Everything else**: alias paths like `import { getProject } from '@/app/lib/projects'`

Both resolve correctly (`baseUrl: "."` + `paths: { "@/*": ["./*"] }`), but mixing styles within a file is inconsistent.

### Dual Theme Controllers

Two sibling components in the root layout both call `applyTheme()`:
- `ThemeProvider` (auto time-of-day, runs on mount)
- `ThemeSwitcher` (manual override, reads `localStorage`)

Both contain their own copy of `getThemeForTime()`. If time boundaries change, update both `theme-provider.tsx` and `theme-switcher.tsx`. The switcher's double-click-to-reset-auto behavior is undocumented in the UI.

### Hooks Live in `app/lib/`, Not `app/hooks/`

Despite `components.json` aliasing hooks to `@/app/hooks`, **that directory does not exist**. Custom hooks (`use-reduced-motion.ts`, `use-location.ts`) live in `app/lib/`. Running `shadcn add` for components that generate hooks may create a stale `app/hooks/` directory.

### Two Wrangler Configs

Both `wrangler.toml` and `wrangler.jsonc` exist at the root with identical settings. Edit both or consolidate — changing only one creates silent drift.

### No Test Framework

There are no tests, no test runner, no test dependencies. `pnpm test` does not exist. Do not assume you can validate changes with automated tests.

### TypeScript Is `strict: false` with `strictNullChecks: true`

This unusual combo means no `noImplicitAny`, no strict property initialization, but null checks are enforced. Don't over-type code assuming full strict mode, but do handle `null`/`undefined`.
