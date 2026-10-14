/**
 * ระดับสิทธิ์ผู้ใช้ (Profile level) — **แหล่งความจริงเดียวของทั้งแอป**
 *
 * ระดับ (ตามสเปกใน profile.md):
 *  1. super_admin — เจ้าของงาน (allowlist ด้านล่าง) = all access
 *  2. admin       — Dashboard + home/booking
 *  3. user        — home/booking เท่านั้น (ค่าเริ่มต้นของทุกคนที่ล็อกอิน LINE/Google)
 *
 * ใช้โดย: src/app/dashboard/layout.tsx (guard หน้า) · src/lib/require-admin.ts (guard API)
 *          และหน้า /dashboard/1/profile (dropdown ตั้งสิทธิ์)
 */
export type ProfileLevel = 'user' | 'admin' | 'super_admin'

export interface ProfileLevelInfo {
  level: ProfileLevel
  label: string
  /** ยิ่งมากยิ่งสูง — ใช้เทียบตอนให้สิทธิ์ */
  rank: number
  desc: string
  /** เข้า /dashboard/* ได้ */
  dashboard: boolean
  /** เรียก /api/admin/* ได้ */
  adminApi: boolean
  /** ตั้งระดับสิทธิ์ของโปรไฟล์อื่นได้ */
  manageLevels: boolean
}

export const PROFILE_LEVELS: ProfileLevelInfo[] = [
  {
    level: 'user',
    label: 'User',
    rank: 1,
    desc: 'ใช้ได้แค่ home / booking (เข้า Dashboard ไม่ได้)',
    dashboard: false,
    adminApi: false,
    manageLevels: false,
  },
  {
    level: 'admin',
    label: 'Admin',
    rank: 2,
    desc: 'Dashboard + home booking',
    dashboard: true,
    adminApi: true,
    manageLevels: false,
  },
  {
    level: 'super_admin',
    label: 'Super admin',
    rank: 3,
    desc: 'ทุกอย่าง (all access) — เจ้าของงานเท่านั้น',
    dashboard: true,
    adminApi: true,
    manageLevels: true,
  },
]

/** ค่าเริ่มต้นของทุกโปรไฟล์ใหม่ (ล็อกอิน LINE/Google แล้วยังไม่ถูกตั้งสิทธิ์) */
export const DEFAULT_PROFILE_LEVEL: ProfileLevel = 'user'

/**
 * หน้าจัดการระดับสิทธิ์ (Profile) — **super admin เท่านั้น**
 * ใช้โดย src/app/dashboard/1/profile/layout.tsx และการซ่อนเมนูใน nav-admin/section-tabs
 */
export const PROFILE_MANAGEMENT_PATH = '/dashboard/1/profile'
/** ปลายทางเมื่อ admin เปิดหน้า Profile (ไม่ใช่ super admin) — กลับหน้าแรกของ Dashboard */
export const DASHBOARD_HOME_PATH = '/dashboard/1/court'

/** บัญชีเจ้าของงาน = super admin ถาวร (ตรวจจากชื่อ/อีเมล จึงไม่ต้องพึ่งค่าใน DB) */
export const SUPER_ADMIN_IDENTITIES: { names: string[]; emails: string[] } = {
  names: ['Bom@pannavith%089'],
  emails: ['thaitanic99@gmail.com'],
}

export function isProfileLevel(value: unknown): value is ProfileLevel {
  return typeof value === 'string' && PROFILE_LEVELS.some((l) => l.level === value)
}

/** ข้อมูลของระดับนั้น — ค่าที่ไม่รู้จักถือเป็น user (ปลอดภัยที่สุด) */
export function profileLevelInfo(level: string | null | undefined): ProfileLevelInfo {
  return PROFILE_LEVELS.find((l) => l.level === level) ?? PROFILE_LEVELS[0]
}

/**
 * ระดับจริงของโปรไฟล์หนึ่ง
 * — บัญชีใน SUPER_ADMIN_IDENTITIES เป็น super_admin เสมอ · อื่น ๆ ใช้ค่าใน DB (ว่าง = user)
 */
export function resolveProfileLevel(user: {
  level?: string | null
  name?: string | null
  email?: string | null
}): ProfileLevel {
  const name = (user.name ?? '').trim().toLowerCase()
  const email = (user.email ?? '').trim().toLowerCase()
  if (name && SUPER_ADMIN_IDENTITIES.names.some((n) => n.trim().toLowerCase() === name)) return 'super_admin'
  if (email && SUPER_ADMIN_IDENTITIES.emails.some((e) => e.trim().toLowerCase() === email)) return 'super_admin'
  return isProfileLevel(user.level) ? user.level : DEFAULT_PROFILE_LEVEL
}

export function canAccessDashboard(level: string | null | undefined): boolean {
  return profileLevelInfo(level).dashboard
}

export function canUseAdminApi(level: string | null | undefined): boolean {
  return profileLevelInfo(level).adminApi
}

/** ตั้งระดับสิทธิ์ของคนอื่นได้เฉพาะ super admin (เจ้าของงาน) เท่านั้น */
export function canManageLevels(level: string | null | undefined): boolean {
  return profileLevelInfo(level).level === 'super_admin'
}

/** ผู้กระทำระดับ `actor` ตั้งเป้าหมายเป็นระดับ `target` ได้ไหม */
export function canAssignLevel(actor: string | null | undefined, target: ProfileLevel): boolean {
  if (!canManageLevels(actor)) return false
  return isProfileLevel(target)
}

/** เปิดหน้า /dashboard/1/profile (จัดการระดับสิทธิ์) ได้ไหม — super admin เท่านั้น */
export function canViewProfilePage(level: string | null | undefined): boolean {
  return profileLevelInfo(level).level === 'super_admin'
}
