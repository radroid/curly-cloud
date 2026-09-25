/** Tiny getopt: `-la`, `-n 5`, `-n5`, `-5` (numeric shorthand), `--json`, `--grep x`, `--`. */

export interface ArgSpec {
  /** Single-letter boolean flags, e.g. 'la' for -l -a. */
  bool?: string
  /** Single-letter flags that take a value, e.g. 'n' for -n 5. */
  value?: string
  /** Long boolean flags without dashes, e.g. ['json']. */
  long?: string[]
  /** Long flags that take a value, e.g. ['grep']. */
  longValue?: string[]
  /** Treat `-5` as `-n 5` (head/tail). */
  numeric?: string
}

export interface ParsedArgs {
  flags: Set<string>
  values: Map<string, string>
  operands: string[]
  error: string | null
}

export function parseArgs(args: string[], spec: ArgSpec): ParsedArgs {
  const flags = new Set<string>()
  const values = new Map<string, string>()
  const operands: string[] = []
  const bool = spec.bool ?? ''
  const value = spec.value ?? ''
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--') {
      operands.push(...args.slice(i + 1))
      break
    }
    if (a.startsWith('--') && a.length > 2) {
      const [name, inline] = a.slice(2).split(/=(.*)/s, 2)
      if (spec.long?.includes(name)) {
        flags.add(name)
        continue
      }
      if (spec.longValue?.includes(name)) {
        const v = inline ?? args[++i]
        if (v === undefined) return { flags, values, operands, error: `option '--${name}' requires an argument` }
        values.set(name, v)
        continue
      }
      return { flags, values, operands, error: `unrecognized option '${a}'` }
    }
    if (a.startsWith('-') && a.length > 1) {
      if (spec.numeric && /^-\d+$/.test(a)) {
        values.set(spec.numeric, a.slice(1))
        continue
      }
      for (let j = 1; j < a.length; j++) {
        const c = a[j]
        if (value.includes(c)) {
          const rest = a.slice(j + 1)
          const v = rest || args[++i]
          if (v === undefined) return { flags, values, operands, error: `option requires an argument -- '${c}'` }
          values.set(c, v)
          break
        }
        if (bool.includes(c)) {
          flags.add(c)
          continue
        }
        return { flags, values, operands, error: `invalid option -- '${c}'` }
      }
      continue
    }
    operands.push(a)
  }
  return { flags, values, operands, error: null }
}

/** Damerau-Levenshtein (optimal string alignment) distance. */
export function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)])
  for (let j = 0; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[a.length][b.length]
}

/** Closest candidate within a small distance, e.g. `sl` → `ls`. */
export function suggest(word: string, candidates: Iterable<string>): string | null {
  let best: string | null = null
  let bestDist = Infinity
  const max = word.length <= 3 ? 1 : 2
  for (const c of candidates) {
    if (c === word) continue
    const dist = editDistance(word.toLowerCase(), c.toLowerCase())
    if (dist < bestDist || (dist === bestDist && best !== null && c.length < best.length)) {
      best = c
      bestDist = dist
    }
  }
  return bestDist <= max ? best : null
}
