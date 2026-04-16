# Mac OS 1984 Desktop — Implementation Plan

> Persistent plan document for the full desktop experience rebuild.
> Both human and Claude should reference this when planning or implementing.
> Mobile experience planned separately in `MOBILE-PLAN.md`.

---

## Table of Contents

1. [Vision](#vision)
2. [Design Decisions](#design-decisions)
3. [Architecture](#architecture)
4. [Applications](#applications)
5. [Git & PR Strategy](#git--pr-strategy)
6. [Implementation Phases](#implementation-phases)
7. [Subagent Contracts](#subagent-contracts)
8. [Inspiration & Anti-patterns from PostHog](#inspiration--anti-patterns-from-posthog)
9. [Progress Tracker](#progress-tracker)
10. [Readiness Checklist](#readiness-checklist)

---

## Vision

Transform the "coming soon" welcome screen into a fully interactive Mac OS 1984 desktop. The iMac G3 frame contains a working operating system with draggable windows, functional applications, and a dynamic menu bar. Visitors explore the portfolio by using apps — not by scrolling a page.

**Current flow:** Boot sequence → Welcome dialog ("Welcome to Macintosh / Curly")
**Target flow:** Boot sequence → Welcome dialog ("Welcome to Macintosh / Curly") (without menu bar) → Desktop with app icons → Open/close/drag windows with real apps

---

## Design Decisions

| # | Decision | Choice | Notes |
|---|----------|--------|-------|
| 1 | Mobile experience | Keep current welcome screen on mobile. iPhone-style experience is a separate future project. | Desktop OS is desktop-only. |
| 2 | Draggable windows | Yes — drag via title bar, mouse only | No touch drag (desktop-only). No resize. |
| 3 | Window behavior | Click-to-focus, cascaded open positions, close box top-left | Mac OS 1 style. Responsive size per app. |
| 4 | Maximize mode | Button on iMac chin only (no menu bar option) | `isMaximized` state lives in `page.tsx`, passed as props. CRTScreen stays mounted; iMac frame (body/chin/stand) hides. Screen area fills viewport. |
| 5 | Maximize nudge | Subtle Mac-style dialog after first app open | "Tip: Use Full Screen for more space" |
| 6 | Menu bar | Dynamic — updates based on active/focused app | Apple icon menu (About) always left. Default = Finder menus (File/Edit/View/Special). Apps override via registry. |
| 7 | Blog posts | Scrapbook app (period-accurate Mac OS app) | 3 posts from CONTENT-ARCHIVE.md |
| 8 | World map style | Risk-style dithered map with pattern fills | Reference image is style guide only; travel data TBD — subagent asks user. |
| 9 | Extra apps | Music/interests-based (details TBD) | Build shell with mock data; subagent asks user for real content. |
| 10 | Icon art | User-provided 1-bit pixel art SVGs | User creates icons and adds to a folder. No external icon library. Match Mac OS 1 aesthetic. |
| 11 | Trash icon | Clickable — opens a placeholder window (bottom-right corner, outside the main icon grid) | Registered as a real app in the registry. Not functional beyond opening for now. |
| 12 | Window sizing | Container query units (`cqw`/`cqh`) with `clamp()` bounds | CRT screen is the CSS container. Windows scale proportionally on maximize. |
| 13 | Desktop icons | Single click selects (highlight), double-click opens | Mac OS style selection model. |
| 14 | Screen phases | `off → flicker → boot → welcome → desktop` | Welcome screen (no menu bar) shows briefly after boot, then transitions to desktop. |
| 15 | App registry | "Coming Soon" placeholder for unbuilt apps | Apps register real components when built. Registry also defines per-app menu bar actions. |

---

## Architecture

### Desktop Shell
- Replaces `WelcomeScreen` on desktop viewports after boot
- Crosshatch/dithered gray background (Mac OS 1984 pattern, already in `global.css`)
- Grid of app icons (classic Finder-style)
- Decorative Trash icon bottom-right
- Menu bar at top — dynamic per focused app

### Window Manager (React Context)
```typescript
type Rect = { x: number; y: number; width: number; height: number } // px relative to CRT screen (the drag container)

type WindowState = {
  appId: string
  position: { x: number; y: number }  // percentage of container (0–1), e.g. { x: 0.15, y: 0.20 }
  zIndex: number                      // contiguous 0..n across open windows (not a counter)
  isOpen: boolean
  fromOrigin?: Rect                   // clicked-icon rect (CRT-relative px) for zoom-from-origin animation; cleared after open animation completes
}

type WindowManagerContextType = {
  windows: Record<string, WindowState>
  selectedIconId: string | null    // currently highlighted desktop icon (single-click selection)
  openApp: (appId: string, fromOrigin?: Rect) => void // cascaded position; fromOrigin enables zoom-in animation
  closeApp: (appId: string) => void   // unmounts the app; re-normalizes zIndex to keep remaining windows contiguous
  focusApp: (appId: string) => void   // reshuffles zIndex so target becomes top of stack (see below)
  selectIcon: (appId: string | null) => void  // single-click highlight
  moveWindow: (appId: string, pos: { x: number; y: number }) => void  // pos in percentage (0–1)
}
```

**Derived focused window** — there is no stored `activeWindowId`. The focused window is always the one with the highest `zIndex`, derived via `useMemo`. This is how PostHog does it and it eliminates sync bugs where a separate focus field drifts from the stack order.

```tsx
const activeWindowId = useMemo(() => {
  return Object.values(windows).reduce<WindowState | null>(
    (top, cur) => (cur.zIndex > (top?.zIndex ?? -1) ? cur : top),
    null,
  )?.appId ?? null
}, [windows])
```

**Contiguous zIndex reshuffle** — `focusApp` does NOT increment a counter. It rewrites every window's `zIndex` so the target becomes `count - 1` and everything above it shifts down. This keeps values in `[0, n)` forever, no drift, no overflow.

```tsx
const focusApp = (appId: string) => {
  setWindows((prev) => {
    const count = Object.values(prev).filter((w) => w.isOpen).length
    const target = prev[appId]
    if (!target) return prev
    const next = { ...prev }
    for (const id of Object.keys(next)) {
      const w = next[id]
      if (!w.isOpen) continue
      next[id] = {
        ...w,
        zIndex:
          id === appId ? count - 1
          : w.zIndex < target.zIndex ? w.zIndex
          : w.zIndex - 1,
      }
    }
    return next
  })
}
```

**Cascade-on-open**: first window opens at base `{ x: 0.12, y: 0.14 }`. Each subsequent open offsets `+0.03` on both axes from the current topmost window's position. If the offset would put the top-left past `{ x: 0.6, y: 0.55 }`, wrap back to the base. Keeps things readable without running offscreen.

**Close normalizes zIndex**: `closeApp` removes the entry *and* decrements every remaining window's `zIndex` that was above the closed one, so the remaining set stays contiguous `[0, n-1)`. Without this, closing a middle window leaves a gap that breaks the derived focus logic.

**Mount/unmount behavior**: App components mount when opened, unmount when closed. Apps that need persistence (e.g., Notepad) use `localStorage`. This keeps things simple and avoids hidden mounted components.

**Re-render cost**: dragging updates `position` in the windows record, which re-renders every consumer of the context. For 8 windows this is fine; if it ever feels janky, wrap each `Window` in `React.memo` (compare by `appId`) and read its own slice via a selector hook rather than consuming the whole record.

**Keep the provider focused**: PostHog's `App.tsx` grew to 2588 lines by bundling windows + settings + notifications + user + chat into one context. Our `WindowManagerProvider` should own windows only. Theme, settings, and any future cross-cutting concerns go in separate providers.

### Window Component (Generic, Reusable)
The `Window` component is the frame that wraps every app. It provides:
- **Title bar**: app name, close box (top-left square), horizontal lines pattern
- **Drag**: mousedown on title bar → mousemove/mouseup listeners on `document` (so fast drags don't lose the cursor) → convert px deltas to percentage of container → update position. Use a **5px click-vs-drag threshold** — movement under 5px is treated as a focus click, not a drag, so a quick click on the title bar doesn't jitter the window.
- **Focus**: clicking anywhere in window brings to front (highest z-index)
- **Content slot**: `children` prop — each app renders inside this
- **Lazy content mount**: app content only renders once the entry animation completes. Prevents layout thrash during the pop-in. PostHog gates this on an `animating` flag; we can do the same or just delay-mount via `setTimeout(..., transitionDuration)`.
- **Open animation from origin**: when `fromOrigin` is set on the window state, the window scales in from the clicked icon's rect (Mac OS "zoom rect" effect). Close animates back to the same origin if still known.
- **Configurable props**:
  - `title: string` — window title
  - `appId: string` — used for window manager state
  - `size: { width, height }` — responsive dimensions using `clamp()` with container query units (see below)
  - `menuItems: MenuConfig[]` — app-specific menu bar items (passed up to menu bar via context)
  - `showScrollbar?: boolean` — vertical scrollbar (Mac OS 1 style)
  - `statusBar?: ReactNode` — optional bottom status bar (e.g., Finder's "X items")

### Window Sizing & Position Strategy
The CRT screen element is a CSS `container-type: size` container. Window **sizes** use `cqw`/`cqh` (container query units) with `clamp()` for min/max bounds. Window **positions** are stored as percentages (0–1) of the container dimensions. Both scale automatically when toggling maximize mode — no recalculation needed.

Size example:
```css
width: clamp(200px, 75cqw, 500px);   /* 75% of screen width, bounded */
height: clamp(200px, 70cqh, 400px);  /* 70% of screen height, bounded */
```

Position example:
```tsx
// Stored: { x: 0.15, y: 0.20 }
// Rendered: style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}
// On drag: convert px delta to % via containerRef.clientWidth/clientHeight
```

### App Registry
Defined in `app/components/desktop/app-registry.ts` (created in Phase 3).
```typescript
type MenuConfig = {
  label: string                              // e.g., "File", "Edit", "Bookmarks"
  items: {
    label: string                            // e.g., "New Tab", "Save", "---" for divider
    action?: () => void                      // callback on click
    disabled?: boolean
    shortcut?: string                        // display only, e.g., "⌘S"
  }[]
}

type AppDefinition = {
  id: string
  name: string
  icon: React.FC                             // user-provided 1-bit pixel art SVG
  defaultSize: {
    width: string                            // clamp() with cqw, e.g. "clamp(200px, 75cqw, 500px)"
    height: string                           // clamp() with cqh, e.g. "clamp(200px, 70cqh, 400px)"
  }
  menuItems: MenuConfig[]                    // app-specific menu bar overrides (merged with defaults)
  component: React.FC                        // "Coming Soon" placeholder until app is built
}
```

### Menu Bar (Dynamic)
- **Apple icon menu** (always, leftmost): About This Macintosh, app list
- **Default menus** (Finder-style, shown when no app is focused or as base): File, Edit, View, Special
- **App-specific overrides**: each app defines `menuItems` in the registry that replace the defaults when that app is focused
- Menu bar reads the derived `activeWindowId` from the window manager context and looks up that app's `menuItems` in the registry; falls back to Finder defaults when no window is focused
- **Z-ordering**: menu bar sits at a higher z-index than all windows so dropdown menus cover windows (and windows cannot be dragged over the menu bar). Reserve a range — windows live in `[0, n)`, menu bar at e.g. `z-[9999]`.
- Default menu bar (with Apple icon + Finder menus) is part of the foundation PR

### Rendering Hierarchy
```
page.tsx (owns isMaximized, isDesktop, phase)
 └── IMacG3Frame (receives isMaximized — hides body/chin/stand when true; CRTScreen always mounted)
      └── CRTScreen (container-type: size — CSS container for window sizing + positioning)
           └── phase === 'welcome' → WelcomeScreen (no menu bar, brief display)
           └── phase === 'desktop' →
                └── WindowManagerProvider
                     └── Desktop
                          ├── MenuBar (top, always visible)
                          ├── Icon Grid (desktop background layer)
                          └── Open Windows (positioned absolutely via %, z-ordered above icons)
                               └── Window (frame) → App Component (content)

When maximized:
 └── IMacG3Frame body/chin/stand hidden via CSS
      └── CRTScreen (expands to fill viewport — container size changes, windows scale via cqw/cqh + %)
           └── Desktop (same component tree, just bigger container)

Mobile:
 └── isDesktop === false → welcome phase never advances to desktop
 └── WelcomeScreen stays permanently (current behavior preserved)
```

### Maximize Mode
- `isMaximized` state lives in `page.tsx`, passed as props to `IMacG3Frame` and `Desktop`
- CRTScreen stays mounted at all times
- Hides: iMac body, chin, stand (CSS toggle)
- CRTScreen expands to fill browser viewport
- Windows auto-scale: sizes via container query units, positions via percentage — no JS resize logic
- Menu bar spans full width
- Triggered by: chin button only (single toggle location)
- Transition: smooth (respects `prefers-reduced-motion`, see below)

**Container sizing note**: CRTScreen currently uses `aspectRatio: '4 / 3'` and flex layout. Adding `container-type: size` requires the element to have a determinate size — flex + aspectRatio gives us that, but we need to verify the parent (`IMacG3Frame`) still gives CRTScreen concrete width/height. In maximize mode, CRTScreen fills `100vw × 100vh` — also concrete. Test both.

**Reduced motion**: `prefers-reduced-motion` disables ALL of these — maximize transition, zoom-from-origin open animation, and close animation. Windows appear/disappear instantly in reduced-motion mode. Use the existing `app/lib/use-reduced-motion.ts` hook.

---

## Applications

### App 1: Web Browser — "Curly Browser"
- **Purpose**: Bookmarks launcher disguised as a Mac OS 1 browser
- **Design**: Mac OS 1 window chrome with **disabled** back/forward buttons, decorative read-only address bar, info banner, and a bookmarks "home page" as the only view. No internal navigation.
- **Key behavior**: Clicking any bookmark calls `window.open(url, '_blank', 'noopener,noreferrer')` — opens in the user's real browser, new tab. Right-click uses the existing Shadcn ContextMenu for "Open in New Tab" and "Copy Link" (actually copies via `navigator.clipboard`).
- **Info banner** (styled tan/yellow, top of content area): `"Curly Browser uses iframes, which most sites block for security. Links open in your real browser instead."` — this explains the quirk instead of hiding it.
- **Bookmarks** (11 total, grouped visually into "Projects" and "Tools"):
  - **Projects (8)**: Penguin Mail (penguinmail.app), ARK Experience (funwithark.ca), Bridger (bridger.atawalk.ca), Stella 56 Diamonds (stella56diamonds.com), Playground (playground.createplus.club), Couples Budget (couplesbudget.ca), 75 Creates (75.createplus.club), KayVee Gems (kayveegems.com)
  - **Tools (3)**: Google, Claude (claude.ai), ChatGPT (chatgpt.com)
- **Favicons**: fetched via `https://www.google.com/s2/favicons?domain=<host>&sz=128`, rendered with `imageRendering: pixelated` for lo-fi vibe.
- **Size**: `clamp(300px, 78cqw, 600px)` × `clamp(250px, 75cqh, 450px)` (large)
- **Does not iframe anything.** Don't try. The whole point is that it doesn't.

### App 2: Note Pad
- **Purpose**: Fun interactive element
- **Design**: Mac OS 1 Note Pad (simple lined text area, torn-paper top edge)
- **Features**: Single pad, localStorage save, pre-populated welcome message
- **Menu**: File > Clear Note
- **Size**: `clamp(180px, 40cqw, 300px)` × `clamp(220px, 60cqh, 380px)` (medium)

### App 3: System — "Control Panel"
- **Purpose**: Visitor diagnostics + Raj's info
- **Design**: Control Panel style (dark panels, icons) from reference image 2
- **Features**: Browser, OS, screen res, timezone, connection, language; Raj's name, role, links
- **Size**: `clamp(250px, 55cqw, 420px)` × `clamp(200px, 55cqh, 350px)` (medium)

### App 4: Calculator
- **Purpose**: Functional easter egg
- **Design**: Exact Mac OS 1 calculator (reference image 2)
- **Features**: C, E, =, *, 0-9, +, -, /, . — basic arithmetic
- **Size**: `clamp(120px, 25cqw, 200px)` × `clamp(180px, 45cqh, 280px)` (small)

### App 5: Finder — "Documents"
- **Purpose**: File explorer that mirrors the real `public/` folder with Mac-styled folder names for flavor
- **Design**: Classic Finder icon grid with breadcrumb path + Back button, scrollable content area, status bar footer
- **Folder rename map** (display label ← actual path):
  - "Macintosh HD" — root
  - "Applications" ← `public/app-icons/`
  - "Documents" ← `public/cv/` (contains Resume.pdf)
  - "Fonts" ← `public/fonts/`
  - "Developer" ← `public/tech-icons/`
  - Loose files at root (Apple Logo.svg ← apple-icon.svg, Startup Sound.wav ← StartupMacI.wav, Avatar.webp ← raj-avatar.webp, etc.)
- **Interactions**:
  - Single-click: selects the item (text-inverted label highlight, matching desktop icons)
  - Double-click folder: navigate into it (path stack)
  - Double-click file: preview in an **absolute-positioned overlay** within the Finder window (not a new top-level window — overlay has its own close button, ESC dismisses)
  - Right-click file (Shadcn ContextMenu): Open, Download, Get Info (disabled), Rename (disabled)
  - Back button: pop path stack
- **Preview overlay by file type**:
  - `.svg` / `.png` / `.webp` / `.jpg` → `<img>` with object-fit contain
  - `.wav` / `.mp3` → `<audio controls>`
  - `.pdf` → `<iframe src={path}>` (browser native PDF viewer)
  - `.woff` / `.woff2` / `.ttf` → message + sample text rendered in the font
  - anything else → "Preview not available" + Download hint
- **Download**: right-click → Download triggers `<a href={path} download>.click()`
- **No cover letter** — ship with just the resume for now. Nothing to gate on.
- **Status bar**: "N items, 72K in disk, 400K available" (fake-realistic)
- **Size**: `clamp(220px, 48cqw, 380px)` × `clamp(180px, 50cqh, 320px)` (medium)
- **Menu**: uses the existing `FINDER_DEFAULT_MENUS` export from `app-registry.tsx`

### App 6: Scrapbook — "Journal"
- **Purpose**: Blog posts
- **Design**: Mac OS Scrapbook — page-by-page with arrows
- **Content**: 3 blog posts from CONTENT-ARCHIVE.md
- **Size**: `clamp(250px, 55cqw, 420px)` × `clamp(220px, 60cqh, 380px)` (medium)

### App 7: World Map
- **Purpose**: Travel showcase — 24 visited countries highlighted
- **Design**: Public-domain world map, dithered SVG pattern fill on visited countries, plain white on unvisited, black stroke throughout. Aesthetic reference: `public/worldmap.png` (a Risk-style Mac OS screenshot — style only; **no** game chrome, Player1, Done/Fortify/Cards).
- **Visited countries (24, ISO alpha-3)**:
  `CAN, USA, GBR, FRA, DEU, AUT, ITA, CHE, HUN, CZE, NLD, BEL, LUX, EGY, SAU, ARE, IND, JPN, THA, MYS, SGP, LKA, MUS, NZL`
  (Canada, United States, United Kingdom, France, Germany, Austria, Italy, Switzerland, Hungary, Czechia, Netherlands, Belgium, Luxembourg, Egypt, Saudi Arabia, UAE, India, Japan, Thailand, Malaysia, Singapore, Sri Lanka, Mauritius, New Zealand)
- **Features**: Hover tooltip with country name; small legend at a corner (patterned box + plain box with labels); viewBox scales map to window; visited count shown subtly ("24 / ~195 countries").
- **Map data**: `react-simple-maps` + `world-atlas` (TopoJSON, ~100KB) — installed as deps on `feat/mac-os-1984-desktop` before the app PR begins.
- **Size**: `clamp(280px, 70cqw, 540px)` × `clamp(220px, 60cqh, 380px)` (large)

### App 8: Music — live Spotify now-playing (vinyl parody of Apple Music)
- **Purpose**: Show what Raj is currently listening to on Spotify, as a playful Mac-era vinyl record
- **Design**: Spinning vinyl record (CSS rotate animation) with the current album art as the record label (circular mask), playlist list beside it showing recent tracks. Chicago font captions.
- **Live data**: Spotify Web API `me/player/currently-playing` endpoint, polled every ~10s. Uses refresh-token OAuth flow so no user login is needed by visitors — it's always Raj's account.
- **Fallback**: If nothing playing, show a featured/last-played track (or a static "Offline" vinyl).
- **Reduced-motion**: freeze the vinyl rotation when `prefers-reduced-motion: reduce`.
- **Size**: `clamp(180px, 40cqw, 300px)` × `clamp(220px, 60cqh, 380px)` (medium)

#### Spotify integration architecture — works on localhost, Cloudflare preview, and production

**Key insight**: the runtime does NOT use the browser-based OAuth authorization flow. It uses the **refresh-token grant** — a server-side-only swap of `refresh_token` → `access_token` on each request. No user redirect, no CORS issues, no per-URL registration in the Spotify dashboard. The SAME code works on every deploy target.

```
┌──────────────┐   GET /api/spotify/now-playing  ┌─────────────────────┐
│ Browser      │ ──────────────────────────────▶ │ Next.js route       │
│ (vinyl UI)   │                                 │ (Cloudflare fn or   │
│              │ ◀────────────────────────────── │  local dev server)  │
└──────────────┘   JSON { track, artist, ... }   └─────────────────────┘
                                                           │
                                                           │  POST /api/token (grant_type=refresh_token)
                                                           ▼
                                                 ┌─────────────────────┐
                                                 │ Spotify Accounts    │
                                                 │ (auth server)       │
                                                 └─────────────────────┘
                                                           │
                                                           │  { access_token, expires_in }
                                                           ▼
                                                 ┌─────────────────────┐
                                                 │ Spotify Web API     │
                                                 │ me/player/currently │
                                                 │   -playing          │
                                                 └─────────────────────┘
```

**One-time setup** (user runs `scripts/spotify-oauth.mjs` once, locally):
1. Creates a Spotify Developer app at https://developer.spotify.com/dashboard
2. Registers redirect URI `http://127.0.0.1:8888/callback` (for the one-shot helper ONLY)
3. Sets `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` in `.env.local`
4. Runs `node scripts/spotify-oauth.mjs` → helper starts a local HTTP server on port 8888 → opens browser → user authorizes with the `user-read-currently-playing user-read-playback-state` scopes → Spotify redirects back to `127.0.0.1:8888/callback` with a `code` → helper exchanges it for a refresh token → prints the token
5. User appends `SPOTIFY_REFRESH_TOKEN=<printed value>` to `.env.local`

The `127.0.0.1:8888/callback` URL only exists for this 30-second ritual. **It is never used at runtime.** The refresh token is long-lived (effectively non-expiring unless revoked).

**Runtime (every environment — localhost / preview / production)**:
- Backend route `app/api/spotify/now-playing/route.ts` reads three env vars:
  - `SPOTIFY_CLIENT_ID`
  - `SPOTIFY_CLIENT_SECRET`
  - `SPOTIFY_REFRESH_TOKEN`
- On each request: POST to `https://accounts.spotify.com/api/token` with `grant_type=refresh_token` → get an `access_token` (valid 1 hour, but we don't cache — Cloudflare functions are stateless per invocation, so each request gets a fresh one; acceptable rate cost)
- GET `https://api.spotify.com/v1/me/player/currently-playing` with the access token
- Return `{ isPlaying, track, artist, album, albumArt, progressMs, durationMs }` as JSON
- Browser polls this route every ~10 seconds (no auth needed on the browser side — it's just a fetch to a same-origin API route)

**Environment variable setup by deploy target**:
| Environment | Where to set the 3 env vars |
|-------------|-----------------------------|
| **Local dev** (`bun run dev`) | `.env.local` at project root (gitignored — never commit). Next.js auto-loads it. |
| **Cloudflare Pages preview** (any `*.pages.dev` branch deploy) | Pages → Settings → Environment variables → **"Preview"** scope. Add all three vars. |
| **Cloudflare Pages production** (`curlycloud.dev`) | Same dashboard → **"Production"** scope. Add all three vars (can be the same values as Preview). |

OpenNext/Cloudflare Pages passes `process.env.*` through to the runtime for both Next.js API routes and Cloudflare functions. No code differences between environments — it's literally the same `route.ts` reading the same variable names.

**Why this works on preview links despite the dynamic `*.pages.dev` hostnames**: the runtime never talks to Spotify's auth server with a redirect URI. The only place a redirect URI matters is the one-time OAuth helper, which always runs on `http://127.0.0.1:8888/callback` — completely decoupled from any deploy URL.

---

## Git & PR Strategy

### Branch Structure
```
main
 └── feat/mac-os-1984-desktop  (long-lived integration branch — final merge target for everything)
      ├── feat/pre-app-foundation  (PR #1 — MERGED 2026-04-15)
      └── feat/desktop-apps        (PR #3 — all 8 apps + Spotify integration, per-app commits)
```

One PR per major chunk. Pre-app-foundation shipped as PR #1/#2 (window system, desktop shell, context menus). All 8 apps ship together as **PR #3** off a single `feat/desktop-apps` branch, with **one commit per app** for reviewability.

### PR #3 Workflow — `feat/desktop-apps` → `feat/mac-os-1984-desktop`
1. **Branch off** `feat/mac-os-1984-desktop` (the merged foundation).
2. **One commit per app** — even though everything rides one PR, each app lands as its own commit (subject line: `App: <Name> — <one-line summary>`). Keeps `git log` / bisect / review legible.
3. **Commit plan (in order)**:
   1. DESKTOP-PLAN refinements
   2. Spotify OAuth helper script (`scripts/spotify-oauth.mjs`) — user runs locally to get refresh token
   3. Calculator
   4. Note Pad
   5. Control Panel
   6. Finder (Documents)
   7. Scrapbook (Journal)
   8. Curly Browser
   9. World Map
   10. Music (Spotify API route + vinyl UI) — last, gated on refresh token
4. **Subagents** write individual component files (`app/components/apps/<name>.tsx`) into this one branch. Main agent handles every other step (registry wiring, `tsc --noEmit`, commits, push). **No isolated worktrees** — they break in this session's subagent sandbox. Subagents only Read + Write files inside the repo.
5. **Final merge** — `feat/desktop-apps` → `feat/mac-os-1984-desktop`, then `feat/mac-os-1984-desktop` → `main` after final integration pass.

### Why This Strategy (revised)
- **One PR, per-app commits**: reviewable without creating 8 parallel PRs. Each commit is a logical unit; bisect and blame still work.
- **Matches subagent sandbox**: the earlier plan assumed subagents could run `git`/`gh`/`tsc` inside worktrees. In practice the sandbox denies Bash for subagents, so the main agent drives all git operations. Subagents are reduced to file writers.
- **Conflict-free registry**: a single branch means the one shared file (`app-registry.tsx`) grows cleanly with each commit — no merge conflicts between app branches.
- **Multi-session friendly**: still resumable — mid-PR state is just "N of M commits done" on a single branch.

---

## Implementation Phases

### Phase 1: Maximize Mode + Screen Phases
**PR**: Part of `feat/pre-app-foundation`
**Files to modify**: `imac-frame.tsx`, `page.tsx`, `types.ts`, `menu-bar.tsx`, `crt-screen.tsx`, `welcome-screen.tsx`

| Step | Description |
|------|-------------|
| 1.1 | Add `'desktop'` to `ScreenPhase` type: `'off' \| 'flicker' \| 'boot' \| 'welcome' \| 'desktop'` |
| 1.2 | Update `welcome-screen.tsx`: remove menu bar from welcome screen |
| 1.3 | Add welcome → desktop transition in `page.tsx` (welcome shows briefly, then auto-advances to desktop phase). Only when `isDesktop` — mobile stays on welcome permanently. |
| 1.4 | Add `isMaximized` state in `page.tsx` (lifted to page level, passed as props to IMacG3Frame and Desktop) |
| 1.5 | Add `container-type: size` to CRT screen element in `crt-screen.tsx` (need both axes for `cqw` and `cqh`) |
| 1.6 | Add expand/collapse button to iMac chin in `imac-frame.tsx` |
| 1.7 | When maximized: hide iMac body/chin/stand via CSS; CRTScreen stays mounted and expands to fill viewport |
| 1.8 | Smooth transition animation (respect `prefers-reduced-motion`) |
| 1.9 | Test: phase transitions work, maximize toggle works, animation smooth, mobile stays on welcome |

### Phase 2 + 3: Window System + Desktop Shell (co-developed)
**PR**: Part of `feat/pre-app-foundation`
**Files to create**: `app/components/desktop/window.tsx`, `app/components/desktop/window-manager.tsx`, `app/components/desktop/desktop.tsx`, `app/components/desktop/desktop-icon.tsx`, `app/components/desktop/app-registry.ts`
**Files to modify**: `app/components/menu-bar.tsx`, `app/page.tsx`, `app/components/types.ts`

> Window component and window manager are co-developed since the Window component depends on the context for drag/focus/close. They're part of the same PR.

| Step | Description |
|------|-------------|
| 2.1 | Create `WindowManagerProvider` context: `windows` record, `selectedIconId`, `openApp(fromOrigin?)`, `closeApp`, `focusApp` (contiguous zIndex reshuffle), `selectIcon`, `moveWindow`. **No stored `activeWindowId`** — derive it via `useMemo` from highest zIndex. No maximize state — that lives in `page.tsx`. |
| 2.2 | Create `app-registry.ts` with all 8 `AppDefinition` entries using "Coming Soon" placeholder component. Use `clamp()` + `cqw`/`cqh` for sizes. |
| 2.3 | Build generic `Window` component — title bar with close box (top-left), app name, horizontal lines pattern. Window sizes use container query units from registry. |
| 2.4 | Wire Window to context: drag (mousedown/move/up on title bar) with 5px click-vs-drag threshold, click-to-focus, close box |
| 2.5 | Constrain drag to CRT screen bounds (works for both normal and maximized since CRTScreen is always the container) |
| 2.6 | Content slot via `children` (lazy-mounted after entry animation), optional scrollbar, optional status bar |
| 2.6a | Zoom-from-origin open animation: DesktopIcon passes its bounding rect to `openApp(id, rect)`; Window scales in from that rect. Close reverses it. |
| 2.7 | Create `Desktop` component (crosshatch bg, icon grid, open windows layer) — rendered when `phase === 'desktop'` |
| 2.8 | Create `DesktopIcon` component (icon + label, single-click to select/highlight, double-click to open) |
| 2.9 | Use placeholder icons for all 8 apps (user will provide final 1-bit pixel art SVGs later) |
| 2.10 | Update `page.tsx`: phase `'desktop'` renders `Desktop`; mobile never advances past `'welcome'`. `isMaximized` already in page state from Phase 1.4, passed as prop. |
| 2.11 | Refactor `MenuBar`: Apple icon menu (About) always left. Default = Finder menus (File/Edit/View/Special). Read active app's `menuItems` overrides from registry via context. |
| 2.12 | Add maximize nudge dialog (shown after first app open) |
| 2.13 | Test: full flow — boot → welcome (no menu bar) → desktop → open placeholder window → drag → close → focus → icon select → menu updates |

### Phase 4: Application Development (Single PR, per-app commits)
**PR**: #3 — `feat/desktop-apps` → `feat/mac-os-1984-desktop`
**Method**: Subagents write component files into the repo; main agent handles all git operations. No worktrees (the subagent sandbox denies Bash, so in-worktree `git`/`gh`/`tsc` is impossible).

Each subagent gets a focused **write-only contract**: target file path, component spec, references to read. They use only Read + Write tools. All branching, registry edits, tsc checks, commits, pushes, and the PR are done by the main agent.

**Commit order on `feat/desktop-apps`** (reflects build dependencies — Spotify helper lands early so the user can run it in parallel):

| # | Commit | Author |
|---|--------|--------|
| 1 | DESKTOP-PLAN refinements | main agent |
| 2 | `scripts/spotify-oauth.mjs` — one-shot OAuth helper | main agent |
| 3 | App: Calculator | main agent (file staged from earlier agent run) |
| 4 | App: Note Pad | main agent (file staged from earlier agent run) |
| 5 | App: Control Panel | main agent (file staged from earlier agent run) |
| 6 | App: Finder (Documents) | main agent (file staged from earlier agent run) |
| 7 | App: Scrapbook (Journal) | main agent (file staged from earlier agent run) |
| 8 | App: Curly Browser | subagent writes file → main agent commits |
| 9 | App: World Map | subagent writes file → main agent commits |
| 10 | App: Music (API route + vinyl UI) | subagent writes file → main agent commits; **gated on Spotify refresh token** |

### Phase 5: Integration & Polish
**After all app PRs merged into `feat/mac-os-1984-desktop`**

| Step | Description |
|------|-------------|
| 5.1 | All app branches merged into `feat/mac-os-1984-desktop` |
| 5.2 | Integration testing — all apps open/close/focus correctly together |
| 5.3 | Menu bar shows correct menus per app (defaults + overrides) |
| 5.4 | Z-ordering works across all windows |
| 5.5 | Maximize mode works with all apps (container query sizing scales correctly) |
| 5.6 | Performance check — 8 potential windows shouldn't lag |
| 5.7 | User provides final 1-bit SVG icons → replace placeholders |
| 5.8 | Final review, merge to `main` |

---

## Subagent Contracts

Each app subagent gets a standardized brief. Template:

```
## Contract: [App Name]

**File to create**: `app/components/apps/[app-name].tsx`
**Branch**: `feat/app-[app-name]` (from `feat/mac-os-1984-desktop`, after PR #1 merged)

### Interface
Export a single default component:
  export function [AppName]App() { ... }

The component renders ONLY the app content (no window frame).
The Window component wraps it externally.

### App Registry Update
Update the existing placeholder entry in `app/components/desktop/app-registry.ts`:
  - Replace "Coming Soon" placeholder with the real component
  - Update `menuItems` with app-specific menu overrides (these replace the Finder defaults when the app is focused)
  - Icon: leave as-is (user provides final SVG icons separately)

### Requirements
[App-specific requirements from the Applications section]
⚠ For Browser/World Map/Music: ask user for missing content/mockups/data before building.

### Styling Rules
- Use inline styles and Tailwind classes (collocated, no separate CSS)
- Use `fontFamily: 'var(--font-chicago)'` for all text
- 1-bit aesthetic: black and white, no gradients, 1-2px borders
- Match Mac OS System 1 visual language
```

---

## Inspiration & Anti-patterns from PostHog

Full notes in `POSTHOG-RESEARCH.md`. Summary of what we're copying and what we're deliberately not.

### Patterns we're adopting
1. **Derived focused window** — top of z-stack IS the focused window; no separate `activeWindowId` field. Eliminates sync bugs.
2. **Contiguous zIndex reshuffle** on `focusApp` — values stay in `[0, n)`, no counter drift.
3. **5px click-vs-drag threshold** on draggable title bar (and desktop icons if we ever make them draggable). A quick click shouldn't jitter the window.
4. **Lazy content mount** — app contents render only after the window's entry animation completes. Prevents layout thrash on pop-in.
5. **Zoom-from-origin open animation** — window scales in from the clicked icon's bounding rect (`fromOrigin`). This is the authentic Mac OS "zoom rects" effect and the easiest big-wow polish item.
6. **DragConstraints via ref** — pass a ref to the CRT screen element to constrain drag. Works unchanged in maximized mode because CRTScreen is always the container.
7. **Provider discipline** — the window manager owns windows only. Site settings, theme, and notifications (if any) live elsewhere. PostHog's `App.tsx` is 2588 lines because they merged everything.

### Patterns we're deliberately NOT using
1. **Per-window history / URL-backed windows** — PostHog ties windows to Gatsby routes so each window has a path. We're a single-page Next.js app; apps are React components, not routes. Keep it simple.
2. **Share-layout-via-URL** — neat but out of scope for v1. Revisit as a future enhancement.
3. **Framer Motion for drag** — PostHog uses `useDragControls`. We're using native pointer events to keep the dep surface small and the behavior trivially predictable. If drag feels janky, reconsider.
4. **Window resize** — PostHog has 5 resize handles. We explicitly chose no-resize in Design Decisions (#2). Mac OS 1 windows didn't resize anyway.
5. **Snap-to-side** — PostHog has half-screen left-snap. We have a single maximize mode and no snap. Period-accurate.
6. **Tabs inside windows** — PostHog's `WindowTabs` is literally `<div>TABS</div>`. Don't bother.
7. **Radix Menubar** — our menu bar is 1-bit and purely visual; Radix's ARIA-heavy menubar is overkill. Roll our own.
8. **Lottie for animations** — PostHog's inline Lottie file is 1669 lines of JSON. We use CSS + reduced-motion hooks.
9. **Giant `safelist.txt`** — we're not runtime-generating Tailwind classes from data attributes; no safelist needed.

### Future enhancements (inspired, not blocking v1)
- **Screensaver**: inactivity-triggered overlay — a bouncing Happy Mac or "After Dark flying toasters" riff. PostHog has this (`Screensaver/index.tsx`) and it's charming.
- **Active windows panel**: a side panel or Apple-menu submenu listing open windows with close buttons. In Mac OS 1 this was the Application menu in the top-right. Nice quality-of-life, not critical for v1.
- **Shareable layout URL**: encode open windows + positions as a query param so you can send someone a link to "this exact desktop state."
- **Right-click context menu** on desktop: "Reset Icons", "About", etc. PostHog has this on desktop empty space.

---

## Progress Tracker

### Phase 1: Maximize Mode + Screen Phases ✅
- [x] `'desktop'` added to ScreenPhase type
- [x] Welcome screen updated (no menu bar)
- [x] Welcome → desktop auto-transition in page.tsx
- [x] `container-type: size` on CRT screen
- [x] `isMaximized` state in `page.tsx` (passed as props)
- [x] Chin expand/collapse button on iMac frame (CD slot doubles as the toggle — no layout shift between phases)
- [x] Maximize: hide iMac body/chin/stand, CRTScreen expands to viewport
- [x] Transition animation (+ reduced motion)
- [x] Testing (including: mobile stays on welcome)

### Phase 2+3: Window System + Desktop Shell ✅
- [x] WindowManagerProvider context (open/close/focus/drag/selectIcon — no maximize, no stored activeWindowId — derive from zIndex)
- [x] `focusApp` uses contiguous zIndex reshuffle (no counter)
- [x] `app-registry.tsx` with all 9 entries — 8 apps + Trash (Coming Soon placeholders, cqw/cqh sizes)
- [x] Generic Window component (title bar, close box, drag, container query sizing)
- [x] Drag wired to context, constrained to CRT screen bounds, 5px click-vs-drag threshold, direct-DOM transform for smooth drag
- [x] Lazy content mount — children render after entry animation completes
- [x] Zoom-from-origin open/close animation using clicked-icon rect
- [x] Scrollbar + status bar options on Window
- [x] Desktop component (crosshatch bg, icon grid top-right, Trash bottom-right, windows layer) — phase === 'desktop'
- [x] DesktopIcon component (single-click select, double-click open, text-only selection highlight)
- [x] Placeholder icons for all 8 apps (user provided — final pass still pending)
- [x] page.tsx updated (Desktop on desktop phase, WelcomeScreen on mobile)
- [x] MenuBar refactored: Apple icon menu + Finder defaults + per-app overrides from registry
- [x] Maximize nudge dialog
- [x] Right-click context menus (shadcn/radix) on desktop + icons — *not in original plan, added during PR #2*
- [x] Trash registered as a clickable app — *Design Decision #11 updated*
- [x] Integration test: boot → welcome (no menu bar) → desktop → open → drag → close → focus → select icon → menus

### PR #1/#2 Review ✅
- [x] PR #2 opened: `feat/pre-app-foundation` → `feat/mac-os-1984-desktop`
- [x] Reviewed & approved
- [x] Merged 2026-04-15 — ready for app branches

### Phase 4: Apps (single PR `feat/desktop-apps`, per-app commits)
- [x] Commit 1: DESKTOP-PLAN refinements
- [x] Commit 2: `scripts/spotify-oauth.mjs` OAuth helper
- [x] Commit 3: Calculator
- [x] Commit 4: Note Pad
- [x] Commit 5: Control Panel
- [x] Commit 6: Finder (Documents)
- [x] Commit 7: Polish — +10% text and icon scale for readability *(added from live review)*
- [x] Commit 8: Scrapbook (Journal)
- [x] Commit 9: Finder — use `public/app-icons/folder.svg` for folder icons *(added from live review)*
- [x] Commit 10: Window — inset focus-state horizontal lines, clean gap around close box *(added from live review)*
- [x] Commit 11: Scrapbook — correct blog post year 2025 → 2026 *(added from live review)*
- [x] Commit 12: Polish — larger Control Panel avatar + tighter title-bar stripe inset *(added from live review)*
- [x] Commit 13: Polish — Control Panel avatar + tighter title-bar stripe inset (v2) *(live review)*
- [x] Commit 14: Window — stripes reach window edges with close box sitting on them (v3) *(live review)*
- [x] Commit 15: Curly Browser
- [x] Commit 16: World Map
- [x] Commit 17: World Map — filled tooltip for visited countries *(live review)*
- [x] Commit 18: World Map — larger map + Equal Earth, remove legend *(live review)*
- [x] Commit 19: World Map — flat Equirectangular + full Antarctica *(live review)*
- [x] Commit 20: World Map — window aspect = 2:1 so Antarctica hits the bottom *(live review)*
- [x] Commit 21: World Map — move visited count to bottom-left + gitignore `.dev.vars` *(live review)*
- [x] Commit 22: World Map — white background + border on the visited-count label *(live review)*
- [x] Commit 23: Music (Spotify API route + vinyl UI)
- [x] Commit 24: Curly Browser — SVG nav icons + embed Tools in-place *(live review)*
- [x] Commit 25: Music — larger window + vinyl, clickable Spotify links per track *(live review)*
- [x] Commit 26: Update Curly Browser app icon *(user-provided asset tweak)*
- [x] PR #3 opened: `feat/desktop-apps` → `feat/mac-os-1984-desktop` (https://github.com/radroid/curly-cloud/pull/3)

### Phase 5: Integration
- [ ] PR #3 merged into `feat/mac-os-1984-desktop`
- [ ] Integration testing passed
- [ ] User provides final 1-bit SVG icons → replace placeholders
- [ ] Cloudflare Pages env vars set for Preview + Production scopes
- [ ] Merged to `main`

---

## Readiness Checklist

Snapshot of what's ready to build, what's gated, and what's still TBD. Update as blockers clear.

### ✅ Ready to implement (PR #1 — `feat/pre-app-foundation`)
Everything in **Phase 1** (maximize mode, screen phases) and **Phase 2+3** (window system, desktop shell, menu bar, placeholder apps) is fully specified:
- Types for `WindowState`, `WindowManagerContextType`, `AppDefinition`, `MenuConfig`
- Derived focus + contiguous zIndex algorithms with code
- Cascade open position, close normalization, drag math
- 5px click-vs-drag threshold
- Lazy content mount + zoom-from-origin animation
- Menu bar z-ordering above windows
- Container-query sizing with `cqw`/`cqh` + `clamp()`
- `isMaximized` lifted to `page.tsx`, passed as props
- Reduced-motion coverage
- Rendering hierarchy diagram
- Placeholder icons for all 8 apps

**Status: PR #1 can begin immediately.**

### 🟢 All 8 apps unblocked as of 2026-04-15
Content gates were resolved during the pre-app-foundation review. Every app has an actionable spec in the Applications section above. Summary of what unblocked each:

| App | Resolution |
|-----|------------|
| Calculator | always was ready |
| Note Pad | always was ready; welcome text inlined in spec |
| Finder (Documents) | scoped to mirror `public/` with Mac-styled folder names; resume-only, no cover letter; preview overlay by file type |
| Scrapbook (Journal) | pulls all posts from `CONTENT-ARCHIVE.md` |
| Control Panel | Raj info from `CONTENT-ARCHIVE.md` + live diagnostics (clock, battery, timezone, browser/OS) |
| Curly Browser | no iframes — bookmarks open in real browser. 11 bookmarks (8 projects + Google/Claude/ChatGPT). Info banner explains the quirk |
| World Map | 24 visited countries by ISO-3 code; `react-simple-maps` + `world-atlas` for data; no game UI chrome |
| Music | Spotify now-playing with vinyl presentation; OAuth refresh-token flow via `/api/spotify/now-playing` route |

### 🔴 Still blocked
- **Music** is gated on user providing Spotify Client ID + Secret, then running the one-time OAuth helper to capture the refresh token. All other apps can build in parallel while Spotify is being wired.
- Final 1-bit SVG icons for all 8 apps — user iterates after app frames are live.

### ❓ Open questions before implementation starts
None currently. Design Decisions table covers all settled choices. If anything surfaces, add it there rather than improvising in code.

---

## Reference Files

| File | Purpose |
|------|---------|
| `CONTENT-ARCHIVE.md` | Projects, blog posts, skills, timeline — source content for apps |
| `MOBILE-PLAN.md` | Separate plan for mobile iPhone OS 1 experience |
| `POSTHOG-RESEARCH.md` | Reference research on PostHog.com's desktop-OS architecture — patterns borrowed and deliberately avoided |
| `app/page.tsx` | Entry point — boot sequence + screen rendering |
| `app/components/imac-frame.tsx` | iMac G3 frame — modify for maximize mode |
| `app/components/welcome-screen.tsx` | Current welcome screen — replaced by Desktop on desktop viewports |
| `app/components/menu-bar.tsx` | Menu bar — update for dynamic per-app menus |
| `app/components/crt-screen.tsx` | CRT screen wrapper — stays as-is |
| `app/components/boot-screen.tsx` | Boot animation — stays as-is |
| `app/components/types.ts` | Shared types — extend for window/app types |
| `app/components/desktop/app-registry.ts` | App definitions — created in Phase 2+3 |
| `app/global.css` | Theme CSS — crosshatch pattern, Chicago font, Mac OS styles |
| `app/lib/use-reduced-motion.ts` | Accessibility hook — use for animations |
