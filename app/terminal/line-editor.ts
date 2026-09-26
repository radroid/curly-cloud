/** Pure helpers for the input line: readline-style edits and double-Tab listings. No React, no DOM state. */

export interface Edit {
  value: string
  caret: number
}

/** Ctrl-U: delete from the start of the line to the caret (bash's unix-line-discard). */
export function killToStart(value: string, caret: number): Edit {
  return { value: value.slice(caret), caret: 0 }
}

/** Ctrl-W: delete the whitespace-delimited word before the caret (bash's unix-word-rubout). */
export function killWordBefore(value: string, caret: number): Edit {
  let i = caret
  while (i > 0 && /\s/.test(value[i - 1])) i--
  while (i > 0 && !/\s/.test(value[i - 1])) i--
  return { value: value.slice(0, i) + value.slice(caret), caret: i }
}

function width(text: string): number {
  return [...text].length
}

/** Lay completion candidates out in columns, top to bottom like `ls`, to fit `columns` characters. */
export function formatColumns(options: readonly string[], columns: number): string[] {
  if (!options.length) return []
  const cell = Math.max(...options.map(width)) + 2
  const perRow = Math.max(1, Math.floor((columns + 2) / cell))
  const rows = Math.ceil(options.length / perRow)
  const out: string[] = []
  for (let r = 0; r < rows; r++) {
    let row = ''
    for (let c = 0; c < perRow; c++) {
      const option = options[c * rows + r]
      if (option !== undefined) row += option + ' '.repeat(cell - width(option))
    }
    out.push(row.trimEnd())
  }
  return out
}

/** True when the visitor has text selected (in the input or the page), so Ctrl-C should copy, not interrupt. */
export function hasTextSelection(input?: HTMLInputElement | null): boolean {
  if (input && input.selectionStart !== input.selectionEnd) return true
  const selection = window.getSelection()
  return !!selection && selection.toString().length > 0
}
