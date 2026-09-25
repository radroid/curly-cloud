# Writing a follow-up question pack

A pack is a `raj-clone-question-pack` v1 JSON file the interview stack imports as new cards. The zod
schema is `questionPackSchema` in `lib/interview/schema.ts`; `bun scripts/clone.ts validate <file>`
checks it with friendly errors. The bank in `content/questions/` shows the voice and shape to match.

## Finding what to ask

Read the whole export before writing anything. Each follow-up should come from one of four finds:

- **Gap**: a topic or role he barely touched (compare answers per topic with the bank), or a resume
  item (`content/resume.ts`) no answer mentions yet.
- **Contradiction**: two answers that pull against each other ("ship imperfect" vs "reliability first").
  Ask him to reconcile them, quoting both sides briefly.
- **Vague spot**: an answer with a claim but no example, number, name or trade-off. Ask for the
  concrete instance.
- **Promising thread**: a detail he mentioned in passing that deserves its own story (a person, a
  decision, an incident, a phrase that sounds like a principle).

Aim for a mix across finds and topics; lean toward depth 2–3. Each prompt quotes or paraphrases
what he said, so it reads as a follow-up from someone who listened: *"You said the IMAP prototype
taught you to measure latency on day one. What was the day-ten moment that taught you that?"*

## Rules

- **15–30 questions.** One question per prompt; extra probes go in `followUps` (2–3 specific ones).
- **Ids** `followup-YYYYMMDD-nn` (`nn` from 01), unique across all packs: check
  `private/question-packs/` for ids already used and continue past them. Ids are never reused.
- **packId** `pack-YYYY-MM-DD` (add `-2`, `-3` for a second pack the same day). Lowercase, digits, dashes.
- **topic** is an interview topic: origins, principles, decisions, engineering, ai, leadership,
  conflict, failure, work-style, career, stories, life, lightning, notes.
- **type** is open, story, scenario, this-or-that, scale or rapid.
  - story: `hint` is the scaffold, e.g. `Situation · what you did · what happened · what you'd do differently.`
  - this-or-that: `options` has exactly two short labels.
  - scale: `scale: { min: 1, max: 5, minLabel, maxLabel }`.
- **why**: one sentence on what the clone learns from the answer.
- **basedOn**: the `qid`s of the answers that prompted it.
- **note** (optional): one or two lines to Raj, shown when he imports the pack.
- **Wording**: second person, conversational, plain punctuation (commas, colons, full stops). The
  pack lives in `private/` because its prompts quote his answers.

## Shape

```json
{
  "format": "raj-clone-question-pack",
  "version": 1,
  "packId": "pack-2026-09-25",
  "title": "Round 2: the regdocs hold and what 'boring' means",
  "createdAt": "2026-09-25T18:30:00.000Z",
  "note": "Mostly about the release you held and two answers that seem to disagree.",
  "questions": [
    {
      "id": "followup-20260925-01",
      "topic": "ai",
      "type": "open",
      "depth": 3,
      "prompt": "You said the generation eval was the missing piece before you'd ship regdocs. What exactly would it have measured, and what score would have been good enough?",
      "hint": "Name the metric and the threshold.",
      "followUps": ["Who would have signed off on that threshold?", "What would you have done at 1 point below it?"],
      "why": "How he defines 'good enough' for generation quality, beyond retrieval.",
      "basedOn": ["stories-016"]
    },
    {
      "id": "followup-20260925-02",
      "topic": "principles",
      "type": "this-or-that",
      "depth": 2,
      "prompt": "You picked 'boring and it just works', and elsewhere said the IMAP prototype was the most fun you had all year. When fun and boring collide on a real project, which wins?",
      "options": ["Boring wins", "Fun wins, carefully"],
      "why": "Where his reliability principle bends, and what he trades for enjoyment.",
      "basedOn": ["principles-002", "stories-007"]
    }
  ]
}
```
