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

## Architecture

This is a personal portfolio and blog built with Next.js 15 (App Router), deployed to Cloudflare Pages via OpenNext.

### Key Directories

- `app/` - Next.js App Router pages and components
- `app/components/` - React components (portfolio carousel, clock, diagnostics, footer, nav)
- `app/components/ui/` - shadcn/ui primitives (button, dialog, carousel, etc.)
- `app/lib/` - Shared utilities and data (projects.ts defines portfolio items, r2-config.ts for video URLs)
- `app/blog/` - Blog system with MDX posts in `app/blog/posts/`

### Data Flow

- `app/lib/projects.ts` - Central source for portfolio projects, imported by page.tsx and project detail pages
- `app/lib/r2-config.ts` - Generates Cloudflare R2 video URLs for portfolio videos
- `app/blog/utils.ts` - Blog post retrieval and date formatting

### Theme System

The site uses a time-of-day theme system (morning/afternoon/night/starry) defined in `app/global.css` with CSS custom properties. Theme switching is handled by `app/components/theme-provider.tsx` and `app/lib/theme-utils.ts`.

### shadcn/ui Configuration

Components configured via `components.json` with aliases:
- `@/app/components` → components
- `@/app/components/ui` → ui
- `@/app/lib` → lib

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
