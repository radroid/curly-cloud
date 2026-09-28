# Redesign Plan: visual refresh of `/`

> A persistent plan for turning the resume page from a text wall into a visual, motion-led site. The
> reference is saifullah.dev. Humans and agents should treat this file as the source of truth for the
> redesign and update it when a decision changes. `CLONE-PLAN.md` still governs architecture and privacy.
>
> **Status: built (2026-09-27).** Raj reviewed a clickable prototype, asked for five changes and approved the
> rest (§1a). P0–P7 are merged into `feat/visual-refresh` (§7); measured results are in §0a. It reaches
> `main`, and so production, in one PR once Raj gives the go-ahead. The content was first aligned with Raj's
> final PDF CV in PR #10, which is merged, deployed and re-seeded into the production clone.

## 0. What we measured (2026-09-26)

**curlycloud.dev before the redesign**

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
> Cloudflare dashboard setting (JavaScript detections / Bot Fight Mode on the zone), not code. **It's Raj's
> call** (§9, still open). PRs are measured on `bun run preview`, which doesn't inject that script, so we
> see the app's own cost.

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

## 0a. What we measured after the build (2026-09-27)

Measured on `bun run preview` (OpenNext build on `wrangler dev`), which doesn't inject Cloudflare's bot script.

| | Before | After |
|---|---|---|
| Page height, desktop 1440×900 | 9,806 px | 7,877 px (8.8 screens) |
| Page height, mobile 390×844 | 14,686 px (17.4 screens) | 11,030 px (13.1 screens) |
| Words visible in `<main>` on load | 2,364 | 1,110; the rest is one click away and still citable |
| Worker bundle, gzipped | 2,266.66 KiB | 2,297.77 KiB of 3,072 |
| First-load JS for `/` | 137 kB at P0 | 157 kB (the +20 kB budget) |
| Lighthouse mobile | Performance 46 on the live site | Performance 91–95 over seven runs; Accessibility, Best Practices and SEO 100 |
| Total blocking time | 1,860 ms (live) | 10–27 ms |
| CLS | 0 | 0.014–0.016 |

Simulated LCP is 2.9–3.3 s, because Lighthouse's model counts the JavaScript that runs before the name
paints. On a throttled trace (4× CPU, Fast 4G) the name painted at 683 ms. The renderer used to link its
shaders synchronously, a 500 ms long task on slow CPUs; it now links in parallel and yields.

One more run, taken right after a build, scored 41: a single 6.2 s task in the renderer chunk. It didn't
happen again in seven runs, including with another browser drawing the cloud at the same time. The likely
cause is a cold GPU shader compiler on the first draw, which WebGL can't make asynchronous. Watch for it
in production (PageSpeed Insights, or a long task in the renderer chunk).

Checked in the browser at 1440, 1280 and 390 wide:

- the first visit's boot, the cloud assembling, and skipping both on later visits;
- reduced motion and Saver: a static poster, final numbers, no running animations, a still highlight ring;
- every `#r-…` deep link opens and highlights its line, including under reduced motion;
- keyboard focus, the mobile dock and menu, and the scroll-spy after jumps;
- print: every line opens, dark blocks turn to ink on paper, the chrome hides.

Known small issues, left for later:

- The Agents heading overflows at a 200 px viewport.
- A number waits at zero until 35 % of its chart is on screen.

## 1. Design direction: "the curly cloud"

**Idea.** The resume becomes an *instrument panel for an AI engineer*. The first screen is a dark stage:
Raj's curly-haired illustration is drawn as a live **point cloud**, which is literally a *curly cloud*.
**One brighter point per public source the clone can cite (38 today).** Hover one to see its label; click
it to jump to that resume line. The hero is the knowledge base, so it replaces the "How to read this"
explainer.

**Palette.** No new hues; the brand palette stays.

- **Stage** (hero, marquee, how-it-works, contact): a darker pine. There is one new token pair,
  `--color-night` (`#0b2a26`) and `--color-night-deep` (`#071d1a`).
- **Points:** `term-accent` mint. **Source stars:** `sun`. **Cited or flared:** `coral`.
- **Coral for small text** needs two more tokens (§5): `--color-coral-ink` (`#ad4236`) on light surfaces and
  `--color-coral-glow` (`#ec8374`) on the stage. Base `coral` stays for dots, ticks, rings and fills.
- **Reading surfaces** (work, fit, agents) stay on `paper` with `ink`, so long lines stay easy to read and
  print.

**Type.**

- **Display:** **Anton** 400, set in caps with `text-transform` (the DOM keeps proper case, so screen readers
  say "Raj Dholakia"). It's used for the name, section titles, company names, numbers and the marquee.
