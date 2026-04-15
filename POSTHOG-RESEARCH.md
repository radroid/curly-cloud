# PostHog.com "Desktop OS" Architecture — Research Notes

Reference research on how [PostHog.com](https://github.com/PostHog/posthog.com) implements its desktop-like web experience. Compiled from parallel exploration of the cloned repo. Use this as the input for comparing against `DESKTOP-PLAN.md`.

All file paths below are relative to the **posthog.com** repo (Gatsby site), not this portfolio repo. Line numbers are from commit fetched 2026-04-14.

---

## 0. Executive Summary

PostHog's desktop OS is **not** a new framework — it is a thin layer on top of Gatsby's page router:

- Every Gatsby page is intercepted in `wrapPageElement` and handed to a global **App Provider** (`src/context/App.tsx`, 2588 lines).
- The provider owns a single `windows: AppWindow[]` array in React state. Each window stores its path, position, size, zIndex, minimized flag, and the Gatsby `element` to render inside.
- A custom `<Link state={{ newWindow: true }}>` is the signal that a click should open a new window instead of replacing the focused one. Any Gatsby page can become "window content" with zero per-page changes.
- Dragging, resizing, and snap-to-side are all **Framer Motion** primitives — no `react-rnd` or `react-draggable`.
- Z-index is **not a counter**. It is recomputed so the window array always has contiguous `zIndex = 0..n`.
- Window layouts are **shareable via URL** (positions/sizes are encoded as viewport percentages in a `?windows=…` query param and re-hydrated on load). They are **not** persisted across reloads by default.
- The UI is styled with **Tailwind v3** + a disciplined set of CSS variables, with per-body `data-skin` and `data-wallpaper` variants enabling runtime theme switches without remounting.
- Kea (Redux-ish) is still present but **only manages legacy sidebar state**. The entire desktop is pure React Context.

Key architectural trade-offs to note for our plan:
- **No per-window history stack** — browser back/forward is global, because Gatsby owns the router.
- **Tabs inside a window are a stub** (`WindowTabs` renders literal "TABS").
- **No explicit boot sequence**; a `HourglassSpinner` is defined but unused.

---

## 1. Tech Stack

- **Framework**: Gatsby (not Next.js). Static pages generated from MDX via `gatsby-node.ts` and `gatsby/createPages.ts`.
- **State**: React Context (`src/context/App.tsx`, `src/context/Window.tsx`). Kea is dormant for the desktop.
- **Animation & drag**: [`framer-motion`](https://www.framer.com/motion/) (native `drag`, `useDragControls`, `AnimatePresence`).
- **Menus / primitives**: Radix UI (`@radix-ui/react-menubar`, `react-popover`, `react-scroll-area`, `react-tabs`, `react-portal`, `react-radio-group`).
- **Icons**: `@posthog/icons` package (primary) + a local `OSIcons` SVG library (~74KB).
- **Animations**: Lottie (`lottie-web` via inline `lottieAnimations.ts` plus external `.json`/`.lottie` files in `/static/lotties/`).
- **Fonts**: IBM Plex Sans Variable, Source Code Pro, plus retro fonts (Squeak, Fairytale, Comic Sans) loaded from `/static/fonts/`.
- **Styling**: Tailwind v3 (`tailwind.config.js` — 22KB), `@tailwindcss/container-queries`, `tailwindcss-animated`, `@headlessui/tailwindcss`.
- **Sortable UI** elsewhere: `@dnd-kit/*` (but NOT used for window dragging).

---

## 2. State Management & Window Context

### 2.1 The `AppWindow` data structure

`src/context/Window.tsx:6-63` — each open window is:

```ts
interface AppWindow {
  element: React.ReactNode           // Gatsby page element
  key: string                        // path or custom key
  zIndex: number                     // stacking order (contiguous 0..n)
  path: string                       // current pathname
  position: { x: number; y: number }
  size: { width: number; height: number }
  previousSize: { width: number; height: number }
  previousPosition: { x: number; y: number }
  sizeConstraints: {
    min: { width: number; height: number }
    max: { width: number; height: number }
  }
  fixedSize: boolean
  minimized: boolean
  fromOrigin?: { x: number; y: number }  // animation origin ("zoom from clicked element")
  meta?: { title: string }
  modal?: { type: 'standard' | 'side' | 'floating' }
}
```

### 2.2 Where state lives

All windows live in a single `useState<AppWindow[]>` inside the App Provider (`src/context/App.tsx:1377`). The provider also holds: `siteSettings` (theme, wallpaper — persisted to localStorage), `notifications`, `user`, `search`, etc.

**Windows are NOT persisted across reloads.** Only site settings go to localStorage.

### 2.3 Focused window is derived, not stored

```ts
// App.tsx:1386-1391
const focusedWindow = useMemo(() => {
  return windows.reduce<AppWindow | undefined>(
    (highest, current) => (current.zIndex > (highest?.zIndex ?? -1) ? current : highest),
    undefined
  )
}, [windows])
```

There is no separate "focused id" field — the top-of-stack window IS focused.

### 2.4 Public window actions

| Function         | File:line         | Notes |
|------------------|-------------------|-------|
| `addWindow`      | App.tsx ~1560     | Called by `updatePages()` when a route says `newWindow: true`. Cascades new window +10px from previous, falls back to centered. |
| `closeWindow`    | App.tsx:1497      | Filters window out, then `navigate()`s to the next-highest-zIndex window's path. |
| `bringToFront`   | App.tsx:1518-1528 | Reassigns all zIndex values so the target becomes `windows.length-1` and the rest shift down. |
| `minimizeWindow` | App.tsx           | Flips `minimized: true`; window stays in state. |
| `expandWindow`   | App.tsx           | Toggles maximized (restores `previousSize`/`previousPosition`). |

`closeWindow` calling `navigate()` is important: **closing a window doubles as routing to the next one**, which keeps the URL aligned with the focused window and lets browser back/forward work at all.

### 2.5 URL ↔ window sync

**Sharing layouts via query params** (`App.tsx:1418-1453`): positions and sizes are normalized to viewport percentages and stringified into `?windows=[…]`. On load (`App.tsx:2428-2445`), the first window is rendered immediately and the rest are chained through `navigate(..., { state: { newWindow, savedWindows: rest } })`, using Gatsby's `onRouteUpdate` to progressively hydrate.

**Intercepting navigation** (`updatePages` in `App.tsx:1784-1809`):
```ts
if (existingWindow) bringToFront(existingWindow, element.props.location)
else if (element.props.newWindow || location?.state?.newWindow) setWindows([...windows, newWindow])
else replaceFocusedWindow(newWindow)   // "boring mode"
```

Two modes coexist: **desktop mode** (new window per link) and **boring/website mode** (single-pane site with max-width wrapper).

### 2.6 Provider tree

```
gatsby-browser.tsx
└─ ToastProvider
   └─ UserProvider
      └─ Kea <Provider store={…}>      (dormant for desktop)
         └─ wrapPageElement:
            └─ AppContext.Provider (App.tsx — the big one)
               └─ Wrapper (components/Wrapper/index.tsx)
                  ├─ TaskBarMenu            (top menu bar)
                  ├─ constraintsRef
                  │  ├─ Desktop             (wallpaper + icons + screensaver)
                  │  └─ AnimatePresence
                  │     └─ windows.map(w => <AppWindow item={w} />)
                  ├─ WebsiteFooter (if websiteMode)
                  └─ CookieBannerToast
```

---

## 3. Window Chrome, Drag, Resize

### 3.1 Anatomy of `AppWindow`

`src/components/AppWindow/index.tsx` (1033 lines) renders:

```tsx
<motion.div                                        /* container */
  dragControls={controls}
  dragListener={false}
  dragConstraints={constraintsRef}
  animate={{ x: Math.round(position.x), y: Math.round(position.y), width, height, scale: 1 }}
  initial={{ scale: 0.08 }}
  exit={{ scale: 0.005 }}
  transition={{ duration: 0.2, ease: [0.2, 0.2, 0.8, 1] }}
  className={focused ? 'shadow-2xl border-primary' : 'shadow-lg border-input'}
>
  {!minimal && !compact && (
    <div onPointerDown={(e) => controls.start(e)}>  {/* title bar initiates drag */}
      <MenuBar /> <Title /> <TrafficLights />
    </div>
  )}

  <div ref={contentRef}>
    <Router>{item.element}</Router>                 {/* regex-routed Gatsby page */}
  </div>

  {/* 5 resize handles: right, left, bottom, br, bl */}
</motion.div>
```

### 3.2 Drag — Framer Motion

- `useDragControls()` is owned by the window. The **title bar alone** calls `controls.start(e)` on pointerdown — body isn't draggable.
- Position is stored in React state, then passed as `animate={{ x, y }}` — Framer Motion animates to it (0.2s) instead of sticking 1:1 to the cursor. This smooths out snap-backs.
- Bounds: `dragConstraints={constraintsRef}` (the desktop wrapper's rect).
- **Snap-to-side** (`AppWindow/index.tsx:303-338`): while dragging, if `position.x + info.offset.x < -50`, a blue overlay (`border-blue bg-blue/40`) previews a half-screen snap. On `onDragEnd`, `handleSnapToSide` actually resizes.

### 3.3 Resize — also Framer Motion

Five separate `<motion.div>` handles with `drag="x"` or `drag="y"` (or both for corners), `dragMomentum={false}`, and an `onDrag` that calls `handleDragResize`. Size is clamped to `sizeConstraints.min/max`. Left-edge resize is special: it also shifts `position.x` to keep the right edge pinned (`index.tsx:974-976`).

### 3.4 Focus

Clicking anywhere on a window triggers `handleMouseDown` (`index.tsx:401-408`). If the window is path-backed, it `navigate()`s to that path; otherwise it calls `bringToFront(item)` directly. Navigating fires `updatePages`, which sees the window already exists and calls `bringToFront` anyway — so routing and focus are entangled on purpose.

### 3.5 Close / minimize / maximize animations

- **Close**: `closing=true` → scale 0.005 over 230ms → `AnimatePresence.onExitComplete` → `closeWindow`. If `fromOrigin` is set, it animates back to the clicked element (captured via `lastClickedElementRect` in `App.tsx:2033-2041`).
- **Minimize**: emits a custom event so the taskbar icon can "receive" the window.
- **Maximize**: immediate size/position swap, interpolated by Framer Motion's normal `animate` transition (no explicit maximize keyframes).

### 3.6 Performance notes

- Content only renders once the entry animation completes (`{(!animating || isSSR || autoHeight) && <Router>…</Router>}`). Prevents layout thrash during the pop-in.
- If a window animation exceeds 700ms, PostHog capture is called — telemetry on slow animations with an intent (currently commented out) to offer "disable animations".
- No iframes, no portals, no virtualization. Everything is in-tree.

### 3.7 Things that aren't implemented

- **Tabs** — `src/components/WindowTabs/index.tsx` literally returns `<div>TABS</div>`.
- **Address bar as URL input** — `OSChrome/AddressBar.tsx` is a Radix Select for category filters, not a URL bar.
- **Per-window history** — back/forward is global via Gatsby's router.

---

## 4. Desktop Shell (Wallpaper, Icons, Dock, Taskbar, Menu Bar)

### 4.1 `Wrapper` (110 lines)

`src/components/Wrapper/index.tsx` is the glue between the App Provider and the visual layers:

```tsx
<div className={websiteMode ? 'max-w-7xl mx-auto …' : 'fixed inset-0 size-full'}>
  {!compact && <TaskBarMenu />}
  <div ref={constraintsRef}>
    <Desktop />
    <AnimatePresence>
      {windows.map(item => <AppWindow item={item} chrome={item.key !== 'search'} />)}
    </AnimatePresence>
  </div>
  {websiteMode && <WebsiteFooter />}
  <CookieBannerToast />
</div>
```

`constraintsRef` is the drag boundary for every window. Closing-all-windows plays a single "hogzilla swipe" Lottie animation over the whole thing.

### 4.2 `Desktop` component (844 lines)

`src/components/Desktop/index.tsx` renders:

1. **Wallpaper**: a single `<div className="fixed inset-0 -z-10 {getWallpaperClasses()}" />` with up to 8 optional wallpaper layers (Hogzilla, Startup Monopoly, Office Party, Keyboard Garden, 2001 Bliss, Parade, Coding at Night, Action Figure). Each is a `hidden` div revealed by `wallpaper-*:flex` classes derived from `body[data-wallpaper="…"]`. Images are Cloudinary-hosted with `clamp()` for responsive scaling.
2. **Desktop icons**: a `grid sm:grid-cols-4 grid-cols-3` of `DraggableDesktopIcon`. Positions are stored in component state, persisted to `localStorage['desktop-icon-positions']` on drag end. On viewport resize, positions are revalidated and reset if out of bounds.
3. **Two app registries** — hardcoded arrays:
   - `useProductLinks()` — 8 items (home, products, pricing, docs, customers, …).
   - `apps` — 5 items including Trash.
4. **Inactivity → screensaver** via a `useInactivityDetection()` hook.
5. **Right-click context menu** with "Display Options", "Keyboard Shortcuts", "Reset Icons".

### 4.3 `DraggableDesktopIcon` (107 lines)

Framer-motion `drag` + bounds, plus a **click-vs-drag disambiguator**: if total drag distance < 5px it's treated as a click. On active drag: `scale: 1.1, rotate: 2`. Mobile: `drag={!isMobile}`.

### 4.4 `TaskBarMenu` (488 lines) — Mac-style top menu bar

`src/components/TaskBarMenu/index.tsx` + `menuData.tsx`:
- Built on **Radix `@radix-ui/react-menubar`**.
- `menuData.tsx` is a big static JSX tree assembled from `docsMenu`, `handbookSidebar`, and product nav constants.
- Mobile-aware: `processMobileNavItems()` flattens deep submenus; items can declare `mobileDestination` for a different mobile URL or `mobileLink` to collapse a whole menu into a single link.
- On the right: **active windows count** button that opens `ActiveWindowsPanel`, a **Popover SearchUI**, and an account menu Tooltip.

### 4.5 `ActiveWindowsPanel` (152 lines)

A Radix-powered side panel that lists all open windows with their titles, hover-to-reveal close buttons, a "Close all" button, and a "Share your windows" card that copies the layout URL (`App.tsx:1987 — copyDesktopParams()`).

### 4.6 `Dock` (102 lines) — **mobile only**

Hidden on desktop (`md:hidden block`). Two collapsible folders ("Products" / "Apps") showing 2×2 previews and expanding into a 3-column overlay grid. Framer-motion pop-in with origin anchored to the tapped folder. Used as the mobile replacement for desktop icons + taskbar.

### 4.7 `Screensaver` (111 lines)

Inactivity-triggered full-screen black overlay with a bouncing Lottie logo (`/lotties/loading.json`) that collides off the viewport edges. Dismissed on any mousemove/click. Can be disabled or previewed from Display Options.

### 4.8 Boot / loading

There is **no explicit boot sequence**. `HourglassSpinner.tsx` (90 lines) is a custom SVG hourglass with CSS sand-drain animation, but grep found zero call sites. The inlined `lottieAnimations.ts` (1669 lines) contains two flavors of the same hourglass as raw Lottie JSON — also unused. So PostHog defined a boot metaphor and never wired it in.

### 4.9 Mobile & responsive

- `isMobile`: `window.innerWidth < 768` (App.tsx:1363).
- `compact`: small-viewport flag that **disables TaskBarMenu and Screensaver** entirely.
- `websiteMode`: alternative UX — centered max-width layout, footer, no desktop metaphor, no drag. User-toggleable, persisted to `siteSettings.experience ∈ {'posthog','boring'}`.

---

## 5. Apps & Content Wiring

### 5.1 There is no formal "app registry"

Despite the naming, apps are just entries in two hardcoded arrays in `src/components/Desktop/index.tsx`. Each `AppItem` has:

```ts
interface AppItem {
  label: string
  Icon: ReactNode                  // usually <AppIcon name="…" />
  url?: string                     // if present → Gatsby link
  onClick?: () => void             // if present → custom action (chat, search, game)
  source: 'desktop'
  external?: boolean
}
```

Apps without a URL (`Ask a question` calls `openNewChat({ path: 'ask-max' })`, `HogWars`, `HogPaint`, Search) use `onClick` handlers that call App-context methods. This is how interactive, non-content apps coexist with content pages in the same UI.

### 5.2 How a Gatsby template ends up inside a window

The flow is counterintuitive — **templates don't wrap themselves in a window**. The window wraps them:

1. `gatsby-browser.tsx:41` — `wrapPageElement({ element, props: { location } })` returns `<Provider element={element} location={location}><Wrapper /></Provider>`.
2. The Provider captures `element` and, on route change (`updatePages`), decides whether to `addWindow`, `bringToFront`, or `replaceFocusedWindow`.
3. `Wrapper` renders `windows.map(w => <AppWindow item={w} />)`.
4. Inside `AppWindow`, a local `Router` (`AppWindow/index.tsx:79-122`) pattern-matches `item.path` to decide which template to render:
   ```ts
   if (/^\/questions/.test(path)) return <Inbox {...props} />
   if (/^\/handbook|^\/docs\/(?!api)|^\/manual/.test(path) && props.data?.post) return <Handbook {...props} />
   if ((props.pageContext?.post || /^posts/.test(path)) && props.data) return <BlogPost {...props} />
   // …
   ```

   This inner routing is needed because the same `element` (what Gatsby gave us) may need different chrome per content type.

### 5.3 Custom `<Link>` is the new-window signal

`src/components/Link/index.tsx:22` — wraps Gatsby `<Link>` and forwards `state={{ newWindow: true }}` when required. Context-menu includes:
- Open in new PostHog window
- Open in new browser tab
- Copy link

`AppIcon` uses this by default so any desktop icon opens a fresh window:
```tsx
<Link to={url} {...(external ? { externalNoIcon: true } : { state: { newWindow: true } })} />
```

### 5.4 Gatsby does NOT inject window metadata

`gatsby/createPages.ts` maps MDX frontmatter to templates but does not emit any window-specific fields (title, icon, default size, position). All window defaults are decided at runtime inside the provider, with per-path overrides kept in an `appSettings` object in `App.tsx` (e.g., `/fm` is fixed-size).

### 5.5 Menus / sidebars live **inside** page content

`src/menuItems/`, `src/navs/`, `src/sidebars/`, `TreeMenu` — none of these are desktop-level. They are rendered inside specific templates (Handbook sidebar, docs tree) and are unaware of windowing.

### 5.6 Icons

- `PRODUCT_ICON_MAP` in `src/components/OSIcons/AppIcon.tsx:17-201` is the single source of truth.
- Each icon has `{classic, default}` (or only `default`) Cloudinary URLs.
- Active skin is read from `document.body.getAttribute('data-skin')` so classic/modern can be swapped without JS state churn.
- Fallback SVG icons live in `src/components/OSIcons/Icons.tsx` (74KB); primary icons come from the `@posthog/icons` npm package.

---

## 6. Styling & OS Primitives

### 6.1 Theming model (three tiers)

- `data-scheme="primary|secondary|tertiary"` on containers declares the local color environment.
- `data-skin="modern|classic"` on `body` swaps the aesthetic (classic lightens accents).
- `data-wallpaper="keyboard-garden|hogzilla|…"` on `body` toggles wallpaper layers.

Variants are registered in `tailwind.config.js:474-485`:
```js
addVariant('skin-modern', 'body[data-skin="modern"] &')
addVariant('skin-classic', 'body[data-skin="classic"] &')
addVariant('wallpaper-keyboard-garden', 'body[data-wallpaper="keyboard-garden"] &')
// …
```

So you can write `wallpaper-hogzilla:flex hidden` and get runtime wallpaper switching without remounting.

### 6.2 Colors as RGB triples

CSS vars in `src/styles/global.css:133-350` use space-separated RGB triples (e.g., `--bg: 253 253 248`) so Tailwind can mix alpha: `rgb(var(--bg) / <alpha-value>)`. Dark mode is `darkMode: 'class'` — the class is set on `body` in `gatsby-browser.tsx:25`.

Palette: light-1…light-12 (tonal ramp) + named accents (orange, burnt-orange, creamsicle, fuchsia, lime-green, teal, seagreen, sky-blue) + button-specific colors (`button`, `button-shadow`, `button-dark`) used for the beveled look.

### 6.3 Fonts

IBM Plex Sans Variable (UI), Source Code Pro (code), plus retro **Squeak**, Fairytale, Computer Modern, Comic Sans — loaded locally from `/static/fonts/`. `-webkit-font-smoothing: antialiased` on WebKit, `auto` on Firefox. **No bitmap fonts** — the retro feel comes from typography + bevels, not pixelation.

### 6.4 OS primitives inventory

| Component      | Purpose                                          | Notable implementation |
|----------------|--------------------------------------------------|------------------------|
| `OSButton`     | Buttons with beveled 3D effect                   | **Nested-span trick**: outer `bg-button-shadow`, inner `bg-orange` with `translate-y` on hover/active simulates press. Negative margins overlap the shadow layer. |
| `OSFieldset`   | `<fieldset>` with styled legend                  | Legend uses negative margin + matching bg to sit on the border. |
| `OSForm`       | input/select/textarea/Combobox/field/multi-select| Consistent variable-driven borders and bg. Combobox is the largest (~11KB). |
| `OSList`       | Icon + label + URL list                          | `divide-y divide-primary`. |
| `OSQuote`      | Customer quote card                              | Nested borders on the avatar frame. |
| `OSTable`      | Data table with pagination & group-by            | Built-in Radix ScrollArea + OSButton pagination. |
| `OSTabs`       | Horizontal/vertical tabs                         | Measures container width at runtime and wraps into multiple rows instead of using media queries. |
| `OSIcons`      | SVG icon library                                 | BaseIcon wrapper, `fill="currentColor"`. |
| `BorderWrapper`| Simple `border-y` section                        | Minimal. |
| `OSChrome/HeaderBar` | Window-content nav bar (search, back/forward, TOC, cart) — distinct from the AppWindow title bar | Uses `data-scheme="secondary"`. Shift+F opens search on the focused window. |

### 6.5 Window frame styling is minimal

Borders: `border rounded`. Shadows: `shadow-2xl` (focused) or `shadow-lg` (unfocused). No pixel-perfect beveling on the frame itself — **the OS feel comes from the buttons, typography, and small border radii**, not window chrome.

### 6.6 `safelist.txt` (632 lines)

Protects dynamic classes from Tailwind purge:
- SVG `fill-*` colors (`[&_.bg-front]:fill-[yellow|…]`) because SVG children are named after semantic fills applied at runtime.
- Container query variants (`@xs:hidden`, `@2xl:basis-3/12`, …) generated from runtime measurements.
- `color-mix()` gradients: `from-[color-mix(in_srgb,rgb(var(--bg))_0%,transparent)]`.

### 6.7 Plugins

`@tailwindcss/forms`, `@tailwindcss/typography`, `@tailwindcss/container-queries`, `@headlessui/tailwindcss`, `tailwindcss-animated`. A custom `container-size` utility adds `container-type: size`.

### 6.8 No CRT / dither / scanline effects

Despite the retro theme, there are **no visual filters**. No CRT curves, no scanlines, no dithering. The retro vibe is typography + bevels + tight border radii + strong primary colors. Custom play-button cursor via SVG data URI is the only unusual visual flourish.

---

## 7. Patterns & Gotchas Worth Stealing (or Avoiding)

**Worth adopting:**
1. **Provider-owns-element, not page-owns-chrome**. Gatsby's `wrapPageElement` gives the provider the raw element; the provider decides whether to open a window or replace the focused one. Pages don't know they're inside a window. This decouples cleanly.
2. **`<Link state={{ newWindow: true }}>` as the one-bit opt-in**. A tiny surface area in the rest of the codebase.
3. **Contiguous zIndex reshuffle** on every bringToFront. No counter, no overflow, no "highest + 1" drift.
4. **Percentage-based layout sharing** in URL. Survives different viewport sizes without looking broken.
5. **Closing a window = navigate to the next one**. Keeps the URL, focus, and stack in sync for free.
6. **`data-skin` / `data-wallpaper` on body + Tailwind `addVariant`** for runtime theme switching without JS re-renders or CSS-in-JS.
7. **Click-vs-drag disambiguator** (5px threshold) on desktop icons.
8. **Inner router per AppWindow** to pick the chrome based on path regex rather than adding per-template wrappers.
9. **Custom menuing via Radix Menubar** — avoids inventing a menu system.
10. **Lazy content mount** — only render window contents after the pop-in animation, avoiding layout jank.

**Gotchas / likely pain points:**
1. **No per-window history stack**. Browser back/forward is global. If this matters for our plan (e.g., a "Finder" window with its own navigation), we'd need to invent per-window history.
2. **Tabs are unimplemented**. `WindowTabs` is a stub. Don't assume the codebase has a reference.
3. **Window state is not persisted across reloads**. Only layouts shared via URL survive. If we want "restore session", we have to add it.
4. **App.tsx is 2588 lines**. The provider does windows, settings, notifications, user, search, chat, and layout sharing. Without discipline, our equivalent becomes unmanageable.
5. **Kea is dead weight** for the desktop — still in the tree, still initialized, but only touching sidebar UI state. If we go Context-only from day one we avoid the split.
6. **Boot sequence is promised but not delivered** — HourglassSpinner and the inline Lottie JSON are dead code. A boot sequence needs real wiring.
7. **`lottieAnimations.ts` inlines ~1700 lines of animation JSON**. Bundle cost. We probably want external `.lottie` files instead.
8. **Snap-to-side only snaps left**, from the code seen. Not a symmetric implementation.
9. **The inner `<Router>` inside AppWindow** is a regex wall. Adding a new template type means editing that file.
10. **`HeaderBar` (429 lines)** lives inside window content, not in window chrome. Title bar and HeaderBar are two different things — easy to confuse.

---

## 8. Key File Index (posthog.com repo)

| Area | File | Lines |
|------|------|-------|
| Global app state | `src/context/App.tsx` | 2588 |
| Window type & per-window context | `src/context/Window.tsx` | 201 |
| Kea layout logic (legacy) | `src/logic/layoutLogic.ts` | 117 |
| Window component | `src/components/AppWindow/index.tsx` | 1033 |
| Header bar inside content | `src/components/OSChrome/HeaderBar.tsx` | 429 |
| Address bar (Radix Select) | `src/components/OSChrome/AddressBar.tsx` | 40 |
| Tabs (stub) | `src/components/WindowTabs/index.tsx` | 4 |
| Desktop shell | `src/components/Desktop/index.tsx` | 844 |
| Dock (mobile) | `src/components/Desktop/Dock.tsx` | 102 |
| Draggable icons | `src/components/Desktop/DraggableDesktopIcon.tsx` | 107 |
| Hourglass (unused) | `src/components/Desktop/HourglassSpinner.tsx` | 90 |
| Inline Lottie (unused) | `src/components/Desktop/lottieAnimations.ts` | 1669 |
| Taskbar side panel | `src/components/ActiveWindowsPanel/index.tsx` | 152 |
| Top menu bar | `src/components/TaskBarMenu/index.tsx` | 488 |
| Top menu data | `src/components/TaskBarMenu/menuData.tsx` | 200+ |
| Composition wrapper | `src/components/Wrapper/index.tsx` | 110 |
| Screensaver | `src/components/Screensaver/index.tsx` | 111 |
| App icon map | `src/components/OSIcons/AppIcon.tsx` | 20KB |
| Fallback SVG icons | `src/components/OSIcons/Icons.tsx` | 74KB |
| Tailwind config | `tailwind.config.js` | 22KB |
| Global styles | `src/styles/global.css` | 23KB |
| Tailwind safelist | `safelist.txt` | 632 |
| Gatsby wrapPageElement | `gatsby-browser.tsx`, `gatsby-ssr.js` | — |
| Page creation | `gatsby-node.ts`, `gatsby/createPages.ts` | — |
| Custom Link | `src/components/Link/index.tsx` | — |

---

*Notes compiled 2026-04-14 from a shallow clone at `/tmp/posthog-research/posthog.com`. Line numbers are a snapshot — verify against current HEAD before relying on specific offsets.*
