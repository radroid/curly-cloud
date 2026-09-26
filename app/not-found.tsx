import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-dvh grid place-items-center px-6">
      <div className="max-w-md">
        <p className="font-mono text-sm text-muted">404</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">This page doesn’t exist.</h1>
        <p className="mt-3 text-muted">
          The resume is on the <Link className="text-forest underline underline-offset-4" href="/">home page</Link>, or try the{' '}
          <Link className="text-forest underline underline-offset-4" href="/terminal">terminal</Link>.
        </p>
      </div>
    </main>
  )
}