- **Micro-copy:** **IBM Plex Mono**, which is already loaded. Two voices:
  - Navigation stays uppercase and bracketed: `[2] WORK`.
  - The system log and counts are lowercase: `$ clone status`, `5 lines`.
- **Body and resume lines:** **IBM Plex Sans**, unchanged.
- Self-hosted through `next/font`, so no CSP change.

**Grammar.**

- Bracket indices on the nav and section heads: `[2] WORK`.
- Hairline rules.
- Numbers as counters and unit charts.
- Every collapsible block shows a visual summary plus a `▸ 7 lines` disclosure (no zero padding; `1 line`
  singular).
- Numbered markers only where the content is a real sequence (the nav, the how-it-works pipeline).
- No `→` appended to links.

**Honesty rule.** Every number or claim on screen comes from one of three places:

- `content/resume.ts`, which now follows Raj's final PDF CV (PR #10).
- A count derived from it, such as 30 lines or 38 sources.
- An architecture fact in `CLONE-PLAN.md`.

Measured values (FPS, local time) are real. A unit test enforces this for stats (§6). **The redesign makes no
further `resume.ts` edits.** Anything that would need Raj's copy approval is listed in §9.

**Layout.**

- **Desktop:** the hero stage is full-bleed across both columns, and the top bar floats over it in the
  dark tone. Below the hero is the two-column grid, with the page on the left and the **Ask panel sticky
  on the right**, starting just below the marquee instead of at y=0. The hero has its own prompt bar that sends to
  the panel.
- **Mobile:** the hero stage fills the first screen: cloud on top, then the name, two links, `Privacy` and
  the prompt bar, all clear of the dock. A bottom **dock** replaces the Ask FAB, with the current section and
  menu on the left and `Ask Raj` on the right.

## 1a. Design reference and review outcome

**The prototype is the visual spec.** It's a single HTML file with the real resume data, all 20 components
tagged C0–C19, and the same citation mechanics. Where this plan and the prototype disagree on *how
something looks*, the prototype wins. Where they disagree on *how it's built* (framework, accessibility,
performance), this plan wins.

- **Where:** local branch `prototype/visual-refresh`, folder `docs/redesign/` (not pushed, kept out of
  `main`). In this worktree the same files are untracked at `docs/redesign/`.
  - `docs/redesign/redesign-prototype.html`: open it in a browser. `?intro=off&tags=off` gives a clean
    view; `embed=1` hides the review bar.
  - `docs/redesign/prototype/src.html`: the source to read when building a component (search for
    `data-c="C7"` or `// ── C7`).
  - `docs/redesign/prototype/build.ts`: rebuilds the HTML from `content/resume.ts`
    (`bun docs/redesign/prototype/build.ts`).
  - `docs/redesign/prototype/cloud-src.png` and `cloud-src.py`: the hero's source image and the script
    that made it (§4).
  - `docs/redesign/shots/`: reference screenshots at 1440×900 and 390×844.
- **Prototype-only, don't port:** the pink review tags and review bar, the Options menu, the canned Ask
  answers and fit result, the Canvas2D cloud (the product uses WebGL, §4), the retrieval-field hero and the
  font switcher (options that weren't chosen).

**Raj's review (2026-09-27): "Solid prototype."** Changes he asked for, all made in the prototype:

1. **Hero image.** The cloud is sampled from Raj's new illustration (curly hair, beard, earbud, floral
   camp-collar shirt) instead of the old avatar. The small chat avatar is unchanged.
2. **C4 path line.** The vertical line runs exactly through the centre of each dot, from the first dot to
   the last, with the dots drawn on top. The horizontal layout also ends at the last dot.
3. **No subtitle under the name.** The hero is name, links (with `Privacy`), prompt bar.
4. **Floating filter pill.** "Showing N lines about X · Clear" is fixed just under the top bar, centred on
   the reading column, with a shadow, and stays visible while the filter is on.
5. **Full border on filtered lines.** Matching lines get a 1.5 px rounded border in the forest accent over
   a 7 % tint; non-matching lines dim.
