# Hero stars: shorter cards and personal dots

Design for the hero cloud's hover cards, agreed with Raj on 2026-09-28. It builds on the photo-based
cloud in `REDESIGN-PLAN.md` §4.

## Status (2026-09-28)

Built. Changes from the design below:

- **Portrait:** Raj swapped his photo for his cartoon while this was being built. `scripts/portrait-images.py` makes
  the cloud's source, the poster and the avatar (`public/raj-avatar.webp`) from it.
- **Caption, log and disclosure:** Raj then dropped the hero caption and moved the `$ clone status` log to a card on
  the Ask panel's avatar (hover, focus or tap). The render line reaches it through `app/lib/use-render-status.ts`.
  Without the log, `layout()` gives the figure all the width right of the copy. The AI and logging disclosure
  now shows only on hover or focus of the hero's `Privacy` link (first tap on touch). The two links and
  `Privacy` moved above the prompt bar, with `Privacy` over its top-right corner.
- **One dot per company or project:** Raj then asked for one yellow dot per company, build and community entry,
  plus Education: 11 instead of 38, so 30 dots in all. Summary, Skills and Contact have none. A dot opens its whole
  role or build, its card has words for the whole block, and it turns coral when any of its lines is cited (the card
  lists every citation number). The status card still counts 38 public sources (`SOURCE_COUNT`).
- **Dot size:** dots now scale with the figure instead of shrinking only the personal ones. They are full size from a
  560 px figure and 60% at the smallest, so the dots don't crowd the face at 1024 wide or on phones. The hit area
  stays 24 px.
- **Mac link:** there is no DOM test setup for the desktop, so `?open=music` was checked in the browser only.

## Goal

Hovering the cloud should say who Raj is at a glance, not replay the resume. Each card gets shorter, and
new white dots show the person behind the work.

**Decisions (Raj, 2026-09-28):**

- **Cards:** the name plus up to 3 words about the item: what it is, not traits. No description, no
  "click to see the line" hint.
- **Work dots:** stay yellow and clickable (they scroll to the resume line). All 38 keep 3 words.
- **Personal dots:**
  - They are soft white (`term-text`), and hover only: clicking does nothing.
  - Music is the one exception: it opens the Mac's Music app, which shows his top Spotify genres.
  - Most show just the name. Only Habits, Second chances, Health, Outdoors and Music get 3 words.
- **Privacy:** Raj's longer statement about his values isn't published. It only informed the list below.
  Personal dots stay out of the clone's knowledge base, the terminal and the MCP server.

## Cards

| | Work dot | Personal dot |
|---|---|---|
| Name | Company, project or section, mono, `text-sun` | Item, mono, `text-term-text` |
| Words | 3, joined with ` · ` | 3 for the five above; none otherwise |
| Cited marker | ` · cited [1, 2]` in `text-coral-glow`, as now | Never cited |
| Click | Scrolls to the line (`focusAnchor`) | Nothing, except Music → `/mac?open=music` |
| Cursor | pointer | default (pointer on Music) |

The card keeps its current box, border (`border-sun/55` for work, `border-term-text/40` for personal)
and flip near the right edge. A name-only card is a single line.

## Content: `content/star-cards.ts`

One public file, next to `resume.ts`:

```ts
export interface StarCard { name?: string; words: [string, string, string] }
/** Words for every work dot, keyed by resume anchor. `name` shortens a long build title. */
export const WORK_CARDS: Record<string, StarCard>
export interface PersonalDot { id: string; name: string; words?: [string, string, string]; href?: string }
export const PERSONAL_DOTS: PersonalDot[]
```

`cloud/stars.ts` merges them into one list: `STARS` (work, in knowledge-base order, as now) followed
by `PERSONAL` dots. Each entry has `kind: 'work' | 'personal'`, `name`, `words`, and either `anchor` or
`href`. The `snippet` field and its `TEXT` map go.

### Work words (draft; Raj to edit)

