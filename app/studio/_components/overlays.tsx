'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { btn, cx } from '@/app/studio/_components/ui'

function useEscape(onClose: () => void, active: boolean): void {
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose, active])
}

/** Right-hand sheet on desktop, full screen on a phone. */
export function Drawer({ open, onClose, title, eyebrow, children, footer, wide }: {
  open: boolean
  onClose: () => void
  title: ReactNode
  eyebrow?: ReactNode
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  useEscape(onClose, open)
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (open) panel.current?.focus()
  }, [open])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default bg-pine/25 backdrop-blur-[1px]" />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className={cx(
          'absolute inset-y-0 right-0 flex w-full flex-col border-l border-rule bg-paper shadow-2xl shadow-pine/20 outline-none',
          wide ? 'md:w-[min(56rem,92vw)]' : 'md:w-[min(40rem,92vw)]',
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-rule bg-white px-4 py-3 md:px-6">
          <div className="min-w-0">
            {eyebrow ? <div className="mb-1">{eyebrow}</div> : null}
            <h2 className="text-base font-semibold leading-snug text-ink">{title}</h2>
          </div>
          <button type="button" onClick={onClose} className={cx(btn.ghost, 'h-8 shrink-0 px-2')} aria-label="Close panel">
            <svg aria-hidden viewBox="0 0 16 16" className="size-4 stroke-current" fill="none" strokeWidth="1.6">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6">{children}</div>
        {footer ? <div className="border-t border-rule bg-white px-4 py-3 md:px-6">{footer}</div> : null}
      </div>
    </div>
  )
}

export function Modal({ open, onClose, title, children, dismissLabel = 'Done' }: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  dismissLabel?: string
}) {
  useEscape(onClose, open)
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 md:items-center md:p-6">
      <div aria-hidden className="absolute inset-0 bg-pine/40 backdrop-blur-[2px]" />
      <div role="dialog" aria-modal="true" className="relative flex max-h-[92dvh] w-full max-w-2xl flex-col rounded-t-xl border border-rule bg-paper shadow-2xl md:rounded-xl">
        <div className="border-b border-rule px-5 py-3.5">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        <div className="flex justify-end border-t border-rule px-5 py-3">
          <button type="button" onClick={onClose} className={btn.primary}>
            {dismissLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function CopyButton({ text, label = 'Copy', className }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(t)
  }, [copied])
  return (
    <button
      type="button"
      className={cx(btn.secondary, btn.small, className)}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
        } catch {
          // Clipboard blocked (http, permissions): fall back to a hidden textarea.
          const ta = document.createElement('textarea')
          ta.value = text
          document.body.appendChild(ta)
          ta.select()
          document.execCommand('copy')
          ta.remove()
        }
        setCopied(true)
      }}
    >
      <span aria-live="polite">{copied ? 'Copied' : label}</span>
    </button>
  )
}

/** Two-step destructive action: first click arms, second confirms. */
export function ConfirmButton({ onConfirm, label, confirmLabel = 'Confirm', busy, disabled }: {
  onConfirm: () => void
  label: string
  confirmLabel?: string
  busy?: boolean
  disabled?: boolean
}) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 5000)
    return () => clearTimeout(t)
  }, [armed])
  if (!armed) {
    return (
      <button type="button" className={btn.danger} disabled={disabled || busy} onClick={() => setArmed(true)}>
        {label}
      </button>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <button type="button" className={cx(btn.danger, 'bg-coral text-white')} disabled={busy} onClick={onConfirm}>
        {busy ? 'Working…' : confirmLabel}
      </button>
      <button type="button" className={btn.ghost} onClick={() => setArmed(false)}>
        Cancel
      </button>
    </span>
  )
}
