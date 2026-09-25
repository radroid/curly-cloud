/**
 * Builds interview/raj-interview.html, the single self-contained file Raj double-clicks.
 *
 *   bun scripts/build-interview.ts          write the file
 *   bun scripts/build-interview.ts --check  exit 1 if the committed file is stale
 *
 * Inputs: interview/src/{template.html,styles.css,app.js}, the question bank (content/questions),
 * lib/interview/core.ts (transpiled to plain JS, so the HTML and the server share one set of
 * rules) and public/fonts/ChicagoFLF.woff (inlined as base64). No network, no answers: the output
 * is deterministic and safe to commit.
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { INTERVIEW_TOPICS, QUESTIONS } from '@/content/questions'
import { INTERVIEW_TOPIC_IDS, QUESTION_TYPES } from '@/content/questions/types'

export const ROOT = fileURLToPath(new URL('..', import.meta.url))
export const OUTPUT = join(ROOT, 'interview/raj-interview.html')

const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8')

/** Short, stable id for the bank's content; shown in the app and stamped on every export. */
export function bankVersion(): string {
  return 'b' + createHash('sha256').update(JSON.stringify(QUESTIONS)).digest('hex').slice(0, 10)
}

/** lib/interview/core.ts → an IIFE that defines `window.StackCore`. */
export function compileCore(): string {
  const { outputText, diagnostics } = ts.transpileModule(read('lib/interview/core.ts'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, removeComments: true },
    reportDiagnostics: true,
  })
  if (diagnostics?.length) throw new Error(`core.ts: ${ts.flattenDiagnosticMessageText(diagnostics[0].messageText, '\n')}`)
  if (/\brequire\(/.test(outputText)) throw new Error('lib/interview/core.ts must not have runtime imports (use `import type`).')
  return `var StackCore = (function () {\nvar exports = {};\n${outputText.trim()}\nreturn exports;\n})();`
}

/** JSON that is safe inside <script type="application/json">. */
function scriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

/** Inline 1-bit cloud for the menu bar (same art as the app's `cloud` bitmap). */
const LOGO =
  '<svg class="px" viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M4 2h3v1h-3zM3 3h1v1h-1zM7 3h1v1h-1zM2 4h1v1h-1zM8 4h3v1h-3zM1 5h2v1h-2zM11 5h1v1h-1zM0 6h1v2h-1zM11 6h1v2h-1zM1 8h10v1h-10z"/></svg>'

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (m, key: string) => {
    if (!(key in values)) throw new Error(`Unknown placeholder ${m}`)
    return values[key]
  })
}

export function buildInterviewHtml(): string {
  const version = bankVersion()
  const data = {
    bankVersion: version,
    topics: INTERVIEW_TOPICS.map(({ id, label, blurb }) => ({ id, label, blurb })),
    topicIds: [...INTERVIEW_TOPIC_IDS],
    types: [...QUESTION_TYPES],
    questions: QUESTIONS,
  }
  const font = readFileSync(join(ROOT, 'public/fonts/ChicagoFLF.woff')).toString('base64')
  const style = fill(read('interview/src/styles.css'), { FONT_BASE64: font })
  return fill(read('interview/src/template.html'), {
    STYLE: style.trim(),
    DATA: scriptJson(data),
    CORE: compileCore(),
    APP: read('interview/src/app.js').trim(),
    LOGO,
    BANK_VERSION: version,
    QUESTION_COUNT: String(QUESTIONS.length),
  })
}

if (import.meta.main) {
  const html = buildInterviewHtml()
  if (process.argv.includes('--check')) {
    let current = ''
    try {
      current = readFileSync(OUTPUT, 'utf8')
    } catch {
      /* missing counts as stale */
    }
    if (current !== html) {
      console.error('interview/raj-interview.html is stale. Run: bun scripts/build-interview.ts')
      process.exit(1)
    }
    console.log('interview/raj-interview.html is up to date.')
  } else {
    writeFileSync(OUTPUT, html)
    console.log(`Wrote interview/raj-interview.html: ${(html.length / 1024).toFixed(0)} KB, ${QUESTIONS.length} questions, bank ${bankVersion()}.`)
  }
}
