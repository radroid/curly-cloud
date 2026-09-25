/**
 * Verbatim guard (prompt-extraction defence). Pure, synchronous and incremental, so it sits inside
 * the streaming loop. It is given the protected text in the prompt (private chunks, and the system
 * prompt with the persona) and trips when the output reproduces it. Public text in the same prompt
 * (retrieved resume sources, the clone's stock lines) may be repeated freely.
 *
 * Output and protected text are folded the same way first (lib/rag/normalize.ts: NFKD, no
 * zero-width/format chars or accents, Cyrillic/Greek look-alikes → Latin, lowercase, leetspeak),
 * then five checks run:
 *
 * 1. marker    — one of our prompt delimiters (`<source`, `<persona`) appears: the prompt is being dumped.
 * 2. verbatim  — `window` (15) consecutive words match protected text, forwards or in reverse order.
 * 3. aligned   — words that never occur in the protected text are dropped (filler like "banana"),
 *                then a gapped alignment scores the rest against the protected word sequence: +1 per
 *                word that continues the protected run, 0 for skipping one protected word, −1 for an
 *                inserted word (e.g. "and" every tenth word). Trips at a score of `alignWords` (12).
 * 4. letters   — everything but letters is dropped from both sides; trips when the output's last
 *                `letters` (70) letters appear in the protected text, plain or ROT13 (after at most
 *                73 copied letters: windows are indexed at every 4th position). Covers
 *                separators, hyphen-spelling, one-letter-per-line and words run together.
 * 5. encoded   — a long base64/base64url/hex run (≥40 chars, mixed character classes) or ≥20
 *                space-separated hex bytes. Nothing the clone says legitimately looks like that.
 *
 * Holdback: callers release text only up to `releasableIndex(pending, DEFAULT_GUARD_WINDOW,
 * LETTER_HOLDBACK)` and never past `holdFrom()`, the start of the earliest live alignment. So when
 * a check trips, none of the detected run has reached the client: the verbatim window is inside the
 * 15-word holdback, the letters window inside the 73-letter holdback, and an alignment is held
 * from its first word however much filler it contains.
 *
 * Residual leak (what can get through without tripping):
 * - fewer than 12 net aligned words per run (a run that is broken off and restarted can leak
 *   another 11): e.g. chunks of ≤11 protected words separated by ≥3 unrelated words that also
 *   occur in the protected text;
 * - up to ~72 consecutive letters in letter-level disguises (one letter per line, spelled out with
 *   dashes) per run, since the letters window needs 70–73 letters to trip;
 * - encodings with separators (base64 in 4-char groups, decimal char codes), custom ciphers,
 *   Pig Latin and the like;
 * - translation into another language, and close paraphrase with synonyms. These can't be caught
 *   cheaply by text matching; the input check (lib/rag/injection.ts) refuses requests that ask for
 *   them, and the system prompt tells the model not to comply. See evals/README.md.
 */
import { foldWithOffsets, foldWords, TOKEN, tokenWord } from '@/lib/rag/normalize'

export const DEFAULT_GUARD_WINDOW = 15
export const DEFAULT_ALIGN_WORDS = 12
export const DEFAULT_LETTER_WINDOW = 70
/**
 * Letter windows are indexed at every LETTER_STRIDE-th position only (a quarter of the hashing);
 * the output is checked at every position, so a copied run is found once it is
 * `letters + LETTER_STRIDE - 1` letters long.
 */
const LETTER_STRIDE = 4
/** Letters to hold back so that no part of a run the letters check detects has been released. */
export const LETTER_HOLDBACK = DEFAULT_LETTER_WINDOW + LETTER_STRIDE - 1
/** A protected word counts as public when it sits inside an 8-word run that also appears in an allow text. */
const ALLOW_GRAM = 8

/** Our own prompt delimiters never belong in an answer; seeing one means the prompt is being dumped. Must not be global. */
export const PROMPT_MARKERS = /<\s*\/?\s*(?:sources?|persona)\b/i

export type GuardReason = 'marker' | 'verbatim' | 'aligned' | 'letters' | 'encoded'

