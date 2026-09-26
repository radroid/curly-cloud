# Raj's Clone Stack

`raj-interview.html` is a single, self-contained HyperCard-style stack of interview questions. Every
card Raj answers becomes something his AI clone knows. It runs from `file://` with no network: no
CDNs, no web fonts (Chicago is embedded), nothing sent anywhere.

## Using it

1. Double-click `interview/raj-interview.html` (Chrome or Edge recommended; Safari and Firefox work,
   without dictation in Firefox).
2. Pick a topic from **The stack**, or a mode under **Play**:
   - **Shuffle**: a random unanswered card.
   - **Deep dive**: depth-3 cards only.
   - **Lightning round**: rapid cards, 30 seconds each, with a streak bonus.
   - **Revisit**: your answered and starred cards, to refine.
   - **New cards**: follow-ups from the agent's latest question pack.
   - **Add your own card**: write a prompt we didn't ask, and answer it.
3. Answer in your own words. **Dig deeper** shows the hint, follow-ups and why we ask. The richness
   meter rewards specifics (a number, a name, a concrete example, the trade-off), not length.
   **Dictate** appears when the browser supports speech recognition.
4. **Save & next** (⌘↵ / Ctrl+↵), **Skip**, **Snooze** (back of the stack) or **Star** (favourite).

Everything autosaves to this browser's localStorage as you type. The `file://` storage can be fragile
across browsers and profiles, so use **File › Backup all data** now and then;
**Restore backup** brings it back in any browser.

## Handing answers to the clone

1. **File › Export answers…** Choose *only new or changed since the last export*, or *everything*
   (re-importing unchanged answers is harmless). The file lands in Downloads as
   `raj-clone-answers-YYYY-MM-DD.json`. The menu bar counts unexported answers and the home card
   reminds you at 10.
2. In the repo, tell the agent **"I'm done answering"**. The `ingest-answers` skill
   (`.claude/skills/ingest-answers/`) validates the file, moves it to `private/answers/` (gitignored),
   ingests it (`bun run clone:ingest`), rebuilds the persona, spot-checks the clone, and writes a
   follow-up pack to `private/question-packs/`.
3. **File › Import question pack…** and pick that pack. The new cards show up marked **New**.

To do it by hand instead: move the export into `private/answers/`, then
`bun run clone:ingest private/answers/<file>` and `bun run clone:persona`
(`bun scripts/clone.ts help` lists every command).

**Privacy.** Answers stay in this browser until you export them. They are never part of the HTML,
never committed, and only an admin (`ADMIN_TOKEN` or a studio session) can import them. The question
bank itself is public.

## Building

The HTML is generated and committed so it can be opened without tooling:

```bash
bun scripts/build-interview.ts          # rebuild after editing interview/src or content/questions
bun scripts/build-interview.ts --check  # fail if the committed file is stale (a test does this too)
```

| Source | Role |
|---|---|
| `interview/src/template.html`, `styles.css`, `app.js` | The UI (plain browser JS, no framework) |
| `content/questions/*.ts` | The question bank, one module per topic |
| `lib/interview/core.ts` | Shared rules: state, XP, richness, fidelity, badges, export and pack checks. Transpiled into the page as `window.StackCore`, and imported by the server and tests, so the page exports exactly what the server validates |
| `lib/interview/schema.ts` | zod schemas for `raj-clone-answers` v1 and `raj-clone-question-pack` v1, with per-card error messages |
| `lib/interview/sources.ts` | `answersToSources`: export → private `SourceInput`s |
| `public/fonts/ChicagoFLF.woff` | Embedded as base64 |

**Question ids** are `<topic>-<nnn>` and stable forever: never renumber or reuse one, since answers
are keyed by id. Agent follow-ups use `followup-YYYYMMDD-nn`; custom cards use `custom-<uuid>`.

## File formats

**`raj-clone-answers` v1** (export): `{ format, version: 1, exportedAt, scope: "all" | "since-last-export",
since, bankVersion, stats, answers[] }`. Each answer carries the card (`qid`, `source`: bank | pack |
custom, `topic`, `type`, `depth`, `prompt`, `hint`, `followUps`, `why`, `options`, `scale`), the
`answer` (`text`, plus `choice` for this-or-that, `value` for scale, `parts` for the story scaffold),
`starred`, `answeredAt`, `updatedAt` and `wordCount`.

**`raj-clone-question-pack` v1** (import): `{ format, version: 1, packId, title, createdAt, note?,
questions[] }`, where each question has the bank's shape plus optional `basedOn` ids. See
`.claude/skills/ingest-answers/pack-guide.md`.

**`raj-clone-stack-backup` v1**: the full local state (answers, stars, snoozes, custom and pack cards,
badges, streak days). Only the HTML reads it.
