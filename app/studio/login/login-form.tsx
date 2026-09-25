'use client'

import { useState, type FormEvent } from 'react'
import { btn, cx, input, Spinner } from '@/app/studio/_components/ui'

export function LoginForm({ next }: { next: string }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!password || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        // Full navigation so the server layout sees the new cookie.
        window.location.replace(next)
        return
      }
      const body = (await res.json().catch(() => null)) as { error?: { message?: string; retryAfterSeconds?: number } } | null
      if (res.status === 429) {
        const minutes = Math.max(1, Math.ceil((body?.error?.retryAfterSeconds ?? 3600) / 60))
        setError(`Too many attempts. Try again in ${minutes} min.`)
      } else {
        setError(body?.error?.message ?? 'Sign-in failed.')
      }
      setPassword('')
    } catch {
      setError('Network error. Is the server running?')
    }
    setBusy(false)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-ink">Sign in</h2>
        <p className="mt-1 text-sm text-muted">Enter the studio passphrase.</p>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="passphrase" className="block font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">
          Passphrase
        </label>
        <input
          id="passphrase"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'login-error' : undefined}
          className={cx(input, 'h-11 font-mono tracking-wider')}
        />
      </div>
      {error ? (
        <p id="login-error" role="alert" className="text-sm text-coral">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={busy || !password} className={cx(btn.primary, 'h-11 w-full')}>
        {busy ? (
          <>
            <Spinner /> Checking…
          </>
        ) : (
          'Enter the studio'
        )}
      </button>
    </form>
  )
}
