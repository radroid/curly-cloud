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
8. [Progress Tracker](#progress-tracker)

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
| 11 | Trash icon | Decorative (bottom-right corner) | Not functional. |
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
type WindowState = {
  appId: string
  position: { x: number; y: number }  // percentage of container (0–1), e.g. { x: 0.15, y: 0.20 }
  zIndex: number
  isOpen: boolean
}

type WindowManagerContextType = {
  windows: Record<string, WindowState>
  activeWindowId: string | null
  selectedIconId: string | null    // currently highlighted desktop icon (derived, not duplicated in WindowState)
  openApp: (appId: string) => void   // opens at cascaded position, assigns z-index
  closeApp: (appId: string) => void   // unmounts the app component
  focusApp: (appId: string) => void   // brings to front (highest z-index)
  selectIcon: (appId: string | null) => void  // single-click highlight
  moveWindow: (appId: string, pos: { x: number; y: number }) => void  // pos in percentage (0–1)
}
```

**Mount/unmount behavior**: App components mount when opened, unmount when closed. Apps that need persistence (e.g., Notepad) use `localStorage`. This keeps things simple and avoids hidden mounted components.

### Window Component (Generic, Reusable)
The `Window` component is the frame that wraps every app. It provides:
- **Title bar**: app name, close box (top-left square), horizontal lines pattern
- **Drag**: mousedown on title bar → mousemove/mouseup listeners on `document` (so fast drags don't lose the cursor) → convert px deltas to percentage of container → update position
- **Focus**: clicking anywhere in window brings to front (highest z-index)
- **Content slot**: `children` prop — each app renders inside this
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
- Menu bar reads active window's app definition from registry via context; falls back to Finder defaults
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
- Transition: smooth scale/fade (respects `prefers-reduced-motion`)

---

## Applications

### App 1: Web Browser — "Curly Browser"
- **Purpose**: Portfolio showcase (main app)
- **Design**: User has separate mockups — will provide when building this app
- **Content**: 5 projects from CONTENT-ARCHIVE.md (Penguin Mail, ARK Experience, Bridger, Stella 56, Playground)
- **Features**: Bookmarks toolbar, project detail views, link to live sites
- **Size**: `clamp(300px, 78cqw, 600px)` × `clamp(250px, 75cqh, 450px)` (large)
- **⚠ Note**: Subagent should ask user for mockups before building. Use mock project cards as placeholder.

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
- **Purpose**: Resume & cover letter downloads
- **Design**: Classic Finder window with file icons
- **Features**: Resume.pdf, Cover_Letter.pdf — click to select, double-click to download
- **Status bar**: "X items, XXK in disk, XXK available"
- **Size**: `clamp(220px, 48cqw, 380px)` × `clamp(180px, 50cqh, 320px)` (medium)

### App 6: Scrapbook — "Journal"
- **Purpose**: Blog posts
- **Design**: Mac OS Scrapbook — page-by-page with arrows
- **Content**: 3 blog posts from CONTENT-ARCHIVE.md
- **Size**: `clamp(250px, 55cqw, 420px)` × `clamp(220px, 60cqh, 380px)` (medium)

### App 7: World Map
- **Purpose**: Travel showcase
- **Design**: Risk-style SVG map with dithered pattern fills
- **Features**: Visited regions patterned, unvisited plain, legend
- **Size**: `clamp(280px, 70cqw, 540px)` × `clamp(220px, 60cqh, 380px)` (large)
- **⚠ Note**: Travel data TBD. Subagent should use mock data and ask user for real travel data.

### App 8: Music / Interests (TBD)
- **Purpose**: Personal touch
- **Size**: `clamp(180px, 40cqw, 300px)` × `clamp(220px, 60cqh, 380px)` (medium)
- **⚠ Note**: Scope undefined. Subagent should build a shell with mock content and ask user for details.

---

## Git & PR Strategy

### Branch Structure
```
main
 └── feat/mac-os-1984-desktop  (current branch — final merge target for everything)
      ├── feat/pre-app-foundation  (PR #1 → feat/mac-os-1984-desktop)
      ├── feat/app-calculator      (PR → feat/mac-os-1984-desktop, after PR #1 merged)
      ├── feat/app-notepad         (PR → feat/mac-os-1984-desktop)
      ├── feat/app-finder          (PR → feat/mac-os-1984-desktop)
      ├── feat/app-browser         (PR → feat/mac-os-1984-desktop)
      ├── feat/app-system          (PR → feat/mac-os-1984-desktop)
      ├── feat/app-scrapbook       (PR → feat/mac-os-1984-desktop)
      ├── feat/app-world-map       (PR → feat/mac-os-1984-desktop)
      └── feat/app-music           (PR → feat/mac-os-1984-desktop)
```

### PR Workflow
1. **PR #1** — `feat/pre-app-foundation` → `feat/mac-os-1984-desktop`
   - Maximize mode, window component, desktop shell, window manager, dynamic menu bar, default Finder menus
   - Must be reviewed & merged before app PRs begin
   
2. **App PRs** (parallel, one per app) — `feat/app-*` → `feat/mac-os-1984-desktop`
   - Branch from `feat/mac-os-1984-desktop` (after PR #1 is merged)
   - Each built by a subagent in its own worktree
   - Can be developed simultaneously
   - Each PR is small and reviewable (~200-500 lines)
   - Merged one by one into `feat/mac-os-1984-desktop`

3. **Final merge** — `feat/mac-os-1984-desktop` → `main`
   - After all apps merged and tested together
   - Final integration testing before merging to main

### Why This Strategy
- **Small PRs**: No 10k-line monster PRs. Each is focused and reviewable.
- **Parallel work**: Subagents build apps simultaneously in isolated worktrees.
- **Safe merges**: Foundation is stable before apps branch from it. Apps don't conflict with each other.
- **Multi-session friendly**: Can pause after any PR and resume later.

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
| 2.1 | Create `WindowManagerProvider` context with full state (open/close/focus/drag/selectIcon). No maximize state — that lives in `page.tsx`. |
| 2.2 | Create `app-registry.ts` with all 8 `AppDefinition` entries using "Coming Soon" placeholder component. Use `clamp()` + `cqw`/`cqh` for sizes. |
| 2.3 | Build generic `Window` component — title bar with close box (top-left), app name, horizontal lines pattern. Window sizes use container query units from registry. |
| 2.4 | Wire Window to context: drag (mousedown/move/up on title bar), click-to-focus, close box |
| 2.5 | Constrain drag to CRT screen bounds (works for both normal and maximized since CRTScreen is always the container) |
| 2.6 | Content slot via `children`, optional scrollbar, optional status bar |
| 2.7 | Create `Desktop` component (crosshatch bg, icon grid, open windows layer) — rendered when `phase === 'desktop'` |
| 2.8 | Create `DesktopIcon` component (icon + label, single-click to select/highlight, double-click to open) |
| 2.9 | Use placeholder icons for all 8 apps (user will provide final 1-bit pixel art SVGs later) |
| 2.10 | Update `page.tsx`: phase `'desktop'` renders `Desktop`; mobile never advances past `'welcome'`. `isMaximized` already in page state from Phase 1.4, passed as prop. |
| 2.11 | Refactor `MenuBar`: Apple icon menu (About) always left. Default = Finder menus (File/Edit/View/Special). Read active app's `menuItems` overrides from registry via context. |
| 2.12 | Add maximize nudge dialog (shown after first app open) |
| 2.13 | Test: full flow — boot → welcome (no menu bar) → desktop → open placeholder window → drag → close → focus → icon select → menu updates |

### Phase 4: Application Development (Parallel Subagents)
**PRs**: One per app, branching from `feat/mac-os-1984-desktop` (after PR #1 is merged)
**Method**: Each app built by a subagent in an isolated worktree

Each subagent receives a **contract** (see [Subagent Contracts](#subagent-contracts)) defining:
- What the app does
- What component interface to implement
- What the window config looks like
- Where to put the file
- How to register in the app registry

Apps can be built in parallel since they don't depend on each other — only on the foundation.

**App build order priority** (for sequential work if needed):
1. Calculator (simplest — validates the window system)
2. Note Pad (localStorage integration)
3. Finder (static files + download)
4. Scrapbook (blog content rendering)
5. System/Control Panel (diagnostics)
6. Browser (most complex — user mockups needed)
7. World Map (SVG + patterns — travel data needed)
8. Music (TBD scope)

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

## Progress Tracker

### Phase 1: Maximize Mode + Screen Phases
- [ ] `'desktop'` added to ScreenPhase type
- [ ] Welcome screen updated (no menu bar)
- [ ] Welcome → desktop auto-transition in page.tsx
- [ ] `container-type: size` on CRT screen
- [ ] `isMaximized` state in `page.tsx` (passed as props)
- [ ] Chin expand/collapse button on iMac frame (single toggle location)
- [ ] Maximize: hide iMac body/chin/stand, CRTScreen expands to viewport
- [ ] Transition animation (+ reduced motion)
- [ ] Testing (including: mobile stays on welcome)

### Phase 2+3: Window System + Desktop Shell
- [ ] WindowManagerProvider context (open/close/focus/drag/selectIcon — no maximize)
- [ ] `app-registry.ts` with all 8 entries (Coming Soon placeholders, cqw/cqh sizes)
- [ ] Generic Window component (title bar, close box, drag, container query sizing)
- [ ] Drag wired to context, constrained to CRT screen bounds
- [ ] Scrollbar + status bar options on Window
- [ ] Desktop component (crosshatch bg, icon grid, windows layer) — phase === 'desktop'
- [ ] DesktopIcon component (single-click select, double-click open)
- [ ] Placeholder icons for all 8 apps (user provides final SVGs later)
- [ ] page.tsx updated (Desktop on desktop phase, WelcomeScreen on mobile)
- [ ] MenuBar refactored: Apple icon menu + Finder defaults + per-app overrides from registry
- [ ] Maximize nudge dialog
- [ ] Integration test: boot → welcome (no menu bar) → desktop → open → drag → close → focus → select icon → menus

### PR #1 Review
- [ ] PR opened: `feat/pre-app-foundation` → `feat/mac-os-1984-desktop`
- [ ] Reviewed & approved
- [ ] Ready for app branches

### Phase 4: Apps (parallel)
- [ ] Calculator
- [ ] Note Pad
- [ ] Finder
- [ ] Scrapbook
- [ ] System / Control Panel
- [ ] Browser (needs mockups)
- [ ] World Map (needs travel data)
- [ ] Music (needs scope)

### Phase 5: Integration
- [ ] All app PRs merged into `feat/mac-os-1984-desktop`
- [ ] Integration testing passed
- [ ] User provides final 1-bit SVG icons → replace placeholders
- [ ] Merged to `main`

---

## Reference Files

| File | Purpose |
|------|---------|
| `CONTENT-ARCHIVE.md` | Projects, blog posts, skills, timeline — source content for apps |
| `MOBILE-PLAN.md` | Separate plan for mobile iPhone OS 1 experience |
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