/** Why the guard tripped, and where: absolute char offsets into everything pushed so far. */
export interface GuardTrip {
  reason: GuardReason
  start: number
  end: number
}

export interface GuardOptions {
  /** Consecutive words for the verbatim check (default 15, min 4). */
  window?: number
  /** Alignment score that trips (default min(12, window)). */
  alignWords?: number
  /** Letters-only window (default 70). */
  letters?: number
  /** Public text in the same prompt; runs found there are not protected. */
  allowTexts?: string[]
  /** Pattern on folded raw text that trips immediately (e.g. PROMPT_MARKERS). Must not be global. */
  forbidden?: RegExp
}

/** The protected text, pre-processed once per request and shared by any number of guards. */
export interface GuardIndex {
  readonly window: number
  readonly alignWords: number
  readonly letters: number
  readonly empty: boolean
  /** Every word of the protected text → id. Output words not in here are filler to the alignment. */
  readonly vocab: Map<string, number>
  /** Protected word ids, one text after another, separated by -1. */
  readonly seq: Int32Array
  /** 1 where that protected word is private (not inside an allow-listed run). */
  readonly counted: Uint8Array
  /** Where an alignment may start: word-pair key (see `pairKey`) → index of the pair's second word. */
  readonly starts: Map<number, number[]>
  /** Hashes (`runHash` of word ids) of `window`-word runs, forwards and reversed, with at least one private word. */
  readonly exact: Set<number>
  /** Rolling hashes of the `letters`-letter windows of the private text (every LETTER_STRIDE-th start). */
  readonly letterHashes: Set<number>
  /** The private letters, segments joined by "|", to confirm a hash hit. */
  readonly letterText: string
}

// ── Holdback ─────────────────────────────────────────────────────────────────

const WORD = /[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu
const LETTER = /\p{L}/gu

/**
 * Index up to which `text` can be released while still holding back at least its last `words`
 * words and its last `letters` letters (citation markers don't count). Returns a word start.
 */
export function releasableIndex(text: string, words: number, letters = 0): number {
  const masked = text.replace(/\[\d{1,2}\]/g, (m) => ' '.repeat(m.length))
  const found = [...masked.matchAll(WORD)]
  let held = 0
  let heldLetters = 0
  for (let i = found.length - 1; i >= 0; i--) {
    held++
    heldLetters += found[i][0].match(LETTER)?.length ?? 0
    if (held >= words && heldLetters >= letters) return i === 0 ? 0 : (found[i].index ?? 0)
  }
  return 0
}

// ── Index ────────────────────────────────────────────────────────────────────

/** Folded, de-leeted words with citation markers ignored. */
export function normalizeWords(text: string): string[] {
  return foldWords(text)
}

export function shingles(words: string[], window: number): Set<string> {
  const out = new Set<string>()
  for (let i = 0; i + window <= words.length; i++) out.add(words.slice(i, i + window).join(' '))
  return out
}

const HASH_BASE = 0x01000193

function hashPow(base: number, n: number): number {
  let p = 1
  for (let i = 0; i < n; i++) p = Math.imul(p, base)
  return p
}

/** Rolling hashes of the `size`-letter windows of `s` that start at a multiple of `stride`. */
function addWindowHashes(s: string, size: number, stride: number, out: Set<number>): void {
  if (s.length < size) return
  const pow = hashPow(HASH_BASE, size - 1)
  let h = 0
  for (let i = 0; i < s.length; i++) {
    if (i >= size) h = (h - Math.imul(s.charCodeAt(i - size), pow)) | 0
    h = (Math.imul(h, HASH_BASE) + s.charCodeAt(i)) | 0
    if (i >= size - 1 && (i - size + 1) % stride === 0) out.add(h)
  }
}

// Runs of numbers (word ids, word hashes) hash to 53 bits: two 32-bit polynomial hashes with
// different bases, 32 + 21 bits of them. Collisions are ~2^-53 per pair.
const RUN_BASE_A = 0x01000193
const RUN_BASE_B = 0x5bd1e995
const TWO21 = 2 ** 21

/** Hash of `values[from..to)`, walked forwards or backwards. Same value as `runHashes` gives for that run. */
function runHash(values: ArrayLike<number>, from: number, to: number, reverse = false): number {
  let a = 0
  let b = 0
  for (let k = 0; k < to - from; k++) {
    const v = values[reverse ? to - 1 - k : from + k] + 2
    a = (Math.imul(a, RUN_BASE_A) + v) | 0
    b = (Math.imul(b, RUN_BASE_B) + v) | 0
  }
  return (a >>> 0) * TWO21 + (b >>> 11)
}

/** `runHash` of every `size`-long run of `values`, by start index (rolling, O(n)). */
function runHashes(values: ArrayLike<number>, size: number): number[] {
  const out: number[] = []
  if (values.length < size) return out
  const powA = hashPow(RUN_BASE_A, size - 1)
  const powB = hashPow(RUN_BASE_B, size - 1)
  let a = 0
  let b = 0
  for (let i = 0; i < values.length; i++) {
    if (i >= size) {
      a = (a - Math.imul(values[i - size] + 2, powA)) | 0
      b = (b - Math.imul(values[i - size] + 2, powB)) | 0
    }
    a = (Math.imul(a, RUN_BASE_A) + values[i] + 2) | 0
    b = (Math.imul(b, RUN_BASE_B) + values[i] + 2) | 0
    if (i >= size - 1) out.push((a >>> 0) * TWO21 + (b >>> 11))
  }
  return out
}

/** Key for a pair of consecutive word ids. */
const pairKey = (a: number, b: number): number => a * 2 ** 26 + b

/** 32-bit FNV-1a of a word, so runs of words can be hashed without joining strings. */
function wordHash(w: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < w.length; i++) h = Math.imul(h ^ w.charCodeAt(i), 0x01000193)
  return h
}

