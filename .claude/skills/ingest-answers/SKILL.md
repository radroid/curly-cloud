---
name: ingest-answers
description: Feed Raj's interview answers into his AI clone and write the next round of questions. Use when Raj says he's done answering (or finished a batch of cards), mentions or drops a raj-clone-answers-*.json export, asks to update or retrain the clone with his answers, or asks for follow-up questions.
---

# Ingest answers

Raj answers interview cards in `interview/raj-interview.html` and exports `raj-clone-answers-YYYY-MM-DD.json`.
This workflow loads that export into the clone, checks the clone now sounds like him, and hands him a
**question pack** of sharp follow-ups to import back into the stack.

**Privacy guardrail.** Raj's answers are private. They live in `private/` (gitignored) and in the
database, nowhere else. Commits, PRs, issues and every file outside `private/` carry question ids and
counts at most. Quoting his answers back to Raj in this conversation is fine; he owns them.

**Target.** Everything runs against `CLONE_URL` (default `http://localhost:3000`, Raj's dev server)
with `ADMIN_TOKEN` from `.dev.vars`. Production (`CLONE_URL=https://curlycloud.dev` plus the production
`ADMIN_TOKEN`, and the Cloudflare Access service token `CF_ACCESS_CLIENT_ID`/`CF_ACCESS_CLIENT_SECRET`
that Bun loads from `.env.local`) runs only after Raj explicitly says go in this conversation; the CLI then needs `--yes`.

## Steps

1. **Locate the export.** Use the path Raj gives. Otherwise take the newest
   `~/Downloads/raj-clone-answers-*.json` (`ls -t ~/Downloads/raj-clone-answers-*.json | head -1`).
   If there are several unseen ones, list them and ask which to ingest (they can all go; each file is
   idempotent). Done when you hold exactly the path(s) Raj meant.

2. **Validate.** `bun scripts/clone.ts validate <file>`. It prints the answer count, words, and
   answers per topic, or the card and field that's wrong. A broken file stops here: tell Raj which card
   to fix, then re-export. Done when it prints ✓.

3. **Move it into `private/answers/`.**
   `mkdir -p private/answers && mv "<file>" private/answers/`. Then confirm git can't see it:
   `git check-ignore -q private/answers/<name> && git status --porcelain -- private` must print nothing.
   Done when the file sits in `private/answers/` and `git status` shows nothing from `private/`.

4. **Confirm the server.** `curl -sf "${CLONE_URL:-http://localhost:3000}/api/health"` returns
   `{"ok":true,...}`. If it fails, ask Raj to start `bun run dev`, which owns port 3000. For an isolated
   run, start `bunx next dev -p 3206` in the background, use `CLONE_URL=http://localhost:3206` for every
   later command, and stop it at the end. Done when health answers.

5. **Ingest.** `bun run clone:ingest private/answers/<name>`. Expect one ✓ line with answers imported,
   new/changed vs unchanged, chunks, embedded and the corpus version. Re-ingesting unchanged answers is
   safe: they come back as `unchanged`. Done when the line shows no `!` errors. On errors, report them
   and stop.

6. **Rebuild the persona.** `bun run clone:persona`. Read the printed persona against the answers:
   note anything new it picked up, and anything it states that the answers don't support.

7. **Spot-check three.** Pick three answered cards from different topics, favouring long, specific
   answers. For each, ask the clone a *paraphrase* of the card (as a recruiter would ask it, not the card
   text): `bun run clone ask "<paraphrase>"`. Compare with Raj's answer on:
   - **accuracy**: same facts, numbers and positions, nothing invented;
   - **voice**: his phrasing and directness, first person;
   - **citations**: the card appears among the cited sources.
   Done when each of the three has a verdict (good / drifted / wrong) with one line of evidence.

8. **Write the follow-up pack.** Read every answer in the export, then write
   `private/question-packs/pack-YYYY-MM-DD.json` following [pack-guide.md](pack-guide.md): 15–30
   follow-ups aimed at the gaps, contradictions, vague spots and promising threads you found, each
   referencing what he actually said. Validate it with `bun scripts/clone.ts validate <pack>`.
   Done when it prints ✓ and every question's `basedOn` names the card(s) that prompted it.

9. **Hand the pack back.** Tell Raj: open `interview/raj-interview.html`, File › Import question
   pack…, pick the pack path. The new cards show up marked New under the Play › New cards mode.

10. **Summarise.** In chat, report:
    - the file ingested and its counts (answers, new or changed, unchanged, chunks, corpus version);
    - what changed in the persona;
    - the three spot-check verdicts;
    - the pack's themes, with the three follow-ups you'd most like him to answer first;
    - where the files now live.