6. **Content.** The page shows the CV as it is now (PR #10): four builds, Pinhous as 3 interns, no Duit
   leadership, and so on.

**Found and fixed during review** (keep these in the build):

- The mobile timeline opens at the recent end, keeps the lane labels pinned on the left while it scrolls
  sideways, and says "Swipe back for earlier years".
- "Ask about this" floats at a line's top-right corner on mouse devices, so it never holds an empty row;
  on touch it stays inline and visible.
- The mobile menu button reports `aria-expanded` and returns focus when the menu closes.
- The system log sits on a translucent backdrop so it reads over any hero.

**Measured on the prototype** (intro off):

| Measure | Before | Prototype |
|---|---|---|
| Words visible before any expansion | ~2,360 | ~910 |
| Desktop page height (1440) | 9,806 px | 7,699 px |
| Mobile page height (390) | 17.4 screens | 12.5 screens |

All 30 lines and 38 sources stay in the HTML.

## 2. Section by section: before → after

"In DOM" means the full citable text is still rendered as HTML inside a closed `<details>`. It is indexed,
found by find-in-page in Chromium, printed, and opened by citations. Component ids (C0–C19) match the
prototype.

| # | Section | Before | After (as agreed in the prototype) |
|---|---|---|---|
| C0 | **Intro** (new) | none | Boot overlay: Anton `%` counter, a short `$ clone boot` log (points, fonts, corpus, render), render-quality chips High / Medium / Saver, `Enter`. Details below. |
| C1 | **Top bar** | Name, For agents, Mac ’84, Website ⇄ Terminal | Anton wordmark + **bracket nav** `[1] HOME [2] WORK [3] FIT [4] AGENTS [5] CONTACT` with scroll-spy, then `mac ’84` and the `ModeSwitch` (API unchanged; dark over the hero, light after). |
| C2 | **Hero** | Name, 23-word pitch, "Now:" line, 3 CTAs, 4 links (67 words) | Curly-cloud canvas with one star per company, build and community entry the clone can cite, plus Education (11), and 19 personal dots. `RAJ DHOLAKIA` in Anton. **No subtitle.** **Prompt bar** whose placeholder cycles through the existing `STARTERS`. Two quiet links between the name and the prompt bar: `Check my fit for a role`, `Connect your agent`. At the end of their row, over the bar's top-right corner, a `Privacy` link: hover or focus shows the AI and logging disclosure; on touch the first tap shows it and the second follows the link. No caption. The system log (`$ clone status` · corpus 38 public sources · lines 30 citable · retrieval bm25 + bge-m3, fused, reranked · guard checks answers as they stream · render high, 60 fps, measured) opens from the Ask panel's avatar on hover, focus or tap. |
| — | **How to read** | 50-word explainer card | **Removed.** The stars and their hover cards carry the idea. |
| C3 | **Marquee** (new) | "Now: …" sentence | Looping `key value` items: `now` Lead Software Developer, Eddy Solutions · `base` Toronto · `building` MCP servers, RAG pipelines, agents, evals · `stack` TypeScript, Python, C# · `shipping since` 2020 · `for agents` curlycloud.dev/mcp · `community` Open Invite. Pause button. |
| C4 | **Profile** (was About, 89 words) | 3 paragraphs | A 3-node **path**: 2016 NUCLEAR ENGINEERING (BEng, University of Manchester) → 2020 SOFTWARE (Duit.io, then full-stack roles) → 2024 GENAI INFRASTRUCTURE (Create Club, now Eddy Solutions); vertical on narrow widths, the line through the dot centres. Beside it, three one-sentence quotes from the summary. `▸ Read the full summary` holds the pitch and the 3 paragraphs and keeps `id="r-summary"`. |
| C5 | **Numbers** (new) | Numbers buried in bullets | 6 instruments, each with a unit chart and a `source: …` link to its line: **6** years shipping (summary) · **150,000+** LoRaWAN devices (`eddy/services`) · **80+** weekly processes replaced by agents, with a 60 % bar (`create-club/beverage-agents`) · **15 → 2** min deploys, a shrinking bar (`pinhous/cicd`) · **100K** job postings searchable, three vectors each (`jobsearch/vectors`) · **40+** regulatory documents grounded (`regdocs/corpus`). Count up once in view. Two columns on mobile. |
| C6 | **Skill lens** (was Skills + sticky filter bar) | 6 groups × 26 long labels + a 29-chip filter bar | Chips grouped **AI / Stack / Practice** (the site's `FILTERS`, only chips with lines), each with a line count. **Hover or focus** lights up matching lines, role rows and timeline ticks. **Click** sets the filter: matching roles open, matching lines get the full border, others dim, and the **floating pill** appears (feedback 4–5). `▸ Full skill list` shows the CV's three groups (GenAI, Code and data, Cloud and tooling) under `id="r-skills"`. |
| C7 | **Career timeline** (was Experience, 857 words) | 5 role blocks, all expanded | A swimlane from 2016 to now with lanes study, work (two tracks), builds, community, and a compressed pre-2020 axis. Year-only dates have soft ends. Work bars open their role row. The four builds cluster in Jan–Jul 2026, so the lane has one `4 builds` label and each bar is a titled button that opens its card. **Mobile:** the same chart, scrollable sideways, opening at the recent end with pinned lane labels. |
| C8 | **Role rows** | Full bullets | Collapsed rows: period (+ `now` pill), company in Anton, role, one headline metric (`150,000+ devices`, `80+ processes automated`, `15 → 2 min deploys`, `20% fewer repeat incidents`, `15 s → 5 s signals`), top 3 tags, `N lines`, and after an answer a coral `N cited` badge; during a filter a `N match` badge. Expanded: the blurb and the lines with "Ask about this". `Expand all` in the section head. |
| C9 | **Independent builds** (421 words) | 2 cards of full bullets | Builds with a diagram lead, in a 2-column grid: the regulatory assistant (hit@8 chart, drawn in view; `40+ documents` `14 safety areas` `shall vs should, shown apart`) and job search (query → intent → three named vectors → rrf → top 10, a dot travels it). The Pulse and Earned follow as compact cards. Every card has its link from the CV (`Live app`, `System design explanation`, `YouTube explainer`), stack chips, and its lines: behind `▸ N lines`, or shown directly when there's only one. |
| C10 | **Community** (152 words) | Card with paragraphs | An **Open Invite ticket**: perforated edge, a stub reading `OPEN TO EVERYONE` and the `openinviteto.ca` link, event names *Cake Picnic* and *Sip & Bedazzle*, platform chips, and the blurb plus lines behind `▸ 3 lines`. |
| C11 | **Study** (37 words) | 3-row list | A compact 3-row strip that keeps `id="r-education"` and the full credential text; the timeline's study lane shows the same three. |
| C12 | **Fit check** | Paragraph + 4 fields | One-line lede. The form opens as **role title + job description**; company and culture sit behind `More fields`. Loading steps become a log ticker; results show a verdict badge and technical and culture **meters**. Evidence chips unchanged. **API and logic untouched.** |
| C13 | **Agents** (161 words) | 2 paragraphs, terminal card, 6 tool cards | One-line lede. The terminal card stays (endpoint, copy, setup tabs). Tools become mono chips with the description on focus or click. The key note stays one line with the mailto. |
| C14 | **How the clone answers** (188 words) | 5 text cards + terminal CTA | An animated **pipeline** Know → Find → Answer → Guard → Measure, each with a 3–6 word label (Find: `bm25 + bge-m3, fused, reranked`); the full sentence opens on click. A dot travels it in view. The terminal and Mac ’84 links stay. |
| C15 | **Contact** | Green card | A giant Anton `SAY HELLO`, a large email button, LinkedIn, GitHub, `Ask the clone first`, and Toronto local time. |
| C16 | **Footer** | Privacy note + links | **Privacy note unchanged and visible** (`#privacy`, a CLONE-PLAN requirement). Links: Terminal · Mac ’84 · llms.txt · MCP · Save as PDF · Render quality select. |
| C17 | **Persistent footer bar** (new, desktop) | none | Fixed bottom-left of the page column after the hero: `Say hello raj9dholakia@gmail.com · Toronto 2:32 p.m.` Hidden while Contact is in view; on mobile it lives in the dock menu. |
| C18 | **Mobile dock** (new) | Ask FAB | Current section + menu (bracket items, email, local time, Save as PDF) on the left, `Ask Raj` on the right. The Ask panel opens as a bottom sheet. |
| C19 | **Ask panel** | Unchanged | **Logic untouched** (SSE, signed turns, starters, storage). Restyle only: Anton `ASK RAJ` header and starters as `01 …` rows. It stays in `ask-panel.tsx` because `lib/rag/injection.test.ts` parses `STARTERS` from that file. |

### Boot overlay details

- **When it shows:** once per session. It's skipped for reduced motion, on return visits within the
  session, and in print. A tiny inline `<head>` script sets `data-boot="skip"` before first paint, so it
  never flashes. The CSP has no `script-src`, so inline scripts are allowed.
- **Progress:**
  - The % tracks real milestones: fonts ready, cloud renderer chunk loaded, source image sampled.
  - It has a 1.1 s ramp and a 1.4 s cap.
  - It auto-enters at 100 %.
  - `Enter` skips.
  - Touching a tier chip pauses auto-enter until you press Enter.
- **Page underneath:** the page is fully painted under the overlay at opacity 1 (the hero `<h1>` is the LCP
  element), and the overlay leaves with a `clip-path` wipe. If JS never runs, a CSS fallback animation
  removes the overlay at 2.5 s.
- **Tiers:**
  - **High:** ~9k points, DPR ≤ 2, 60 fps.
  - **Medium:** ~4k points, DPR 1, 30 fps cap.
  - **Saver:** static poster, and all motion off.
  - **Default:** auto from reduced motion, Save-Data, WebGL support, pointer type, cores and memory.
    It auto-downgrades if the measured frame rate stays under 40 fps for 2 s.
  - The choice is saved in `localStorage` and can be changed later from the footer.
- **Not included:** no music.

## 3. Motion list

One orchestrated moment (the cloud assembling after the intro); everything else answers the reader or
reports a value. **No generic fade-up reveals on sections.**

| # | Motion | Trigger | Technique | Reduced motion / Saver |
|---|---|---|---|---|
| M1 | Boot counter + wipe | First visit in session | CSS + rAF counter, `clip-path` | Skipped entirely |
| M2 | Curly cloud: assembles from scatter (~2.4 s), idle drift, cursor parallax, cursor "brush" that pushes points and springs back | After the intro, while in view | WebGL2 points (§4); paused off-screen (IntersectionObserver) and on hidden tabs | Static poster, same box |
| M3 | Source stars: hover label, click to line, coral flare when an answer cites them | Pointer; `done` event | Same renderer; label is an HTML chip | Poster only; the same lines are reachable in the page |
| M5 | Prompt bar placeholder cycling through `STARTERS` | Idle, empty input | Interval text swap with fade | First starter, static |
| M6 | Marquee | Always | CSS `translateX` loop, ~40 s; pauses on hover or focus; **pause button** (WCAG 2.2.2) | Static wrapped row |
| M7 | Counters count up, unit charts fill | Enter viewport, once | IntersectionObserver + rAF; final value is in the SSR HTML; the animated span is `aria-hidden`; tabular figures at fixed width, so no shift | Final values |
| M9 | Timeline bars grow from their start date | Enter viewport, once | CSS, gated on the in-view class | Drawn |
| M10 | Row expand and collapse | Click or keyboard | `<details>` + `::details-content` + `interpolate-size` (Chromium; others snap); programmatic opens are instant so a citation scroll lands | Instant |
| M11 | Skill hover glow on lines and timeline ticks | Hover or focus a chip | CSS transitions on a `data-skill-hover` attribute | Instant highlight |
| M12 | Citation jump: expand, scroll, flash | Citation click, star click, `#r-…` URL hash | Opens ancestor `<details>`, then `scrollIntoView`, then a flash ring | `behavior: 'auto'`, instant highlight |
| M13 | Eval chart draws; search pipeline dot travels | Enter viewport | SVG `stroke-dashoffset` / `animateMotion` or `offset-path` | Static chart |
| M14 | How-it-works dot travels Know → Measure | In view, loops 3× then rests | CSS `offset-path` | Static |
| M15 | Magnetic buttons (hero Ask, email, main CTAs) | `pointer: fine` hover | pointermove + rAF transform, max 6 px | Off |
| M16 | Top bar dark → paper crossfade | Hero leaves viewport | IntersectionObserver sentinel, colour transition only (no size change) | Instant |
| M17 | Scroll-spy on bracket nav | Scroll | IntersectionObserver | Highlight only |
| M18 | Fit meters fill; log ticker during the check | Result, loading | CSS transitions | Instant |
| M19 | Filter pill enters | Filter set | 6 px slide + fade, ~200 ms | None |

**Dropped:** M4 (hero text line rise) and M8 (section reveals on scroll), per the design critique: scattered
entrance effects read as templated and compete with the cloud.

**Not proposed:**

- **Smooth-scroll hijacking (Lenis):** it fights citation `scrollIntoView`, the Ask panel's nested scroll,
  the mobile sheet and assistive tech.
- **A global custom cursor:** cursor effects live only in the hero cloud and on magnetic buttons.
- **Music.**

## 4. Libraries and bundle cost

**Recommendation: no new runtime dependencies.**

| Piece | Choice | Client cost (gz) | Worker cost | Why |
|---|---|---|---|---|
| Point cloud | **Own WebGL2 renderer**: `gl.POINTS`, one vertex shader for rotation, brush and flare, round-point fragment shader; WebGL1 fallback; poster if neither | ~4–6 KB, lazy chunk loaded after first paint only when the tier isn't Saver and the hero is in view | ~few KB (SSR only renders the wrapper) | three.js adds about 150 KB+ gz for one draw call we can write in about 200 lines |
| Cloud source image | **`public/hero-cloud-src.png`**: 320², ~20 KB, grey + alpha, a line sketch of Raj's cartoon made by `scripts/portrait-images.py` (background flood-filled away; DoG lines and a dark fill for hair and beard on the head; the shirt's stripes lifted out first; an ink outline). It replaced the prototype's illustration (`cloud-src.py`); the same script makes the avatar | ~20 KB, lazy with the renderer | 0 (static asset) | Deterministic input; no build step (the script needs Python with numpy/Pillow/scipy/scikit-image, and is run by hand) |
| Sampling | At runtime in the renderer chunk, seeded: the image's alpha is the figure mask; edges on √luminance; solid dark fill down-weighted (hair and beard don't swallow points); head region weighted up; stars picked farthest-point on the outline and kept out of the faded bottom rows. Port the prototype's `sample()`, `depth()`, `pickStars()` and `layout()` | in the chunk | 0 | Tuned in review; the layout measures the name and prompt bar so the figure never collides with them |
| Poster | `public/hero-cloud.webp` (≤ 40 KB), drawn from the renderer's sampler by `scripts/portrait-images.py` (points, work stars, personal dots) | image, lazy after LCP | 0 (static asset) | Reduced motion, Saver, no-WebGL, and the pre-hydration placeholder |
| Display font | **Anton** via `next/font/google` (self-hosted, latin subset, `adjustFontFallback`) | ~25–30 KB woff2 (measured in P0) | 0 | Same-origin, so no CSP change |
| Marquee, timeline, pipelines, counters | CSS keyframes + IntersectionObserver + WAAPI | ~0 | 0 | |
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