/** Hashes of every ALLOW_GRAM-word run of a public text. The public resume is the same text every request. */
const allowCache = new Map<string, number[]>()
const ALLOW_CACHE_MAX = 400

function allowGrams(text: string): number[] {
  let grams = allowCache.get(text)
  if (!grams) {
    grams = runHashes(foldWords(text).map(wordHash), ALLOW_GRAM)
    if (allowCache.size >= ALLOW_CACHE_MAX) allowCache.clear()
    allowCache.set(text, grams)
  }
  return grams
}

/** ROT13 of a lowercase letter's char code (other letters unchanged). */
const rot13Code = (c: number): number => (c >= 97 && c <= 122 ? ((c - 84) % 26) + 97 : c)

const NON_LETTER_CHAR = /[^\p{L}]/u

/** The letters of a folded word, per UTF-16 unit (the same on both sides of the letters check). */
function lettersOf(w: string): string {
  let out = ''
  for (let k = 0; k < w.length; k++) {
    const c = w.charCodeAt(k)
    if ((c >= 97 && c <= 122) || (c > 127 && !NON_LETTER_CHAR.test(w[k]))) out += w[k]
  }
  return out
}

export function buildGuardIndex(protectedTexts: string[], opts: Omit<GuardOptions, 'forbidden'> = {}): GuardIndex {
  const window = Math.max(4, opts.window ?? DEFAULT_GUARD_WINDOW)
  const alignWords = Math.max(4, opts.alignWords ?? Math.min(DEFAULT_ALIGN_WORDS, window))
  const letters = Math.max(20, opts.letters ?? DEFAULT_LETTER_WINDOW)

  const allow = new Set<number>()
  for (const t of opts.allowTexts ?? []) for (const g of allowGrams(t)) allow.add(g)

  const vocab = new Map<string, number>()
  const seq: number[] = []
  const counted: number[] = []
  const starts = new Map<number, number[]>()
  const exact = new Set<number>()
  const letterHashes = new Set<number>()
  const segments: string[] = []

  for (const text of protectedTexts) {
    const words = foldWords(text)
    if (!words.length) continue

    // Words inside an 8-word run that also appears in public text are public.
    const isPublic = new Uint8Array(words.length)
    if (allow.size) {
      const grams = runHashes(words.map(wordHash), ALLOW_GRAM)
      for (let i = 0; i < grams.length; i++) if (allow.has(grams[i])) isPublic.fill(1, i, i + ALLOW_GRAM)
    }

    const ids = words.map((w) => {
      let id = vocab.get(w)
      if (id === undefined) {
        id = vocab.size
        vocab.set(w, id)
      }
      return id
    })
    const offset = seq.length
    for (let i = 0; i < ids.length; i++) {
      seq.push(ids[i])
      counted.push(isPublic[i] ? 0 : 1)
      if (i > 0 && !(isPublic[i - 1] && isPublic[i])) {
        const key = pairKey(ids[i - 1], ids[i])
        const at = starts.get(key)
        if (at) at.push(offset + i)
        else starts.set(key, [offset + i])
      }
    }
    seq.push(-1)
    counted.push(0)

    // `window`-word runs with at least one private word, forwards and reversed.
    const publicBefore = new Uint32Array(ids.length + 1)
    for (let i = 0; i < ids.length; i++) publicBefore[i + 1] = publicBefore[i] + isPublic[i]
    const forward = runHashes(ids, window)
    const backward = runHashes([...ids].reverse(), window)
    for (let i = 0; i < forward.length; i++) {
      if (publicBefore[i + window] - publicBefore[i] === window) continue
      exact.add(forward[i])
      exact.add(backward[forward.length - 1 - i])
    }

    let segment = ''
    const flush = (): void => {
      if (segment.length >= letters) {
        addWindowHashes(segment, letters, LETTER_STRIDE, letterHashes)
        segments.push(segment)
      }
      segment = ''
    }
    for (let i = 0; i < words.length; i++) {
      if (isPublic[i]) flush()
      else segment += lettersOf(words[i])
    }
    flush()
  }

  return {
    window,
    alignWords,
    letters,
    empty: seq.length === 0,
    vocab,
    seq: Int32Array.from(seq),
    counted: Uint8Array.from(counted),
    starts,
    exact,
    letterHashes,
    letterText: segments.join('|'),
  }
}

