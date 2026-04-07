export function IMacG3Frame({
  children,
  maxWidth,
}: {
  children: React.ReactNode
  maxWidth: number
}) {
  const isLarge = maxWidth > 400

  return (
    <div style={{ width: isLarge ? '88%' : '100%', maxWidth }}>
      {/* Main body */}
      <div
        style={{
          background:
            'linear-gradient(165deg, #7EE8DB 0%, #3FC8BC 25%, #2AADA3 50%, #1E9B91 75%, #178E85 100%)',
          borderRadius: isLarge ? '28px 28px 12px 12px' : '24px 24px 10px 10px',
          padding: isLarge ? '20px 20px 0' : '10px 10px 0',
          boxShadow:
            '0 8px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.25)',
          border: '1px solid rgba(0,0,0,0.12)',
        }}
      >
        {/* Screen bezel */}
        <div
          style={{
            background: 'linear-gradient(180deg, #2d2d2d, #1a1a1a)',
            borderRadius: isLarge ? '12px 12px 8px 8px' : '10px 10px 6px 6px',
            padding: isLarge ? '12px 12px 10px' : '6px 6px 5px',
          }}
        >
          {children}
        </div>

        {/* Chin */}
        <div
          style={{
            padding: isLarge ? '14px 0 20px' : '12px 0 16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {/* CD slot */}
          <div
            style={{
              width: '45%',
              height: 3,
              background: 'rgba(0,0,0,0.2)',
              borderRadius: 2,
              boxShadow:
                'inset 0 1px 1px rgba(0,0,0,0.3), 0 1px 0 rgba(255,255,255,0.1)',
            }}
          />
          <div
            style={{
              fontSize: isLarge ? 20 : 16,
              color: 'rgba(255,255,255,0.35)',
              lineHeight: 1,
            }}
          >

          </div>
        </div>
      </div>

      {/* Stand */}
      <div
        style={{
          width: '35%',
          height: isLarge ? 8 : 6,
          margin: '0 auto',
          background: 'linear-gradient(180deg, #c0c0c0, #a0a0a0)',
          borderRadius: '0 0 4px 4px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
        }}
      />
    </div>
  )
}