**CSP:** no change needed. Fonts, images and the poster are all same-origin, and the current CSP sets no
`img-src`, `font-src` or `connect-src`. Build links point off-site but are plain anchors. If a later
iteration adds an external asset, update `next.config.ts` in the same PR.

## 5. Reduced motion, accessibility and fallbacks

- **`prefers-reduced-motion: reduce`:**
  - No boot overlay.
  - Poster instead of the live cloud (the prototype shows a static, fully assembled cloud; the product uses
    the poster).
  - Static marquee.
  - Final numbers.
  - Instant expand, and the filter pill appears without motion.
  - `scrollIntoView` with `behavior: 'auto'`.
  - The page is fully readable and static. Saver applies the same rules for anyone. Reduced-motion users
    can opt in to Medium or High from the footer.
- **Content is never hidden by default.** There is no "hidden until JS adds a class" state.
- **No JS:**
  - `<details>` still opens.
  - The overlay auto-removes.
  - Numbers are final.
  - The cloud shows its poster.
- **Print and Save as PDF:**
  - `beforeprint` opens every `<details>`; `afterprint` restores them.
  - Print CSS hides the canvas, marquee, dock, footer bar, filter pill and overlay.
  - The resume prints the same as today.
- **Keyboard:**
  - Timeline bars (work and builds) are buttons that open their row or card.
  - Skill chips use `aria-pressed`; Clear on the filter pill returns focus to the chip.
  - Tier chips are a radio group.
  - Every disclosure is a real `<summary>`.
  - The mobile menu button has `aria-expanded`; Escape closes it and returns focus.
  - The coral focus ring is kept.
  - `/` still focuses the Ask input: it focuses the hero prompt while the hero is in view, and otherwise
    scrolls the panel into view first. Today it uses `preventScroll`, which would hide the input below the
    hero.