| Anchor | Card name | Words |
|---|---|---|
| r-summary | Summary | agents · MCP · evals |
| r-exp-eddy | Eddy Solutions | leak detection · IoT · web apps |
| r-exp-eddy-rag | Eddy Solutions | RAG · ISO docs · Inspect evals |
| r-exp-eddy-tracker | Eddy Solutions | work tracker · Next.js · PostgreSQL |
| r-exp-eddy-mcp | Eddy Solutions | MCP server · agent · chat history |
| r-exp-eddy-services | Eddy Solutions | C#/.NET · LoRaWAN · telemetry |
| r-exp-eddy-claude-code | Eddy Solutions | Claude Code · Codex · AGENTS.md |
| r-exp-create-club | Create Club | studio · web apps · AI tooling |
| r-exp-create-club-beverage-agents | Create Club | LangChain · agents · weekly reports |
| r-exp-create-club-imap-mcp | Create Club | MCP · IMAP mail · caching |
| r-exp-create-club-client-apps | Create Club | client apps · Stripe · payments |
| r-exp-pinhous-team | Pinhous Inc. | team lead · React · sprints |
| r-exp-pinhous-kafka | Pinhous Inc. | Kafka · event-driven · property data |
| r-exp-pinhous-cicd | Pinhous Inc. | CI/CD · AWS ECS · CDK |
| r-exp-pinhous-recs-poc | Pinhous Inc. | LangChain · recommendations · PoC |
| r-exp-aro | ARO Inc. | app development · team lead · promotion |
| r-exp-aro-automation | ARO Inc. | Python · extraction · tagging |
| r-exp-aro-etl | ARO Inc. | ETL · CRM · integrations |
| r-exp-aro-docs | ARO Inc. | documentation · on-call · incidents |
| r-exp-duit-signals | Duit.io | fintech · GCP · market signals |
| r-exp-duit-pipelines | Duit.io | Cloud Functions · IAM · dashboards |
| r-build-regdocs-corpus | Nuclear RegDocs assistant | RAG · CNSC documents · citations |
| r-build-regdocs-pipeline | Nuclear RegDocs assistant | chunking · embeddings · pgvector |
| r-build-regdocs-evals | Nuclear RegDocs assistant | golden set · LLM judge · faithfulness |
| r-build-regdocs-guardrails | Nuclear RegDocs assistant | guardrails · rate limits · jailbreaks |
| r-build-regdocs-licensing | Nuclear RegDocs assistant | licensing · NRC guides · fetcher |
| r-build-pulse-app | The Pulse | analytics · pricing · Cloudflare |
| r-build-jobsearch-vectors | Job search | Qdrant · named vectors · job postings |
| r-build-jobsearch-pipeline | Job search | LLM intent · negations · filtered search |
| r-build-jobsearch-refinement | Job search | follow-ups · intent merging · conversation |
| r-build-earned-coach | Earned | habits · AI coach · routines |
| r-community-open-invite | Open Invite | community · Toronto · events |
| r-community-open-invite-events | Open Invite | Cake Picnic · crafts · hosting |
| r-community-open-invite-platform | Open Invite | Next.js · D1 · Stripe |
| r-community-open-invite-ops | Open Invite | ops dashboard · invoices · LLM |
| r-skills | Skills | GenAI · cloud · full stack |
| r-education | Education | nuclear engineering · AI · product |
| r-contact | Contact | Toronto · email · GitHub |

### Personal dots (draft; Raj to edit)

| Dot | Words |
|---|---|
| Humans first | |
| Peace | |
| Fair play | |
| Board games | |
| Second chances | change · good and bad · growth |
| Habits | routines · streaks · consistency |
| Health | skin care · fitness · more active |
| Agnostic | |
| Badminton | |
| Cricket | |
| F1 | |
| Outdoors | hiking · nature · trails |
| Beaches | |
| Plants | |
| Cooking | |
| Cleaning | |
| Guitar | |
| Music | Spotify · top genres · playlists (click → `/mac?open=music`) |
| iOS and Android | |

That makes 19 personal dots and 57 in all.

## Renderer (`cloud/renderer.ts`)

- `CloudOptions.stars` becomes `{ work: number; personal: number }`.
- Dot placement:
  - `pickStars` picks `work + personal` dots.
  - The first `work` picks are the work dots, as now. The rest are personal and fill the gaps between
    them, since picking is farthest-point.
- Star state in `aMeta.y`: hover + 2 × cited + 4 × personal. The fragment shader gets a fourth colour,
  `term-text`, for personal dots, which never flare coral.
- Hover and hit behaviour are as now: the dots stay put, a 24 px hit radius, a 34 px hold radius, and the
  figure holds still while a dot is hovered.

## Hero (`hero.tsx`)

- The card renders from the merged list: name, words, cited marker.
- Clicks:
  - Work dots call `focusAnchor`.
  - Music calls `router.push('/mac?open=music')`.
  - Other personal dots do nothing.
- Caption: "each yellow point is one of the 38 sources my clone can cite; each white one is something I
  love. hover one." The count comes from `STARS`. (Later removed; see Status.)
- The status box stays at 38 public sources.
- The image URLs move to `?v=3`.

## Poster (`public/hero-cloud.webp`, `scripts/portrait-images.py`)

- The poster grows to three 1024² panels (3072 × 1024): points, work dots, personal dots.
- `hero.tsx` masks the third panel with `fill-term-text`.
- The script's Bun snippet asks for both counts.

## Mac (`app/components/desktop/desktop.tsx`)

On mount, `?open=<appId>` opens that app, if it's in `APP_MAP`, through the window manager's `openApp`.
It then strips the query with `history.replaceState`, so a reload doesn't reopen it.

## Tests

- `star-cards` / `stars.test.ts`:
  - Every work anchor has a card with 3 non-empty words.
  - No card exists for an anchor that isn't a star.
  - Personal ids are unique.
  - Words appear only on the five personal dots listed, and only Music has an `href`.
- `sampler.test.ts`: `pickStars` for `work + personal` still spreads the dots out.
- A desktop test, if one fits: `?open=music` opens the Music window.
- By hand, in the browser at 1440, 1280, 1024 and 390 wide:
  - hover a work dot, a name-only personal dot, and Music;
  - click Music, and a work dot;
  - check Saver shows both colours.

## Risks

- **Crowding:** 57 dots instead of 38. If the face reads busy, personal dots drop to a smaller halo (4.5
  px instead of 6) before any are cut.
- **Stale drafts:** the drafted words are guesses from the resume text. Raj edits `content/star-cards.ts`
  before this ships.

## Out of scope

- Publishing Raj's longer statement anywhere.
- Adding personal items to the clone's knowledge base.
- Changing the numbers on the page.
