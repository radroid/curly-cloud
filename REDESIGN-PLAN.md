# Redesign Plan: visual refresh of `/`

> A persistent plan for turning the resume page from a text wall into a visual, motion-led site. The
> reference is saifullah.dev. Humans and agents should treat this file as the source of truth for the
> redesign and update it when a decision changes. `CLONE-PLAN.md` still governs architecture and privacy.
>
> **Status: draft for Raj's review.** Nothing is built yet. Branch: `feat/visual-refresh` (off `origin/main`).

## 0. What we measured (2026-09-26)

**curlycloud.dev today**

| | Desktop 1440 | Mobile 390 |
|---|---|---|
| Page height | 9,806 px | 14,686 px (17.4 screens) |
| Words in `<main>` | 2,364 | same |
| Biggest block | Experience: 857 words | Experience: 4,372 px tall |

Word counts by section: Hero 67 · How-to-read 50 · About 89 · Experience 857 · Builds 421 · Community 152 ·
Skills 120 · Skill filter bar 69 · Education 37 · Fit 52 · Agents 161 · How it works 188 · Contact 24 · Footer 77.

**Worker bundle:** 2,266.66 KiB gzipped, measured with `wrangler deploy --dry-run` on the main build. The
limit is 3 MiB (3,072 KiB), so there is about 805 KiB of headroom.

**Lighthouse mobile, live site:** Performance **46**, Accessibility 100, Best Practices 82, SEO 100. LCP is
5.3 s, TBT 1,860 ms and CLS 0.

> **Finding, outside the redesign.** Almost all of that TBT comes from Cloudflare's bot-detection script,
> `/cdn-cgi/challenge-platform/scripts/jsd/main.js`. The zone injects it into every HTML response, and it
> costs about 3.5 s of main-thread work on simulated mobile, including one 1.8 s long task. With that URL
> blocked, the same page scores **Performance 93, Best Practices 100, LCP 3.0 s, TBT 30 ms**. The fix is a
> Cloudflare dashboard setting (JavaScript detections / Bot Fight Mode on the zone), not code. **It's your
> call.** PRs are measured on `bun run preview`, which doesn't inject that script, so we see the app's own
> cost.

**saifullah.dev, the reference**

- Next.js, **three.js, GSAP**, a 208 KB `.glb` face model and a matcap. About 934 KB transferred.
- The enter screen is a modal gate: a 0→100 % counter in condensed display type, `SYSTEM_READY`,
  `ENTER` / `VIBES ON` (music), and a `PERFORMANCE TIER` choice of HIGH / MED / SAVER. On mobile it hides
  everything until loading finishes.
- The home page is one viewport with no scroll. It has a point-cloud head that rotates and reacts to the
  cursor, huge condensed `CREATIVE DEVELOPER` type, an `[ INFO_LOG ]` tagline, a marquee of status chips
  (`CORE_ID`, `AVAILABILITY`, `RENDERING`), a `DEVELOPER STATS` panel with bars and a
  `> ACTIVE_STACK:` log (including real FPS and DPR), a `[1] HOME` bracket-numbered menu dock, and a
  footer with an email CTA and local time.
- The About page has a sticky dithered portrait, text that brightens word by word on scroll, and skills as
  hex-indexed chips grouped by `SECTOR_01`.

**Worth taking:** the typographic system (condensed display, mono labels, bracket indices), one strong
hero visual, a marquee, numbers shown as instruments, and the persistent footer.
**Not worth taking:** the content gate, music, the 1 MB of 3D, and a one-screen home that hides the content.

## 1. Design direction: "the curly cloud"

**Idea.** The resume becomes an *instrument panel for an AI engineer*. The first screen is a dark stage:
Raj's curly-haired avatar is drawn as a live **point cloud**, which is literally a *curly cloud*.
**40 brighter points in it are the 40 public sources the clone can cite.** Hover one to see its label;
click it to jump to that resume line. The hero is the knowledge base, so it replaces the "How to read
this" explainer.

> Probe (throwaway, not product code): `docs/redesign/probe-hero-desktop.jpg` shows the avatar sampled into
> about 9k points on the pine stage, with type and marquee. `docs/redesign/probe-type.jpg` compares display
> fonts. The avatar reads well as a cloud: curls, beard, cup and collar all hold. The eyes and nose need
> edge-weighted sampling.

