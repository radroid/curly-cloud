import Link from 'next/link'

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
    >
      <div className="mac-dialog" style={{ maxWidth: 360 }}>
        <div style={{ fontSize: 48, marginBottom: 16, lineHeight: 1 }}>☹</div>
        <h1 style={{ fontFamily: 'var(--font-chicago)', fontSize: 16, fontWeight: 'bold', marginBottom: 12 }}>
          Sorry, a system error occurred.
        </h1>
        <p style={{ fontFamily: 'var(--font-chicago)', fontSize: 13, color: '#555', marginBottom: 20 }}>
          The requested page could not be found.
        </p>
        <Link
          href="/"
          style={{
            display: 'inline-block', fontFamily: 'var(--font-chicago)', fontSize: 13,
            padding: '6px 24px', border: '2px solid #000', borderRadius: 6,
            background: '#fff', color: '#000', textDecoration: 'none', boxShadow: '2px 2px 0px #000',
          }}
        >
          Restart
        </Link>
      </div>
    </div>
  )
}
