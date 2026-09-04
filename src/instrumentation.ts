/**
 * Next.js instrumentation — รันครั้งเดียวตอน server boot (ก่อน serve request แรก)
 * ทำหน้าที่:
 *  1. validate environment variables (fail fast ถ้าขาด/ผิด)
 *  2. ติดตั้ง process-level crash handlers (uncaughtException / unhandledRejection)
 *     → บันทึกลง ErrorLog ผ่าน captureError
 */
export async function register() {
  // dynamic import เพื่อไม่ break edge runtime / build-time
  const { assertEnv, logEnvStatus } = await import('@/lib/env')
  const { captureError } = await import('@/lib/errors')

  try {
    assertEnv()
    logEnvStatus()
  } catch (e) {
    console.error(e instanceof Error ? e.message : e)
    // ใน production ให้โปรเซสตายทันที (docker restart policy จะจัดการต่อ)
    if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV === 'production') {
      process.exit(1)
    }
  }

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    process.on('uncaughtException', (err) => {
      console.error('[crash] uncaughtException:', err)
      void captureError({
        message: err.message || 'uncaughtException',
        stack: err.stack,
        level: 'crash',
        source: 'server',
      })
    })
    process.on('unhandledRejection', (reason) => {
      console.error('[crash] unhandledRejection:', reason)
      const err = reason instanceof Error ? reason : new Error(String(reason))
      void captureError({
        message: err.message || 'unhandledRejection',
        stack: err.stack,
        level: 'unhandledRejection',
        source: 'server',
      })
    })
  }
}