- **Screen readers:**
  - The canvas and poster are `aria-hidden`.
  - Marquee duplicates are `aria-hidden`.
  - Counters expose only their final value.
  - The filter has a polite live region ("Showing 4 lines about TypeScript", "Filter cleared").
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
  - The overlay and the filter pill are `position: fixed`.
  - "Ask about this" is absolutely positioned on mouse devices.
  - Rows only expand on user input.
- **Touch:** targets are at least 44 px. Touch gets no hover-only behaviour; hover affordances also work on
  focus and click.
- **Zoom:** display type wraps and scales to 200 % zoom without overlap.

## 6. Keeping every resume line a citable source

These are the mechanics, and P0 lands them before any visual work. The prototype implements the same ones
(`openFor`, `focusAnchor`, `setCited` in `src.html`), verified on desktop and in the mobile sheet.

1. **Anchors don't change.** `resumeAnchor(...)` ids stay on the same elements:
   - Bullets: `r-exp-<role>-<b>`, `r-build-<id>-<b>` and `r-community-<id>-<b>`.
   - Blocks: `r-exp-<role>`, `r-build-<id>`, `r-summary`, `r-skills`, `r-education` and `r-contact`.
2. **Collapsed means `<details>`**, uncontrolled, so React never fights the DOM `open` state.
3. **`focusAnchor(anchor)`** (in `site-context.tsx`):
   - Finds the element.
   - Opens every ancestor `<details>` instantly (an animated open interrupts the smooth scroll).
   - Opens a linked disclosure too (`r-skills` opens the full skill list; the ticket opens its lines).
   - Clears a skill filter that would dim it.
   - On mobile, closes the sheet first (existing behaviour).
   - Waits one frame, then scrolls and flashes (M12).

   Every caller gets this for free: citation chips, source rows, fit-check evidence, stat `source:` links,
   timeline bars and hero stars.
