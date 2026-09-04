/**
 * Environment Variables Validation (backend)
 * ตรวจสอบ env ที่จำเป็นตั้งแต่ startup — fail fast พร้อมข้อความที่อ่านง่าย
 * เรียกใช้จาก src/lib/db.ts (DATABASE_URL) และ src/instrumentation.ts (ทั้งหมดตอน server boot)
 */

export interface EnvIssue {
  key: string
  problem: string
  required: boolean
}

const results: { errors: EnvIssue[]; warnings: EnvIssue[] } = { errors: [], warnings: [] }
let validated = false

export function validateEnv(): { errors: EnvIssue[]; warnings: EnvIssue[] } {
  if (validated) return results
  validated = true

  // ---- DATABASE_URL (จำเป็น — db) ----
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl || dbUrl.trim() === '') {
    results.errors.push({ key: 'DATABASE_URL', problem: 'missing (required) — ตัวอย่าง: file:/app/db/data.db', required: true })
  } else if (dbUrl.startsWith('file:')) {
    const dbPath = dbUrl.slice(5)
    if (!dbPath || dbPath === '/') {
      results.errors.push({ key: 'DATABASE_URL', problem: `invalid SQLite path "${dbUrl}"`, required: true })
    }
  } else if (!/^(postgres|postgresql|mysql):/.test(dbUrl)) {
    results.warnings.push({ key: 'DATABASE_URL', problem: `unknown driver "${dbUrl.split(':')[0]}:" (รองรับ file:/postgres:/mysql:)`, required: true })
  }

  // ---- PORT ----
  const port = process.env.PORT
  if (port !== undefined && (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)) {
    results.errors.push({ key: 'PORT', problem: `invalid "${port}" (ต้องเป็นเลข 1-65535)`, required: false })
  }

  // ---- LINE (ไม่บังคับ — แต่ถ้าใส่มาให้ตรวจรูปแบบ) ----
  const lineSecret = process.env.LINE_CHANNEL_SECRET
  if (lineSecret !== undefined && lineSecret.trim() !== '' && lineSecret.length < 16) {
    results.warnings.push({ key: 'LINE_CHANNEL_SECRET', problem: `suspiciously short (${lineSecret.length} chars) — ตรวจค่าจาก LINE Developers Console`, required: false })
  }
  const lineChannelId = process.env.NEXT_PUBLIC_LINE_CHANNEL_ID
  if (lineChannelId !== undefined && lineChannelId.trim() !== '' && !/^\d{6,}$/.test(lineChannelId.trim())) {
    results.warnings.push({ key: 'NEXT_PUBLIC_LINE_CHANNEL_ID', problem: `unexpected format "${lineChannelId}" (ปกติเป็นตัวเลข)`, required: false })
  }

  // ---- NODE_ENV ----
  if (!['development', 'production', 'test'].includes(process.env.NODE_ENV || '')) {
    results.warnings.push({ key: 'NODE_ENV', problem: `unknown value "${process.env.NODE_ENV}"`, required: false })
  }

  return results
}

/** throw ถ้ามี required env ขาด/ผิด — เรียกตอน startup (server boot เท่านั้น) */
export function assertEnv(): void {
  // ข้ามช่วง next build: "Collecting page data" จะ import route modules ทั้งหมด
  // ทั้งที่ builder stage ยังไม่มี env runtime (DATABASE_URL ถูก set เฉพาะตอน runtime ใน runner)
  // — throw ตรงนี้ตอน build จะทำ docker build พังโดยไม่จำเป็น
  if (process.env.NEXT_PHASE === 'phase-production-build') return
  const { errors, warnings } = validateEnv()
  for (const w of warnings) {
    console.warn(`⚠️  ENV WARN [${w.key}]: ${w.problem}`)
  }
  if (errors.length > 0) {
    const detail = errors.map((e) => `  ✗ ${e.key}: ${e.problem}`).join('\n')
    throw new Error(`Invalid environment variables — server cannot start:\n${detail}`)
  }
}

/** log สรุปสถานะ env (ตอน boot) */
export function logEnvStatus(): void {
  const { errors, warnings } = validateEnv()
  if (errors.length === 0 && warnings.length === 0) {
    console.log('✓ ENV OK — all environment variables valid')
  }
}