**Palette.** No new hues; the brand palette stays.

- **Stage** (hero, marquee, how-it-works, contact): a darker pine. There is one new token pair,
  `--color-night` (`#0b2a26`) and `--color-night-deep` (`#071d1a`).
- **Points:** `term-accent` mint. **Source stars:** `sun`. **Cited or flared:** `coral`.
- **Coral for small text** needs two more tokens (§5): `--color-coral-ink` (`#ad4236`) on light surfaces and
  `--color-coral-glow` (`#ec8374`) on the stage. Base `coral` stays for dots, ticks, rings and fills.
- **Reading surfaces** (work, fit, agents) stay on `paper` with `ink`, so long lines stay easy to read and
  print.

**Type.**

- **Display:** **Anton** 400. It's condensed, set in caps with `text-transform` (the DOM keeps proper case,
  so screen readers say "Raj Dholakia"). It's used for the name, section titles, numbers and the marquee.
- **Micro-copy:** **IBM Plex Mono**, which is already loaded. Uppercase with 0.14em tracking for bracket
  nav, labels and `> key: value` log lines.
- **Body and resume lines:** **IBM Plex Sans**, unchanged.
- Alternatives are in the probe: Plex Sans Condensed 700 (same family, less punch) and Archivo at width 62.
  All three self-host through `next/font`, so no CSP change.

**Grammar.**

- Bracket indices: `[02] WORK`.
- Mono keys on chips: `NOW`, `BASE`, `STACK`.
- Hairline rules.
- Numbers as counters and bars.
- Every collapsible block shows a visual summary plus a `▸ 07 LINES` disclosure.

**Honesty rule.** Every number or claim on screen comes from one of three places:

- `content/resume.ts`.
- A count derived from it, such as 32 lines or 40 sources.
- An architecture fact in `CLONE-PLAN.md`.

Measured values (FPS, local time) are real. A unit test enforces this for stats (§6). **No `resume.ts`
edits are planned.** The items that would need your copy approval are listed in §9.

**Layout.**

- **Desktop:** the hero stage is full-bleed across both columns, and the top bar floats over it in the
  dark tone. Below the hero is today's two-column grid, with the page on the left and the **Ask panel
  sticky on the right**. The panel starts at the Work section instead of at y=0. The hero has its own
  prompt bar that sends to the panel and scrolls it into view. (The alternative is to keep the panel from
  the first pixel; see §9.)
- **Mobile:** the hero stage fills the first screen: cloud, name, tagline, prompt bar. A bottom
  **dock** replaces the Ask FAB, with the current section and menu on the left and `Ask Raj` on the right.

## 2. Section by section: before → after

"In DOM" means the full citable text is still rendered as HTML inside a closed `<details>`. It is indexed,
found by find-in-page in Chromium, printed, and opened by citations.

