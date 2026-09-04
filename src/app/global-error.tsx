'use client'

import { useEffect } from 'react'

/**
 * Global error boundary (root layout ล้มเหลวทั้งใบ) — เก็บเข้า /api/errors เช่นกัน
 * ต้องมี <html>/<body> เอง เพราะ layout หลักไม่ถูก render
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    fetch('/api/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        digest: error.digest,
        path: 'global-error',
      }),
    }).catch(() => {})
    console.error('[global-error]', error)
  }, [error])

  return (
    <html lang="th">
      <body style={{ fontFamily: 'sans-serif', background: '#fff', color: '#111', margin: 0 }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div style={{ maxWidth: 420, textAlign: 'center' }}>
            <div style={{ fontSize: 40 }}>:(</div>
            <h2 style={{ margin: '12px 0 6px' }}>เกิดข้อผิดพลาดร้ายแรง</h2>
            <p style={{ fontSize: 13, color: '#666', wordBreak: 'break-word' }}>
              {error.message || 'Something went wrong'}
            </p>
            {error.digest ? (
              <p style={{ fontSize: 11, color: '#999' }}>รหัสอ้างอิง: {error.digest}</p>
            ) : null}
            <button
              onClick={reset}
              style={{
                marginTop: 14,
                padding: '10px 22px',
                borderRadius: 999,
                border: 'none',
                background: '#111',
                color: '#fff',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              ลองอีกครั้ง
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
