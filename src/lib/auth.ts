import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

/**
 * การตั้งค่า next-auth (Auth.js v4) — "เข้าสู่ระบบด้วย Google (Gmail)"
 *
 * แนวคิด:
 * - ใช้ Google เป็นผู้ให้บริการตัวตน (scope: openid email profile)
 * - เซสชันของ next-auth เก็บในคุกกี้ของตัวเอง (next-auth.session-token)
 *   → หลังล็อกอินสำเร็จ ฝั่งลูกค้าจะเรียก POST /api/auth/google/sync เพื่อ
 *     สร้าง/อัปเดต User แล้วออกคุกกี้เซสชันเดิมของแอป (p19_customer_session)
 *     ให้กระเป๋าเงิน/Top-up เดิมใช้งานต่อได้ โดยไม่ต้องแก้ API เดิม
 * - AUTH_SECRET ใช้เซ็นทั้งคุกกี้เดิมและ JWT ของ next-auth (ค่าเดียวกัน)
 */
export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      authorization: {
        params: { scope: 'openid email profile', prompt: 'select_account' },
      },
    }),
  ],
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 14 },
  callbacks: {
    async jwt({ token, account, profile }) {
      // account.providerAccountId = ค่า "sub" ของ Google (คงที่ทุกครั้งของบัญชีนั้น)
      if (account?.provider === 'google') {
        token.googleId = account.providerAccountId
      }
      if (profile) {
        const p = profile as { name?: string; email?: string; picture?: string }
        if (p.name) token.name = p.name
        if (p.email) token.email = p.email
        if (p.picture) token.picture = p.picture
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub
        session.user.googleId = token.googleId
      }
      return session
    },
  },
}