4. **Cited-but-collapsed is visible.** After an answer, each role row shows a coral `N cited` badge and its
   timeline bar gets a coral outline. Rows don't auto-expand, since that would shift content under a reader
   who is still reading the answer. They open on citation click.
5. **Deep links (new).** `/#r-exp-eddy-mcp` on load or `hashchange` calls `focusAnchor`, so a line is
   shareable and browser QA is easy.
6. **Tests** (vitest, `*.test.ts`):
   - `anchors.test.ts` server-renders the resume sections (`react-dom/server`) and asserts that every
     public `resumeSources()` anchor id is present.
   - `stats.test.ts` asserts two things for each stat:
     - Its anchor is a real public source.
     - Its `match` string is a literal substring of that source's text.

     For example, `"from 15 minutes to 2"` must appear in `pinhous/cicd`, `"150,000+"` in `eddy/services`,
     `"~100K"` in `jobsearch/vectors`, and `"6 years"` in the summary. That way a `resume.ts` edit can't
     silently orphan a number.
   - `timeline.test.ts` covers the period-string parsing for builds (`Jul 2026`, `Apr – Jul 2026`) and
     education (`2016 – 2019`, `2024`).

## 7. Build plan: small PRs, parallel worktrees

All PRs target **`feat/visual-refresh`** as the integration branch. **Nothing goes to `main`** until Raj
approves the final integration PR, because main deploys to production. The first step is pushing
`feat/visual-refresh` so PRs have a base.

