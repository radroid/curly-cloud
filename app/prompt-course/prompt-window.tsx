import { CopyKey } from './prompt-copy'

const DOTS = ['bg-coral-glow', 'bg-sun', 'bg-term-accent']

/** The prompt as a file in a terminal window, line-numbered. Numbers are unselectable so a manual copy stays clean. */
export function PromptWindow({ text, file }: { text: string; file: string }) {
  const lines = text.split('\n')
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-night shadow-[0_30px_80px_rgb(0_0_0/0.4)]">
      <div className="flex items-center gap-3 border-b border-white/10 bg-pine py-2 pl-3.5 pr-2.5">
        <span aria-hidden className="flex gap-[7px]">
          {DOTS.map((dot) => (
            <span key={dot} className={`size-3 rounded-full ${dot}`} />
          ))}
        </span>
        <span className="flex-1 text-center font-mono text-xs text-term-dim max-sm:invisible">~/prompts</span>
        <CopyKey label="copy" size="sm" />
      </div>
      <p className="px-4.5 pt-3.5 font-mono text-[13px] text-term-dim">
        <span className="text-term-accent">$</span> cat {file}
      </p>
      <pre tabIndex={0} aria-label={file} className="max-h-[70vh] overflow-auto px-4.5 pb-5 pt-2 font-mono text-[13px] leading-[1.7] whitespace-pre-wrap">
        {lines.map((line, i) => (
          <span key={i} className="flex">
            <span aria-hidden className="mr-4 w-[2.4em] shrink-0 select-none text-right text-term-dim/40">
              {i + 1}
            </span>
            <span className="min-w-0">{line || ' '}</span>
          </span>
        ))}
      </pre>
    </div>
  )
}