| # | Section | Before | After: visual | Text on screen (target) |
|---|---|---|---|---|
| 0 | **Intro** (new) | none | Boot overlay: Anton `%` counter, 3-line system log, HIGH / MED / SAVER chips, `Enter` (details below) | ~15 words, gone in ≤1.2 s |
| 1 | **Hero** | Name, 23-word pitch, "Now:" line, 3 CTAs, 4 links (67 words) | Curly-cloud canvas with 40 source stars. `RAJ DHOLAKIA` in Anton. `[ INFO_LOG ] LLM features that make it past the demo.` (a substring of `pitch`). **Prompt bar** "Ask my AI clone anything…" with placeholder cycling through the existing `STARTERS`. Two quiet links: `Check my fit →` `Connect your agent →`. Right side (desktop): system log `> corpus: 40 public sources · 32 citable lines`, `> retrieval: bm25 ∥ bge-m3 → rrf → rerank`, `> guard: streaming verbatim check`, `> render: HIGH · 60 fps` (measured) | ~40 words, including the required AI and logging disclosure under the prompt bar |
| — | **How to read** | 50-word explainer card | **Removed.** The stars show the idea; one mono line under the cloud: `EVERY LIGHT IS A LINE THE CLONE CAN CITE` | 9 words |
| 2 | **Marquee** (new) | "Now: …" sentence | Looping chips: `NOW` Lead Software Developer @ Eddy Solutions · `BASE` Toronto, ON · `FOCUS` MCP · RAG · Evals · Agents · `STACK` TypeScript / Python / C# · `SINCE` 2020 · `AGENTS` /mcp · Streamable HTTP · `COMMUNITY` Open Invite. Pause button. | chips only |
| 3 | **About → Profile band** | 3 paragraphs (89 words) | Left: a 3-node path `NUCLEAR ENGINEERING → SOFTWARE → GENAI INFRA` (from the summary) with three principle chips: `DEEP DIVES` `RELIABILITY FIRST` `CLAUDE CODE DAILY`. Right: the **numbers** (below). `▸ Read the summary` holds the 3 paragraphs. The block keeps `id="r-summary"`. | ~20 words + numbers |
| 3b | **Numbers** (new) | Numbers buried in bullets | 6 instruments, each linking to its source line: **6** years shipping · **150,000+** devices · **80+** weekly processes → agents (with a **60%** bar) · **15 → 2** min deploys (a shrinking bar) · **12** developers led · **40+** regulatory documents grounded. Counters count up once in view. | labels only |
| 4 | **Work: skill lens** (was Skills + sticky filter bar) | 6 groups × 26 long labels (120 words) + a 29-chip filter bar (69 words) | A **skill map**: 6 sectors (the `resume.ts` groups), short-label chips with a line-count pip. **Hover or focus** lights up the matching lines and puts ticks on the timeline bars. **Click** sets the filter, opens matching roles and dims the rest, and a sticky pill `FILTER: MCP · 5 LINES ✕` appears. `▸ Full skill list` keeps the long labels in DOM under `id="r-skills"`. | chips only |
| 4b | **Work: timeline** (was Experience, 857 words) | 5 role blocks, 21 bullets, all expanded | **Desktop:** a swimlane chart from 2016 to now with 4 lanes: EDUCATION (3 bars), ROLES (5), BUILDS (2), COMMUNITY (1). It tells the nuclear → software → AI arc at a glance; the Aug 2021–May 2022 gap is filled by the AI certificate. Clicking a bar opens that role row. **Below it: role rows**, each collapsed to `[01] EDDY SOLUTIONS` (Anton) · role · period · one headline metric chip (e.g. `150,000+ DEVICES`) · top 3 tags · `▸ 07 LINES` · a coral `2 CITED` badge after an answer. Expanded, a row shows the blurb and the original bullets with "Ask about this". **Mobile:** a slim, non-interactive mini-swimlane, then the rows. | ~15 words per role |
| 4c | **Independent builds** (421 words) | 2 cards of full bullets | Two **project cards**. *Regdocs* gets the existing hit@8 chart, now drawn on scroll, with chips `40+ DOCS` `14 SAFETY AREAS`. *Job search* gets a mini animated pipeline: `3 NAMED VECTORS → RRF → TOP 10`. Stack chips on both. Bullets sit behind `▸ 05 LINES`. | ~15 words per card |
| 4d | **Community** (152 words) | Card with paragraphs | An **Open Invite ticket**: perforated edge and notches (CSS mask), a stub reading `OPEN TO EVERYONE`, event names *Cake Picnic* and *Sip & Bedazzle* from the bullet, stack chips `NEXT.JS` `WORKERS` `D1` `STRIPE` `GOOGLE WALLET`, and an `openinviteto.ca ↗` link. Lines sit behind `▸ 03 LINES`. | ~20 words |
| 4e | **Education** (37 words) | 3-row list | Shown as the EDUCATION lane on the timeline, plus a compact 3-chip strip that keeps `id="r-education"` and the full credential text. | ~20 words |
| 5 | **Fit check** (52 words + form) | Paragraph + 4 fields | One-line mono subtitle. The form opens as **role title + JD textarea**; company and culture sit behind `+ More fields`. The loading steps become a system-log ticker with a progress bar. Results: a big verdict badge, and technical and culture **meters** (animated bars instead of dots). Evidence chips unchanged. **API and logic untouched.** | ~12 words before use |
| 6 | **Agents** (161 words) | 2 paragraphs, terminal card, 6 tool cards | One line: `Point your screening agent at /mcp.` The terminal card stays as is (endpoint, tabs, copy). Tools become 5 mono chips, `ask_raj()` and the rest, with the description on focus or click. The key paragraph becomes `> anonymous: daily limit · higher limits: email me` (the mailto stays). | ~25 words |
| 7 | **How the clone works** (188 words) | 5 text cards + terminal CTA | An animated **pipeline**: `KNOW → FIND → ANSWER → GUARD → MEASURE`, with a query dot travelling the line. Each node has a 3–6 word label, such as FIND `bm25 ∥ bge-m3 → rrf → rerank`. The full sentence opens on focus or click. The Terminal and Mac ’84 card stays. | ~35 words |
| 8 | **Contact** | Green card | A giant Anton `SAY HELLO` with a magnetic email button, LinkedIn, GitHub, and `Ask the clone first`. | ~10 words |
| 9 | **Footer** | Privacy note + links | **Privacy note unchanged and visible** (`#privacy`, a CLONE-PLAN requirement). Links: Terminal · Mac ’84 · llms.txt · MCP · Save as PDF · Render: HIGH ▾. | unchanged note |
| — | **Persistent footer bar** (new, desktop) | none | Fixed at the bottom-left of the page column after the hero: `SAY HELLO raj9dholakia@gmail.com` · `LOCAL TIME TORONTO 2:32 A.M.` It hides while Contact is in view. On mobile these move into the dock menu. | ~8 words |
| — | **Top bar** | Name, For agents, Mac ’84, Website ⇄ Terminal | Mono wordmark + **bracket nav** `[1] HOME [2] WORK [3] FIT [4] AGENTS [5] CONTACT` with scroll-spy highlight, then Mac ’84 and the `ModeSwitch` (unchanged; `tone="dark"` over the hero, `light` after). | same |
| — | **Ask panel** | Unchanged | **Logic untouched** (SSE, signed turns, starters, storage). Restyle only: a mono header `ASK RAJ · AI CLONE` and starters as `[01] …` rows. It stays in `ask-panel.tsx` because `lib/rag/injection.test.ts` parses `STARTERS` from that file. | same |