Each PR must pass:

- `bun run typecheck` and `bun run test`.
- `bun run cloud-build` + `wrangler deploy --dry-run` (size logged in the PR).
- Screenshots at 1440×900 and 390×844 next to the matching prototype shots, plus a reduced-motion pass.
- Lighthouse mobile on `bun run preview`.
- A citation check via `#r-…` deep links.

Servers run on 3190 (integration) and 3291–3296 (worktrees). **Never 3000.**

Builders read the component in `docs/redesign/prototype/src.html` (§1a) for the agreed look, then write it
properly in React + Tailwind with the project's tokens. Prototype code is a reference, not a source to
paste: it has no tests, inline hex values and prototype-only branches.

| PR | Components | Scope | Owns (files) | Wave |
|---|---|---|---|---|
| **P0 Foundation** | — | Tokens (`night`, `night-deep`, `coral-ink`, `coral-glow`, `--font-display`) and the coral small-text fix, Anton; the inline head script (`data-boot`, `data-motion`); split `resume.tsx` into `profile.tsx`, `work.tsx`, `skills.tsx`, `builds.tsx`, `community.tsx` and `hero.tsx` (pure move, no visual change); the `focusAnchor` + `<details>` + print + hash mechanics; `use-in-view`, `use-motion-tier` and `use-local-time`; `stats.ts` and timeline data with tests; the anchors test; new `SectionHeading` style; final `page.tsx` composition with stub slots for new pieces | global.css, layout.tsx, page.tsx, site-context.tsx, resume*.tsx, app/lib/*; coral class swaps only in answer-text.tsx, ask-panel.tsx and fit-check.tsx | 1 (me, sequential) |
| **P1 Hero** | C2 | Curly-cloud WebGL renderer + sampler ported from the prototype, `hero-cloud-src.png`, poster export, source stars, prompt bar + disclosure, caption, system log | `hero.tsx`, `app/components/site/cloud/**`, `public/hero-cloud-src.png`, `public/hero-cloud.webp` | 2 |
| **P2 Chrome** | C0, C1, C3, C16–C19 | Bracket top bar + scroll-spy, mobile dock and menu (replaces `AskFab`), persistent footer bar, boot overlay + tiers, marquee, footer, Ask panel restyle (presentation only) | `top-bar.tsx` (`ModeSwitch` API unchanged), `dock.tsx`, `boot.tsx`, `marquee.tsx`, `footer-bar.tsx`, `ask-panel.tsx` (markup and classes only; `useChat`, `replayTurns` and `STARTERS` untouched) | 2 |
| **P3 Work** | C6, C7, C8, C11 | Skill lens with the floating filter pill and bordered matches, swimlane timeline (builds lane, mobile pinned labels), role rows with badges, "Ask about this" placement, study strip | `work.tsx`, `skills.tsx`, `timeline.tsx` | 2 |
| **P4 Profile + numbers** | C4, C5 | Path visual (line through the dot centres), quotes, summary disclosure, counters and unit charts | `profile.tsx`, `numbers.tsx` | 3 |
| **P5 Builds + community** | C9, C10 | Featured and compact build cards with links, animated eval chart, search pipeline, Open Invite ticket | `builds.tsx`, `community.tsx` | 3 |
| **P6 Lower page** | C12–C15 | Fit restyle + meters, agents compact, how-it-works pipeline, contact | `fit-check.tsx` (presentation only), `agents-section.tsx`, `closing.tsx` | 3 |
| **P7 Integration** | all | Full QA on desktop, mobile and reduced motion; Lighthouse; bundle; docs (CLAUDE.md traps, README, CLONE-PLAN §5 ownership); final PR → `main` | docs | 4 (needs Raj's go-ahead) |

**As built:** P0 #11, P2 #12, P4 #13, P5 #14, P3 #15, P2b #16 (the chat avatar's states), P1 #17 and P6 #18,
then P7. P7 also:

- stopped the shader link blocking the main thread;
- fixed the focus ring on script-focused containers;
- fixed the skill chips' accessible names;
- made the scroll-spy follow jumps;
- fixed print for the hero and the Agents panel;
- let the timeline fit its column at 1280 wide;
- fixed label-in-name on the timeline's build bars and the dock's menu button, and stopped screen readers
  hearing build names twice;
- set a dark `theme-color` so mobile browser chrome matches the hero.

Waves 2 and 3 each run as parallel worktree subagents: plan first, I review, then they build. Each PR owns
disjoint files, and `page.tsx` is only edited in P0 and P7.

## 8. Risks

- **iOS WebGL and low-power mode.** The renderer handles `webglcontextlost` and drops to the poster. It is
  capped by tier and paused off-screen.
- **A preloader on a recruiting site.** ≤ 1.4 s once per session, skippable, content painted underneath.
  If it tests badly, it goes behind a flag.
- **Collapsed lines are less scannable.** That's mitigated by headline metrics, cited badges, the skill lens
  opening matches, and `Expand all`.
- **Dark stage next to a light Ask panel on desktop.** The panel starts below the hero, so they never meet
  side by side.
- **Stale anchors after future `resume.ts` edits.** Caught by the anchors and stats tests. The prototype
  also reads `resume.ts`, so rebuilding it after an edit shows what moved.
- **The cloud depends on one portrait.** A new one means re-fitting the crop and head outline in
  `scripts/portrait-images.py`, re-running it, and re-checking the layout at 1440, 1280, 1024 and 390 wide;
  the sampler weights were tuned for line art.
- **Page length.** The prototype landed at 12.5 mobile screens against the original 8-screen target; the
  build is 13.1 (§0a). The biggest remaining blocks are the builds and the lower page.

## 9. Decisions

Settled in the prototype review (2026-09-27). Items marked *default* are the recommendation Raj saw in the
prototype and didn't ask to change.

1. **Hero visual:** the curly cloud, sampled from the new illustration. *Raj's call.*
2. **Display font:** Anton. *Default.*
3. **How dark:** a dark stage for the hero, marquee, how-it-works and contact; paper for reading. *Default.*
4. **Ask panel on desktop:** starts below the hero, with a hero prompt bar. *Default.*
5. **Boot overlay:** auto-enters within 1.4 s, once per session. *Default.*
6. **Availability chip:** left out (it would need a `resume.ts` copy edit). *Default.*
7. **Default expansion:** all rows collapsed. *Default.*
8. **Build dates:** parsed from the `period` strings in presentation code, with a test. *Default.*
9. **PR flow:** stack into `feat/visual-refresh`, then one PR to `main`. *Default.*
10. **Hero subtitle:** removed. *Raj's call.*
11. **Filter pill and matched lines:** floating pill, full border. *Raj's call.*
12. **Prototype and probe images:** kept on the local branch `prototype/visual-refresh`, out of `main`
    (§1a).

13. **Chat avatar:** keep the old photo and animate it by state: a ring while thinking, a nod while answering,
    and a pulse when it cites (P2b, #16). *Raj's call.*
14. **Cloudflare bot script** (§0): Raj turns off JavaScript detections for the zone in the dashboard. It isn't
    a code change. Re-run Lighthouse on production afterwards. *Raj's call.*
