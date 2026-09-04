import { PrismaClient } from '@prisma/client'
import { assertEnv } from '@/lib/env'

// ตรวจ environment variables ก่อนสร้าง DB client (fail fast — backend/db)
assertEnv()

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