**Net effect:**

| Measure | Now | Target |
|---|---|---|
| Words visible before any expansion | ~2,360 | ~450 |
| Desktop page height | ~9,800 px | ~5,500 px |
| Mobile page height | 17.4 screens | ~8 screens |

All 32 lines and 40 sources stay in the HTML.

### Boot overlay details

- **When it shows:** once per session. It's skipped for reduced motion, on return visits within the
  session, and in print. A tiny inline `<head>` script sets `data-boot="skip"` before first paint, so it
  never flashes. The CSP has no `script-src`, so inline scripts are allowed.
- **Progress:**
  - The % tracks real milestones: fonts ready, cloud renderer chunk loaded, avatar sampled.
  - It has a 600 ms floor and a 1.4 s cap.
  - It auto-enters at 100 %.
  - `Enter` skips.
  - Touching a tier chip pauses auto-enter until you press Enter.
- **Page underneath:** the page is fully painted under the overlay at opacity 1 (the hero `<h1>` is the LCP
  element), and the overlay leaves with a `clip-path` wipe. If JS never runs, a CSS fallback animation
  removes the overlay at 2.5 s.
- **Tiers:**
  - **HIGH:** ~9k points, DPR ≤ 2, 60 fps.
  - **MED:** ~4k points, DPR 1, 30 fps cap.
  - **SAVER:** static poster, and all motion off.
  - **Default:** auto from reduced motion, Save-Data, WebGL support, pointer type, cores and memory.
    It auto-downgrades if the measured frame rate stays under 40 fps for 2 s.
  - The choice is saved in `localStorage` and can be changed later from the footer.
- **Not included:** no music.

## 3. Motion list