// ── Encoded blocks ───────────────────────────────────────────────────────────

const B64_RUN = /(?:[A-Za-z0-9+/]\p{Cf}*){40,}/gu
const B64URL_RUN = /(?:[A-Za-z0-9_-]\p{Cf}*){40,}/gu
const HEX_RUN = /(?:[0-9A-Fa-f]\p{Cf}*){40,}/gu
const HEX_BYTES = /(?<![0-9A-Za-z])(?:(?:0x)?[0-9A-Fa-f]{2}(?![0-9A-Za-z])[\s,;:]*){20,}/gu
const count = (s: string, re: RegExp): number => s.match(re)?.length ?? 0

/** Cheap pre-checks: 40 non-space chars in a row, or eight hex-looking pairs with spaces. */
const LONG_RUN_HINT = /\S{40}/
const HEX_BYTES_HINT = /(?:[0-9A-Fa-f]{2}[\s,;:]+){8}/

/** A run that looks like base64 or hex, or null. Tech stacks joined by "/" have too few digits to count. */
export function findEncodedRun(text: string): { index: number; length: number } | null {
  const long = LONG_RUN_HINT.test(text)
  if (!long && !HEX_BYTES_HINT.test(text)) return null
  for (const re of long ? [B64_RUN, B64URL_RUN] : []) {
    for (const m of text.matchAll(re)) {
      const s = m[0].replace(/\p{Cf}/gu, '')
      if (count(s, /\d/g) >= 3 && count(s, /[A-Z]/g) >= 3 && count(s, /[a-z]/g) >= 3 && count(s, /[+/_-]/g) * 12 <= s.length) {
        return { index: m.index ?? 0, length: m[0].length }
      }
    }
  }
  for (const m of long ? text.matchAll(HEX_RUN) : []) {
    const s = m[0].replace(/\p{Cf}/gu, '')
    if (count(s, /\d/g) >= 4 && count(s, /[a-f]/gi) >= 4) return { index: m.index ?? 0, length: m[0].length }
  }
  for (const m of text.matchAll(HEX_BYTES)) {
    if (count(m[0], /[a-f]/gi) >= 4) return { index: m.index ?? 0, length: m[0].length }
  }
  return null
}

