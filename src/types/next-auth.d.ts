import type { DefaultSession } from 'next-auth'

// ต่อยอดชนิดข้อมูลของ next-auth ให้รู้จักฟิลด์ที่เราเพิ่ม (googleId / id)
declare module 'next-auth' {
  interface Session {
    user: {
      id?: string
      googleId?: string
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    googleId?: string
  }
}