| # | Motion | Trigger | Technique | Reduced motion / SAVER |
|---|---|---|---|---|
| M1 | Boot counter + wipe | First visit in session | CSS + rAF counter, `clip-path` | Skipped entirely |
| M2 | Curly cloud: idle drift, cursor parallax (±12°), cursor "brush" that pushes points and springs back | Always while in view | WebGL2 points (§4); paused off-screen (IntersectionObserver) and on hidden tabs | Static poster image, same box |
| M3 | Source stars: hover label, click to line, coral flare when an answer cites them | Pointer; `done` event | Same renderer; label is an HTML chip | Poster only; the same lines are reachable in the page |
| M4 | Hero text: masked line rise | Boot end or first paint | CSS keyframes | Static |
| M5 | Prompt bar placeholder cycling through `STARTERS` | Idle, empty input | Interval text swap with fade | First starter, static |
| M6 | Marquee | Always | CSS `translateX` loop, ~40 s; pauses on hover or focus; **pause button** (WCAG 2.2.2) | Static wrapped row |
| M7 | Counters count up, bars grow | Enter viewport, once | IntersectionObserver + rAF; final value is in the SSR HTML; the animated span is `aria-hidden`; tabular figures at fixed width, so no shift | Final values |
| M8 | Section reveal (translate 12 px + fade) | Scroll | **CSS scroll-driven** `animation-timeline: view()` inside `@supports` and `prefers-reduced-motion: no-preference`. Content is never hidden without it (no JS gating). | None |
| M9 | Timeline lanes draw in, bars grow from their start date | Scroll | CSS scroll-driven, same gating | Drawn |
| M10 | Row expand and collapse | Click or keyboard | `<details>` + `::details-content` + `interpolate-size` (Chromium; others snap) | Instant |
| M11 | Skill hover glow on lines and timeline ticks | Hover or focus a chip | CSS transitions on a `data-skill-hover` attribute | Instant highlight |
| M12 | Citation jump: expand, scroll, marker sweep | Citation click, star click, `#r-…` URL hash | Opens ancestor `<details>`, then `scrollIntoView`, then a `background-size` sweep on the marker | `behavior: 'auto'`, instant highlight |
| M13 | Eval chart draws; search pipeline dot travels | Enter viewport | SVG `stroke-dashoffset` / offset-path, CSS | Static chart |
| M14 | How-it-works query dot travels KNOW → MEASURE | In view, loops 3× then rests | CSS `offset-path` | Static |
| M15 | Magnetic buttons (hero prompt submit, email, main CTAs) | `pointer: fine` hover | pointermove + rAF transform, max 6 px | Off |
| M16 | Top bar dark → paper crossfade | Hero leaves viewport | IntersectionObserver sentinel, colour transition only (no size change) | Instant |
| M17 | Scroll-spy on bracket nav, progress tick | Scroll | IntersectionObserver | Highlight only |
| M18 | Fit meters fill; log ticker during the check | Result, loading | CSS transitions | Instant |

**Not proposed:**

- **Smooth-scroll hijacking (Lenis):** it fights citation `scrollIntoView`, the Ask panel's nested scroll,
  the mobile sheet and assistive tech.
- **A global custom cursor:** cursor effects live only in the hero cloud and on magnetic buttons.
- **Music.**

## 4. Libraries and bundle cost

**Recommendation: no new runtime dependencies.**

| Piece | Choice | Client cost (gz) | Worker cost | Why |
|---|---|---|---|---|
| Point cloud | **Own WebGL2 renderer**: `gl.POINTS`, one vertex shader for rotation, brush and flare, round-point fragment shader; WebGL1 fallback; poster if neither | ~4–6 KB, lazy chunk loaded after first paint only when tier ≠ SAVER and the hero is in view | ~few KB (SSR only renders the wrapper) | three.js adds about 150 KB+ gz for one draw call we can write in about 200 lines |
| Point data | Sampled **at runtime** from the existing `/raj-avatar.webp` (1024², OffscreenCanvas, edge-weighted, seeded) | 0 | 0 | No new asset or build step. Positions are deterministic. |
| Poster | `public/hero-cloud.webp` (≤ 40 KB), exported once from the renderer | image, lazy after LCP | 0 (static asset) | Reduced motion, SAVER, no-WebGL, and the pre-hydration placeholder |
| Display font | **Anton** via `next/font/google` (self-hosted, latin subset, `adjustFontFallback`) | ~25–30 KB woff2 (measured in PR 0) | 0 | Same-origin, so no CSP change |
| Reveals, marquee, timeline, pipelines | CSS keyframes + **CSS scroll-driven animations** + IntersectionObserver + WAAPI | ~0 | 0 | Chromium 115+ and Safari 26 get scroll-driven motion; Firefox gets a static page |
| Counters, magnetic, scroll-spy, local time | Small hooks in `app/lib/` (`use-in-view`, `use-motion-tier`, `use-local-time`) | ~3 KB | small | |

