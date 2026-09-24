/**
 * basePath ของแอป (เช่น '/p19arena') — ตั้งค่าผ่าน NEXT_PUBLIC_BASE_PATH ตอน build
 * ใช้คู่กับ basePath ใน next.config.ts เพื่อ deploy ภายใต้ subpath เช่น https://p19avenue.com/p19arena
 *
 * หมายเหตุ: <Link> ของ Next.js เติม basePath ให้เอง — helper นี้ใช้กับ:
 *  - fetch('/api/...') ฝั่ง client (ไม่ถูกเติม basePath อัตโนมัติ)
 *  - iframe src / raw <a href> / สร้าง URL แบบเต็มด้วย window.location.origin
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

/** เติม basePath ให้ path ภายใน เช่น apiUrl('/api/courts') */
export const apiUrl = (path: string) => `${BASE_PATH}${path}`

/** URL แบบเต็ม เช่น absoluteUrl('/ticket/XXXX1234') → https://p19avenue.com/p19arena/ticket/XXXX1234 */
export const absoluteUrl = (path: string) =>
  typeof window !== 'undefined'
    ? `${window.location.origin}${BASE_PATH}${path}`
    : `${BASE_PATH}${path}`

/**
 * redirect_uri สำหรับ LINE Login — ต้องเป็น URL เดียวกัน "ทุกเครื่อง" (ตรง Callback URL ใน LINE console เป๊ะ)
 * production: ใช้ NEXT_PUBLIC_SITE_URL (baked ตอน build ใน Dockerfile) เพื่อไม่ให้เปลี่ยนตาม
 * host ที่ผู้ใช้พิมพ์/bookmark (เช่น เข้าทาง IP:3001 จะทำให้ redirect_uri เพี้ยน → LINE ตอน 400 เฉพาะเครื่องนั้น)
 * dev/local: fallback เป็น origin ปัจจุบันเหมือนเดิม
 */
export const lineRedirectUri = () => {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '')
  return site ? `${site}/` : absoluteUrl('/')
}
