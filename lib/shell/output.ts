import type { Line, Segment, SegmentLink, SegmentStyle, Sink } from './types'

/** Anything a command can print: plain strings or styled segments. */
export type Printable = string | Segment | Printable[]

export function seg(text: string, style?: SegmentStyle, link?: SegmentLink): Segment {
  const s: Segment = { text }
  if (style && style !== 'plain') s.style = style
  if (link) s.link = link
  return s
}

export const dim = (text: string): Segment => seg(text, 'dim')
export const accent = (text: string): Segment => seg(text, 'accent')
export const hi = (text: string): Segment => seg(text, 'highlight')
export const err = (text: string): Segment => seg(text, 'error')
export const strong = (text: string): Segment => seg(text, 'strong')

/** A clickable command: shows `label` (default: the command) and runs `command` when clicked. */
export function cmd(command: string, label = command, style: SegmentStyle = 'accent'): Segment {
  return seg(label, style, { kind: 'command', command })
}

export function route(href: string, label = href, style: SegmentStyle = 'accent'): Segment {
  return seg(label, style, { kind: 'route', href })
}

export function url(href: string, label = href, style: SegmentStyle = 'accent'): Segment {
  return seg(label, style, { kind: 'url', href })
}

export function toSegments(p: Printable): Segment[] {
  if (typeof p === 'string') return p ? [{ text: p }] : []
  if (Array.isArray(p)) return p.flatMap(toSegments)
  return p.text ? [p] : []
}

export function write(sink: Sink, ...parts: Printable[]): void {
  const segments = toSegments(parts)
  if (segments.length) sink.write(segments)
}

export function writeln(sink: Sink, ...parts: Printable[]): void {
  sink.write([...toSegments(parts), { text: '\n' }])
}

export function plain(segments: Segment[]): string {
  return segments.map((s) => s.text).join('')
}

/** Collects plain text: used for pipes, redirects and command substitution. */
export class BufferSink implements Sink {
  text = ''
  write(segments: Segment[]): void {
    for (const s of segments) this.text += s.text
  }
}

/** Collects styled segments; used by tests and to render lines. */
export class SegmentSink implements Sink {
  segments: Segment[] = []
  write(segments: Segment[]): void {
    this.segments.push(...segments)
  }
  get text(): string {
    return plain(this.segments)
  }
  lines(): Line[] {
    return appendToLines([], this.segments)
  }
}

/** Writes to several sinks at once (the terminal plus a capture for `learn`). */
export class TeeSink implements Sink {
  constructor(private readonly sinks: Sink[]) {}
  write(segments: Segment[]): void {
    for (const s of this.sinks) s.write(segments)
  }
}

/**
 * Append streamed segments to a list of lines, splitting on '\n'. The last line stays open for
 * more text, exactly like a terminal. Returns a new array; unchanged lines keep their identity so
 * the UI can memoise them.
 */
export function appendToLines(lines: Line[], segments: Segment[]): Line[] {
  const out = lines.slice()
  let current: Line = out.length ? out.pop()!.slice() : []
  for (const s of segments) {
    const pieces = s.text.split('\n')
    pieces.forEach((piece, i) => {
      if (i > 0) {
        out.push(current)
        current = []
      }
      if (piece) current.push({ ...s, text: piece })
    })
  }
  out.push(current)
  return out
}

/** Pad a string to a width, counting characters (not bytes). */
export function pad(text: string, width: number): string {
  const len = [...text].length
  return len >= width ? text : text + ' '.repeat(width - len)
}

export function padStart(text: string, width: number): string {
  const len = [...text].length
  return len >= width ? text : ' '.repeat(width - len) + text
}

/** Word-wrap text to `width` columns. Words longer than the width are left whole. */
export function wrapText(text: string, width: number): string[] {
  if (width < 8 || [...text].length <= width) return [text]
  const lines: string[] = []
  let cur = ''
  for (const word of text.split(/ +/)) {
    if (cur && [...cur].length + 1 + [...word].length > width) {
      lines.push(cur)
      cur = word
    } else cur = cur ? `${cur} ${word}` : word
  }
  if (cur) lines.push(cur)
  return lines
}
