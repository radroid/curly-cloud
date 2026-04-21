# curlycloud.dev

A Mac OS System 1 (1984) themed "coming soon" site for [curlycloud.dev](https://curlycloud.dev).

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS v4 alpha
- Chicago bitmap font (`public/fonts/ChicagoFLF.woff`)
- Deployed to Cloudflare Pages via OpenNext

## Develop

```bash
bun install
bun run dev      # http://localhost:3000
```

## Build & deploy

```bash
bun run build    # Next.js production build
bun run deploy   # OpenNext → Cloudflare Pages
```

See `CLAUDE.md` for architecture notes and `DESKTOP-PLAN.md` for the full implementation plan.
