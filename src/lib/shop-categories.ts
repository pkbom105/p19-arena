/**
 * หมวดสินค้าของร้าน POS — เก็บในตาราง ShopCategory (เพิ่มหมวดใหม่ได้จากหน้า /dashboard/shop-setting)
 *
 * หมายเหตุ: SHOP_CATEGORIES ใน components/pos-shop/catalog.ts ถูกใช้เป็น (1) ข้อมูล seed ครั้งแรก
 * ของตารางนี้ (2) ชุดสำรองฝั่ง client เมื่อเรียก API ไม่สำเร็จ — เพิ่มหมวดผ่าน UI แล้วค่าคงที่นี้ไม่ต้องแก้
 */

import { db } from '@/lib/db'
import { SHOP_CATEGORIES } from '@/components/pos-shop/catalog'
import type { ShopCategoryRow } from '@/components/pos-shop/types'

/** ฟิลด์ขั้นต่ำที่ต้องมีเพื่อแปลงเป็นหมวดฝั่ง client (รองรับค่าที่เป็น null จาก DB) */
export interface ShopCategoryLike {
  id: string
  label: string
  labelEn: string | null
  emoji: string | null
  isActive: boolean
  sortOrder: number
}

/** หมวดเริ่มต้นในโค้ด → รูปแบบที่ client ใช้ (ใช้เป็นชุดสำรองเมื่อ DB ยังไม่พร้อม) */
export const DEFAULT_SHOP_CATEGORIES: ShopCategoryRow[] = SHOP_CATEGORIES.map((c, index) => ({
  ...c,
  isActive: true,
  sortOrder: index,
}))

/** แปลงแถวจาก DB → รูปแบบที่หน้าเว็บใช้ (เติมค่าเริ่มต้นให้ฟิลด์ที่เป็น null) */
export function toShopCategory(row: ShopCategoryLike): ShopCategoryRow {
  return {
    id: row.id,
    label: row.label,
    labelEn: row.labelEn || row.label,
    emoji: row.emoji || '🛍️',
    isActive: row.isActive,
    sortOrder: row.sortOrder,
  }
}

/**
 * เตรียมตารางหมวดให้พร้อมใช้ — ถ้ายังว่างให้ seed จาก SHOP_CATEGORIES (cloth / racket / food)
 * เรียกก่อนตอบทุก API ของหมวด เพื่อให้สินค้าเดิมที่มีอยู่มีหมวดรองรับเสมอ
 */
export async function ensureShopCategories() {
  const existing = await db.shopCategory.findMany({ select: { id: true } })
  const existingIds = new Set(existing.map((r) => r.id))
  const missing = SHOP_CATEGORIES.map((c, index) => ({ ...c, sortOrder: index }))
    .filter((c) => !existingIds.has(c.id))
  if (missing.length === 0) return
  await db.shopCategory.createMany({
    data: missing.map((c) => ({
      id: c.id,
      label: c.label,
      labelEn: c.labelEn,
      emoji: c.emoji,
      sortOrder: c.sortOrder,
    })),
  })
}

/** สร้างคีย์หมวดจากชื่อ (a-z 0-9 ขีดกลาง) — ถ้าซ้ำกับของเดิมจะเติม -2, -3 … ให้อัตโนมัติ */
export async function slugifyShopCategory(source: string): Promise<string> {
  const base =
    source
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30) || 'cat'

  for (let i = 1; i <= 50; i++) {
    const candidate = i === 1 ? base : `${base}-${i}`
    const dup = await db.shopCategory.findUnique({ where: { id: candidate }, select: { id: true } })
    if (!dup) return candidate
  }
  return `${base}-${Date.now().toString(36)}`
}

/** ตรวจว่าหมวดที่ส่งมาเป็นหมวดที่มีอยู่ในฐานข้อมูลจริงหรือไม่ */
export async function isValidShopCategory(id: unknown): Promise<boolean> {
  if (typeof id !== 'string' || !id.trim()) return false
  await ensureShopCategories()
  const found = await db.shopCategory.findUnique({ where: { id: id.trim() }, select: { id: true } })
  return Boolean(found)
}
