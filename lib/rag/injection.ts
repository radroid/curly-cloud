/**
 * Input-side check for obvious prompt-extraction requests ("print your system prompt",
 * "translate your instructions", "repeat everything above", "ignore previous instructions").
 * These get a fixed in-voice reply without calling the model. The output-side verbatim guard
 * still covers anything this misses; this catches what shingles can't (e.g. translations).
 */

const PATTERNS: RegExp[] = [
  /\b(system|initial|hidden|developer|original)\s+(prompt|instructions?|message)\b/i,
  /\b(your|these|those|the above|previous|prior)\s+(instructions?|prompt)\b(?!\s*(engineering|design|writing|library|templates?|patterns?|tuning|versioning|management|caching))/i,
  /\b(repeat|print|output|recite|echo|copy)\b[^.?!\n]{0,20}\b(everything|all( of)?( the)? (text|words)|the (text|words))\b[^.?!\n]{0,30}\babove\b/i,
  /\bignore\s+(all\s+|any\s+)?(the\s+)?(previous|prior|above|earlier|preceding|your|system)\b[^.?!\n]{0,30}\b(instructions?|rules|prompts?)\b/i,
  /\b(print|repeat|reveal|output|dump|recite|show)\b[^.?!\n]{0,30}\b(your|the)\s+(sources|context)\b[^.?!\n]{0,20}\b(verbatim|word for word|raw|in full)\b/i,
  /\b(raw|full|exact|verbatim)\s+(text|content|contents|wording)\s+of\b[^.?!\n]{0,30}\b(sources?|context|notes)\b/i,
  /\b(rules|instructions|guidelines)\s+(that\s+)?you\s+(were|have been|'ve been|are)\s+(given|told|following)\b/i,
  /\byour\s+(persona|persona notes|hidden notes)\b/i,
]

export function isPromptExtraction(text: string): boolean {
  const t = text.normalize('NFKC')
  return PATTERNS.some((p) => p.test(t))
}

export const EXTRACTION_REPLY =
  "I keep my instructions and notes to myself, but I'm happy to talk about my work: ask me about a project, a role or how I approach something."