**Considered and rejected:**

| Library | Cost (gz) | Why not |
|---|---|---|
| three.js / @react-three/fiber | ~150–250 KB | Too big for one draw call |
| GSAP + ScrollTrigger | ~37 KB | CSS covers every motion listed |
| Lenis | ~4 KB | Breaks scroll behaviour (above) |
| motion / Framer Motion | ~30 KB+ | Not needed |

**The Worker trap we measured.** `/mac` imports `react-simple-maps` statically inside a client component, and
it shows up in the server bundle (`.open-next/server-functions/.../app/mac/page.js`). **"Client component" does
not mean "out of the Worker".** Two rules follow:

- Heavy code loads through `import()` inside an effect, or `next/dynamic` with `ssr: false`.
- Every PR that adds code checks `bun run cloud-build` + `bunx wrangler deploy --dry-run`.

**Budgets:**

| Budget | Target |
|---|---|
| Worker | ≤ +60 KiB gz (≤ 2.33 MiB total) |
| Initial client JS on `/` | ≤ +20 KB gz; the renderer chunk is extra and lazy |
| Lighthouse mobile on `bun run preview` | Performance ≥ 90, Accessibility 100, Best Practices 100, SEO 100, CLS ≤ 0.02 |

**CSP:** no change needed. Fonts, avatar and poster are all same-origin, and the current CSP sets no
`img-src`, `font-src` or `connect-src`. If a later iteration adds an external asset, update `next.config.ts`
in the same PR.

## 5. Reduced motion, accessibility and fallbacks

- **`prefers-reduced-motion: reduce`:**
  - No boot overlay.
  - Poster instead of the live cloud.
  - Static marquee.
  - Final numbers.
  - No reveals.
  - Instant expand.
  - `scrollIntoView` with `behavior: 'auto'`.
  - The page is fully readable and static. SAVER applies the same rules for anyone. Reduced-motion users
    can opt in to MED or HIGH from the footer.
- **Content is never hidden by default.** Reveal animations only run where CSS scroll-driven animations are
  supported and motion is allowed. There is no "hidden until JS adds a class" state.
- **No JS:**
  - `<details>` still opens.
  - The overlay auto-removes.
  - Numbers are final.
  - The cloud shows its poster.
- **Print and Save as PDF:**
  - `beforeprint` opens every `<details>`; `afterprint` restores them.
  - Print CSS hides the canvas, marquee, dock, footer bar and overlay.
  - The resume prints the same as today.
- **Keyboard:**
  - Timeline bars are buttons with `aria-controls` pointing at their row.
  - Skill chips use `aria-pressed`.
  - Tier chips are a radio group.
  - Every disclosure is a real `<summary>`.
  - The coral focus ring is kept.
  - `/` still focuses the Ask input: it focuses the hero prompt while the hero is in view, and otherwise
    scrolls the panel into view first. Today it uses `preventScroll`, which would hide the input below the
    hero.
- **Screen readers:**
  - The canvas and poster are `aria-hidden`.
  - Marquee duplicates are `aria-hidden`.
  - Counters expose only their final value.
  - The overlay is non-modal and brief; when paused by interaction, `<main>` is `inert` until Enter.
- **Contrast** (measured):
  - On `night`: text 12.2:1, mint 8.9:1, dim 6.7:1, sun 8.4:1.
  - **Coral fails for small text everywhere:**
    - 3.42:1 on paper.
    - 4.15:1 on night.
    - 3.68:1 for white on coral.

    Today's `[n]` citation chips and cited-line markers already use it. (Lighthouse doesn't flag them
    because they only render after an answer.)
  - **Fix in P0:**
    - `coral-ink` `#ad4236` (5.4:1 on paper, 4.56:1 on the marker yellow).
    - `coral-glow` `#ec8374` (5.9:1 on night).
    - The active citation chip becomes white on `coral-ink` (5.8:1).
    - Plain `coral` is kept for non-text marks, which need 3:1.