// ── Guard ────────────────────────────────────────────────────────────────────

export interface VerbatimGuard {
  /** Feed the next piece of output. Returns true once protected text has been reproduced. */
  push(text: string): boolean
  /** Flush a trailing partial word. */
  finish(): boolean
  readonly tripped: boolean
  readonly trip: GuardTrip | null
  /**
   * Absolute offset (into everything pushed) of the earliest word a live alignment started at:
   * release nothing from here on. Equals the pushed length when nothing is being tracked.
   */
  holdFrom(): number
}

interface AlignState {
  score: number
  start: number
}

const MAX_ALIGN_STATES = 4096
const CITATION = /\[\d{1,2}\]/g
const TRAILING_TOKEN = /[\p{L}\p{N}@$'’]+$/u

/**
 * @param source protected texts (private text and the system prompt), or an index built from them
 * @param opts.allowTexts public text in the same prompt (ignored when `source` is an index)
 * @param opts.forbidden pattern that trips immediately (e.g. our prompt delimiters)
 */
export function createVerbatimGuard(source: string[] | GuardIndex, opts: GuardOptions = {}): VerbatimGuard {
  const index = Array.isArray(source) ? buildGuardIndex(source, opts) : source
  const { seq, counted, vocab, starts, exact, letterHashes, letterText, window, alignWords, letters } = index
  const forbidden = opts.forbidden
  const letterPow = hashPow(HASH_BASE, letters - 1)

  let pushed = 0
  let carry = ''
  let carryStart = 0
  let trip: GuardTrip | null = null

  const recentIds: number[] = []
  const recentStarts: number[] = []
  let states = new Map<number, AlignState>()
  let prevId = -1
  let prevStart = 0
  // Last `letters` letters as a ring buffer of char codes, with the start of the word each came from.
  const ring = new Uint16Array(letters)
  const ringStarts = new Float64Array(letters)
  let ringHead = 0
  let ringSize = 0
  let lhash = 0
  let lhashRot = 0
  let rawTail = ''
  let foldTail = ''

  const setTrip = (reason: GuardReason, start: number, end: number): boolean => {
    trip = { reason, start: Math.max(0, start), end }
    return true
  }

  /** One step of the alignment for the next output word that occurs in the protected text. */
  const align = (id: number, ws: number, we: number): boolean => {
    const next = new Map<number, AlignState>()
    const put = (j: number, score: number, start: number): void => {
      if (score <= 0) return
      const cur = next.get(j)
      if (!cur || score > cur.score || (score === cur.score && start < cur.start)) next.set(j, { score, start })
    }
    for (const [j, st] of states) {
      const pj = seq[j]
      if (pj === id) put(j + 1, st.score + counted[j], st.start)
      else if (pj !== -1 && seq[j + 1] === id) put(j + 2, st.score + counted[j + 1] - 1, st.start)
      else put(j, st.score - 1, st.start)
    }
    // New alignments start from a pair of consecutive words (single common words would start hundreds).
    if (prevId >= 0) for (const i of starts.get(pairKey(prevId, id)) ?? []) put(i + 1, counted[i - 1] + counted[i], prevStart)
    prevId = id
    prevStart = ws
    if (next.size > MAX_ALIGN_STATES) for (const [j, st] of next) if (st.score < 2) next.delete(j)
    states = next
    for (const st of next.values()) if (st.score >= alignWords) return setTrip('aligned', st.start, we)
    return false
  }

  const roll = (h: number, out: number, code: number): number => (Math.imul((h - Math.imul(out, letterPow)) | 0, HASH_BASE) + code) | 0
  const windowText = (rot: boolean): string => {
    let text = ''
    for (let k = 0; k < letters; k++) {
      const c = ring[(ringHead + k) % letters]
      text += String.fromCharCode(rot ? rot13Code(c) : c)
    }
    return text
  }

  /** Next output letter; the window is checked plain and ROT13-decoded. */
  const letter = (code: number, ws: number, we: number): boolean => {
    const rot = rot13Code(code)
    if (ringSize === letters) {
      const out = ring[ringHead]
      lhash = roll(lhash, out, code)
      lhashRot = roll(lhashRot, rot13Code(out), rot)
      ring[ringHead] = code
      ringStarts[ringHead] = ws
      ringHead = (ringHead + 1) % letters
    } else {
      lhash = (Math.imul(lhash, HASH_BASE) + code) | 0
      lhashRot = (Math.imul(lhashRot, HASH_BASE) + rot) | 0
      ring[ringSize] = code
      ringStarts[ringSize] = ws
      ringSize++
    }
    if (ringSize < letters) return false
    if ((letterHashes.has(lhash) && letterText.includes(windowText(false))) || (letterHashes.has(lhashRot) && letterText.includes(windowText(true)))) {
      return setTrip('letters', ringStarts[ringHead], we)
    }
    return false
  }

  const word = (w: string, ws: number, we: number): boolean => {
    const id = vocab.get(w) ?? -1
    recentIds.push(id)
    recentStarts.push(ws)
    if (recentIds.length > window) {
      recentIds.shift()
      recentStarts.shift()
    }
    if (recentIds.length === window && !recentIds.includes(-1) && exact.has(runHash(recentIds, 0, window))) {
      return setTrip('verbatim', recentStarts[0], we)
    }
    if (id >= 0 && align(id, ws, we)) return true
    const ls = lettersOf(w)
    for (let k = 0; k < ls.length; k++) if (letter(ls.charCodeAt(k), ws, we)) return true
    return false
  }

  /** Words of `raw` (starting at absolute `base`); keeps a trailing partial token unless `final`. */
  const words = (raw: string, base: number, final: boolean): boolean => {
    const masked = raw.replace(CITATION, (m) => ' '.repeat(m.length))
    const { text: folded, at } = foldWithOffsets(masked, base)
    let end = folded.length
    if (!final) {
      const tail = TRAILING_TOKEN.exec(folded)
      if (tail) end = tail.index
      const cutAbs = end < folded.length ? (at ? at[end] : base + end) : base + raw.length
      carry = raw.slice(cutAbs - base)
      carryStart = cutAbs
    }
    for (const m of folded.slice(0, end).matchAll(TOKEN)) {
      const w = tokenWord(m[0])
      if (!w) continue
      const i = m.index ?? 0
      const last = i + m[0].length - 1
      if (word(w, at ? at[i] : base + i, (at ? at[last] : base + last) + 1)) return true
    }
    return false
  }

  const raw = (text: string, start: number): boolean => {
    if (forbidden) {
      const folded = foldWithOffsets(text, start)
      const win = foldTail + folded.text
      const m = forbidden.exec(win)
      if (m) {
        // Map the match back to raw offsets (approximate when it began in the carried-over tail).
        const i = m.index - foldTail.length
        const at = (k: number): number => (k < 0 ? start + k : folded.at ? (folded.at[k] ?? start + text.length) : start + k)
        return setTrip('marker', at(i), at(i + m[0].length - 1) + 1)
      }
      foldTail = win.slice(-24)
    }
    if (index.empty) return false
    const win = rawTail + text
    const found = findEncodedRun(win)
    const winStart = start - rawTail.length
    if (found) return setTrip('encoded', winStart + found.index, winStart + found.index + found.length)
    rawTail = win.slice(-160)
    return false
  }

  return {
    get tripped() {
      return trip !== null
    },
    get trip() {
      return trip
    },
    holdFrom(): number {
      let from = pushed
      for (const st of states.values()) if (st.start < from) from = st.start
      return from
    },
    push(text: string): boolean {
      if (trip) return true
      const start = pushed
      pushed += text.length
      if (raw(text, start)) return true
      if (index.empty) return false
      const base = carry ? carryStart : start
      return words(carry + text, base, false)
    },
    finish(): boolean {
      if (trip) return true
      if (index.empty || !carry) return false
      const rest = carry
      carry = ''
      return words(rest, carryStart, true)
    },
  }
}
