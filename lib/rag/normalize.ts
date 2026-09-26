/**
 * Text folding shared by the output guard (lib/rag/guard.ts) and the input check
 * (lib/rag/injection.ts). Both sides of every comparison go through the same steps, so
 * disguises that keep text readable to a person stop mattering:
 *
 *   NFKD (compatibility forms: fullwidth, math letters, ligatures) → drop combining marks and
 *   format characters (\p{M}, \p{Cf}: accents, zero-width spaces/joiners, soft hyphens, BOM)
 *   → look-alike Cyrillic/Greek letters to Latin → lowercase
 *   → leetspeak (0→o 1→i 3→e 4→a 5→s 7→t @→a $→s), only inside tokens that contain a letter,
 *     so plain numbers ("4+ years", a numbered list) stay numbers.
 *
 * NFKD rather than NFKC: it's the same compatibility mapping, but decomposed, so accents can be
 * dropped as marks.
 */

/**
 * Uppercase letters whose lowercase form looks like a different Latin letter (Greek Η → h, not
 * η → n). Σ is here so its context-dependent lowercase (σ/ς) never matters.
 */
const UPPER_LOOKALIKE: Record<string, string> = { Η: 'h', Ν: 'n', Μ: 'm', Υ: 'y', Ϲ: 'c', Σ: 's' }
const UPPER_LOOKALIKE_RE = /[ΗΝΜΥϹΣ]/g

/** Lowercase Cyrillic, Greek and odd Latin letters that pass for Latin ones. Uppercase is lowercased first. */
const LOOKALIKE: Record<string, string> = {
  // Cyrillic (uppercase А В Е К М Н О Р С Т Х У lowercase to these)
  а: 'a', в: 'b', е: 'e', к: 'k', м: 'm', н: 'h', о: 'o', р: 'p', с: 'c', т: 't', у: 'y', х: 'x',
  г: 'r', д: 'd', и: 'u', п: 'n', ш: 'w', ь: 'b', і: 'i', ј: 'j', ѕ: 's', ԁ: 'd', ԛ: 'q', ԝ: 'w', һ: 'h', ү: 'y', ӏ: 'l',
  // Greek
  α: 'a', β: 'b', γ: 'y', ε: 'e', ζ: 'z', η: 'n', ι: 'i', κ: 'k', μ: 'u', ν: 'v', ο: 'o', ρ: 'p', σ: 'o', ς: 's', τ: 't', υ: 'u', χ: 'x', ω: 'w',
  // Latin letters NFKD leaves alone
  ı: 'i', ł: 'l', ø: 'o', đ: 'd', ħ: 'h', ŧ: 't', ƀ: 'b', ɨ: 'i', ɑ: 'a', ɡ: 'g', ß: 'ss', æ: 'ae', œ: 'oe',
}

const LOOKALIKE_RE = new RegExp(`[${Object.keys(LOOKALIKE).join('')}]`, 'g')

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's' }

const MARK_OR_FORMAT = /[\p{M}\p{Cf}]/gu
const HAS_LETTER = /\p{L}/u

/** Fold one code point (see the module comment; no leetspeak). May return '' or several chars. */
export function foldChar(ch: string): string {
  const upper = UPPER_LOOKALIKE[ch]
  if (upper) return upper
  const base = ch.normalize('NFKD').replace(MARK_OR_FORMAT, '').toLowerCase()
  if (base.length === 1) return LOOKALIKE[base] ?? base
  let out = ''
  for (const c of base) out += LOOKALIKE[c] ?? c
  return out
}

const ASCII = /^[\x00-\x7f]*$/

/**
 * Fold a string, keeping for every output char the offset (from `base`) of the input char it came
 * from. `at` is null when folding kept every offset (plain ASCII): then output char i is `base + i`.
 */
export function foldWithOffsets(text: string, base = 0): { text: string; at: number[] | null } {
  if (ASCII.test(text)) return { text: text.toLowerCase(), at: null }
  let out = ''
  const at: number[] = []
  let i = 0
  for (const ch of text) {
    const f = ch < '\u0080' ? ch.toLowerCase() : foldChar(ch)
    for (let k = 0; k < f.length; k++) at.push(base + i)
    out += f
    i += ch.length
  }
  return { text: out, at }
}

/** Same result as `foldWithOffsets(text).text`, with whole-string native calls. */
export function foldText(text: string): string {
  if (ASCII.test(text)) return text.toLowerCase()
  return text
    .replace(UPPER_LOOKALIKE_RE, (c) => UPPER_LOOKALIKE[c])
    .normalize('NFKD')
    .replace(MARK_OR_FORMAT, '')
    .toLowerCase()
    .replace(LOOKALIKE_RE, (c) => LOOKALIKE[c])
}

/** Leetspeak inside a folded token. Tokens without a letter (plain numbers) are left alone. */
export function unleet(token: string): string {
  if (!HAS_LETTER.test(token)) return token
  let out = ''
  for (const c of token) out += LEET[c] ?? c
  return out
}

/**
 * Tokens of folded text: letters/digits plus the leetspeak symbols, joined across apostrophes.
 * Citation markers must be masked before this.
 */
export const TOKEN = /[\p{L}\p{N}@$]+(?:['’][\p{L}\p{N}@$]+)*/gu

/** A folded token as a comparable word: leetspeak undone, apostrophes and leftover symbols removed. */
export function tokenWord(token: string): string {
  if (PLAIN_WORD.test(token)) return token
  return unleet(token).replace(/[^\p{L}\p{N}]/gu, '')
}

const PLAIN_WORD = /^[a-z]+$/

/** Folded, de-leeted words of a text, citation markers ignored. */
export function foldWords(text: string): string[] {
  const out: string[] = []
  for (const m of foldText(text.replace(/\[\d{1,2}\]/g, ' ')).matchAll(TOKEN)) {
    const w = tokenWord(m[0])
    if (w) out.push(w)
  }
  return out
}

/** Folded text with leetspeak undone in every token (for pattern matching on whole messages). */
export function foldTextLeet(text: string): string {
  return foldText(text).replace(TOKEN, (t) => unleet(t))
}