- **No layout shift:**
  - The canvas and poster sit in a fixed aspect box.
  - Anton uses `next/font` fallback metrics.
  - Counters use tabular figures at a fixed width.
  - The top bar changes colour only, never size.
  - Local time renders client-side into a reserved-width slot.
  - The overlay is `position: fixed`.
  - Rows only expand on user input.
- **Touch:** targets are at least 44 px. The mobile swimlane is decorative, so the rows are the tap
  targets. Touch gets no hover-only behaviour; hover affordances also work on focus and click.
- **Zoom:** display type wraps and scales to 200 % zoom without overlap. The probe's tight leading is fixed.

## 6. Keeping every resume line a citable source

These are the mechanics, and PR 0 lands them before any visual work.

1. **Anchors don't change.** `resumeAnchor(...)` ids stay on the same elements:
   - Bullets: `r-exp-<role>-<b>`, `r-build-<id>-<b>` and `r-community-<id>-<b>`.
   - Blocks: `r-exp-<role>`, `r-summary`, `r-skills`, `r-education` and `r-contact`.
2. **Collapsed means `<details>`**, uncontrolled, so React never fights the DOM `open` state.
3. **`focusAnchor(anchor)`** (in `site-context.tsx`):
   - Finds the element.
   - Opens every ancestor `<details>`.
   - Clears a skill filter that would dim it.
   - On mobile, closes the sheet first (existing behaviour).
   - Waits one frame, then scrolls and flashes (M12).

   Every caller gets this for free: citation chips, source rows, fit-check evidence, and hero stars.
4. **Cited-but-collapsed is visible.** After an answer, each role row shows a coral `N CITED` badge and a
   coral tick on its timeline bar. Rows don't auto-expand, since that would shift content under a reader
   who is still reading the answer. They open on citation click.
5. **Deep links (new).** `/#r-exp-eddy-mcp` on load or `hashchange` calls `focusAnchor`, so a line is
   shareable and browser QA is easy.
6. **Tests** (vitest, `*.test.ts`):
   - `anchors.test.ts` server-renders the resume sections (`react-dom/server`) and asserts that every
     public `resumeSources()` anchor id is present.
   - `stats.test.ts` asserts two things for each stat:
     - Its anchor is a real public source.
     - Its `match` string is a literal substring of that source's text.

     For example, `"from 15 minutes to 2"` must appear in `pinhous/cicd`, and `"6 years"` in the summary.
     That way a `resume.ts` edit can't silently orphan a number.
   - `timeline.test.ts` covers the period-string parsing for builds and education.

## 7. Build plan: small PRs, parallel worktrees

All PRs target **`feat/visual-refresh`** as the integration branch. **Nothing goes to `main`** until you
approve the final integration PR, because main deploys to production.

Each PR must pass:

- `bun run typecheck` and `bun run test`.
- `bun run cloud-build` + `wrangler deploy --dry-run` (size logged in the PR).
- Screenshots at 1440×900 and 390×844, plus a reduced-motion pass.
- Lighthouse mobile on `bun run preview`.
- A citation check via `#r-…` deep links.

Servers run on 3190 (integration) and 3291–3296 (worktrees). **Never 3000.**

