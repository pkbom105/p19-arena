import { PrismaClient } from '@prisma/client'
import { validateEnv } from '@/lib/env'

// ตรวจ environment variables ก่อนสร้าง DB client (แจ้งเตือนอย่างเดียว — hard fail ทำที่ instrumentation ตอน boot)
// ห้าม throw ที่นี่: ตอน next build จะถูก import โดยไม่มี env runtime ทำให้ build พัง
if (process.env.NEXT_PHASE !== 'phase-production-build') {
  const { errors } = validateEnv()
  if (errors.length > 0) {
    console.error('⚠️  ENV [db]:', errors.map((e) => `${e.key}: ${e.problem}`).join(' | '))
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

