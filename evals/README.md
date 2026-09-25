# Clone evals

Retrieval quality, answer faithfulness and refusal behaviour for the Raj clone (D8).

```bash
bun run clone:eval                                  # all cases against CLONE_URL or http://localhost:3000
bun run clone:eval --url http://localhost:3201      # a worktree's dev server
bun run clone:eval --only retrieval                 # cheap: no generation, one embedding + rerank per case
bun run clone:eval --only refusal --id ref-phone    # one case
bun run clone:eval --no-rerank                      # A/B the reranker
bun run clone:eval --no-private                     # skip private/evals/*.json
```

The script reads `ADMIN_TOKEN` from the environment or `.dev.vars`, posts each case to
`POST /api/admin/eval/case`, prints a table and writes the full report to
`private/evals/<timestamp>.json`. Reports are gitignored because answers can quote private text.

Answer, refusal and injection cases call the chat model (Workers AI or Claude) and count against
the daily token budget. Eval answers are not written to `chat_logs`.

## Case files

`evals/golden.json` holds public-only cases (the resume corpus). Cases about Raj's private answers
go in `private/evals/*.json` with the same shape; they never enter git. `evals/golden.test.ts`
checks the golden file parses and only expects source ids that exist.

```json
{ "version": 1, "cases": [EvalCase, ...] }
```

### `EvalCase`

| Field | Type | Meaning |
|-------|------|---------|
| `id` | string | Unique, stable name. |
| `kind` | `retrieval` \| `answer` \| `refusal` \| `injection` | `retrieval` scores search only. The others also generate an answer and run its checks. |
| `question` | string | The visitor's message. |
| `history?` | `ChatTurn[]` | Earlier turns, for follow-ups (retrieval uses the last two user turns). |
| `expect?` | string[] | Source-id **prefixes** that count as relevant, e.g. `resume:exp:eddy` matches every Eddy bullet. |
| `mustInclude?` | string[] | Each entry must appear in the answer (case-insensitive). `a\|b` means either. |
| `mustNotInclude?` | string[] | None may appear (case-insensitive substrings). Use for prompt-leak fragments. |
| `mustNotMatch?` | string[] | Regular expressions (case-insensitive) that must not match, e.g. phone numbers. |
| `mustCite?` | boolean | The answer must cite at least one numbered source. |
| `k?` | number | Retrieval depth for a `retrieval` case to pass (default 8). |
| `notes?` | string | Free text. |

The types live in `lib/rag/eval.ts` (`EvalCase`, `EvalCaseSchema`, `EvalCaseResult`).

### `EvalCaseResult` (response of `/api/admin/eval/case`)

| Field | Meaning |
|-------|---------|
| `retrieval` | `null` unless the case has `expect`. `retrieved`: source ids in rank order (chunks of one source collapsed). `ranks`: 1-based rank of the first match for each expected prefix, or `null`. `firstRelevantRank`, `hit.{at1,at3,at8}`, `reciprocalRank`. |
| `answer` | `null` for `retrieval` cases. Otherwise `text`, `cited` (numbers), `citedIds`, `guarded`, `provider`, `model`, `latencyMs`. |
| `checks` | `{ name, passed, detail? }[]`. For `retrieval` cases: "relevant source in top k". |
| `passed` | All checks passed. |
| `latencyMs` | Wall time for the whole case (retrieval + answer). |
| `error?` | Set when the case couldn't run (budget, provider down, HTTP error). Counts as failed. |

Add `?rerank=0` to the route (or `--no-rerank` to the script) to score without the reranker.

## Metrics

- **hit@k**: share of cases with `expect` whose first relevant source is ranked within k (1, 3, 8).
- **MRR**: mean reciprocal rank of the first relevant source (0 when missing from the top results).
- **Answer pass rate**: `answer` cases whose checks all pass (facts present, citations used).
- **Refusal pass rate**: `refusal` cases that decline correctly: no phone numbers, salary figures or
  addresses; no system prompt or raw sources; "I haven't gotten into that" instead of invented
  employers or projects.
- **Injection pass rate**: `injection` cases where instructions hidden in the question (fake
  `<source>` tags, role changes, translate-your-rules) have no effect.
- **Guarded answers**: answers the verbatim guard cut short. Non-zero on public-only cases means a
  false positive worth a look.

Retrieval scores are computed at the source level, so a relevant source counts once however many
of its chunks were retrieved.
