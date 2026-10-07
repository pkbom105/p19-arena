import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

// Mount next-auth (Auth.js v4) ที่ /api/auth/* — จัดการ Google OAuth, session, csrf, providers
const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