| PR | Scope | Owns (files) | Wave |
|---|---|---|---|
| **P0 Foundation** | Tokens (`night`, `coral-ink`, `coral-glow`, `--font-display`) and the coral small-text fix, Anton; the inline head script (`data-boot`, `data-motion`); split `resume.tsx` into `profile.tsx`, `work.tsx`, `skills.tsx`, `builds.tsx`, `community.tsx` and `hero.tsx` (pure move, no visual change); the `focusAnchor` + `<details>` + print + hash mechanics; `use-in-view`, `use-motion-tier` and `use-local-time`; `stats.ts` and timeline data with tests; the anchors test; new `SectionHeading` style; final `page.tsx` composition with stub slots for new pieces | global.css, layout.tsx, page.tsx, site-context.tsx, resume*.tsx, app/lib/*; coral class swaps only in answer-text.tsx, ask-panel.tsx and fit-check.tsx | 1 (me, sequential) |
| **P1 Hero** | Curly-cloud renderer + sampler, poster export, source stars, prompt bar + disclosure, system log | `hero.tsx`, `app/components/site/cloud/**`, `public/hero-cloud.webp` | 2 |
| **P2 Chrome** | Bracket top bar + scroll-spy, mobile dock (replaces `AskFab`), persistent footer bar, boot overlay + tiers, marquee, Ask panel restyle (presentation only) | `top-bar.tsx` (`ModeSwitch` API unchanged), `dock.tsx`, `boot.tsx`, `marquee.tsx`, `footer-bar.tsx`, `ask-panel.tsx` (markup and classes only; `useChat`, `replayTurns` and `STARTERS` untouched) | 2 |
| **P3 Work** | Skill lens, swimlane timeline, role rows, education strip | `work.tsx`, `skills.tsx`, `timeline.tsx` | 2 |
| **P4 Profile + numbers** | Path visual, summary disclosure, counters and bars | `profile.tsx`, `numbers.tsx` | 3 |
| **P5 Builds + community** | Project cards, animated eval chart, search pipeline, Open Invite ticket | `builds.tsx`, `community.tsx` | 3 |
| **P6 Lower page** | Fit restyle + meters, agents compact, how-it-works pipeline, contact, footer | `fit-check.tsx` (presentation only), `agents-section.tsx`, `closing.tsx` | 3 |
| **P7 Integration** | Full QA on desktop, mobile and reduced motion; Lighthouse; bundle; docs (CLAUDE.md traps, README, CLONE-PLAN §5 ownership); final PR → `main` | docs | 4 (needs your go-ahead) |

Waves 2 and 3 each run as parallel worktree subagents: plan first, I review, then they build. Each PR owns
disjoint files, and `page.tsx` is only edited in P0 and P7.

## 8. Risks

- **iOS WebGL and low-power mode.** The renderer handles `webglcontextlost` and drops to the poster. It is
  capped by tier and paused off-screen.
- **A preloader on a recruiting site.** ≤ 1.2 s once per session, skippable, content painted underneath.
  If it tests badly, it goes behind a flag.
- **Collapsed lines are less scannable.** That's mitigated by headline metrics, cited badges, the skill lens
  opening matches, and `Expand all`.
- **Dark stage next to a light Ask panel on desktop.** The panel starts below the hero, so they never meet
  side by side.
- **Stale anchors after future `resume.ts` edits.** Caught by the anchors and stats tests.

## 9. Decisions for Raj

1. **Hero visual.**
   - **(A) The curly cloud** (recommended; see the probe).
   - (B) An abstract retrieval-graph field with no likeness.
   - (C) A real point-cloud head, which needs a photo you're happy with, a depth pass and a ~100 KB asset.
2. **Display font.**
   - **Anton** (recommended).
   - Plex Sans Condensed 700.
   - Archivo at width 62.
3. **How dark.**
   - **A dark stage for the hero, marquee, how-it-works and contact; paper for reading** (recommended).
   - A fully dark site.
4. **Ask panel on desktop.**
   - **Starts below the hero, with a hero prompt bar** (recommended).
   - Visible from the first screen, beside the hero.
5. **Boot overlay.**
   - **Auto-enters at ≤ 1.2 s, once per session** (recommended).
   - Requires an `Enter` click like saifullah.
   - No overlay.
6. **Availability chip** (e.g. "Open to AI engineering roles"). This isn't in `resume.ts`; it would be a
   copy edit there that needs your approval and exact wording. Default: leave it out.
7. **Default expansion.**
   - **All rows collapsed** (recommended).
   - The current role (Eddy) open by default.
8. **Build dates.**
   - **Parse the `period` strings in presentation code with a test** (recommended, no `resume.ts` change).
   - Add `start`/`end` fields to `builds` in `resume.ts` (data-only, needs approval).
9. **PR flow.**
   - **Stack into `feat/visual-refresh`, then one PR to `main`** (recommended).
   - Separate PRs to `main`.
10. **Cloudflare bot script** (§0). Turn off JavaScript detections for the zone to get mobile Performance
    from ~46 to ~90+? This is a dashboard change; I won't touch it.
11. **Probe images.** `docs/redesign/*.jpg` are untracked. Keep them in git as design references, or leave
    them local.
