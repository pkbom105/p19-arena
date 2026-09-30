/* แคตตาล็อกสินค้าของร้าน (รอบนี้เก็บในโค้ด — ยังไม่ผูก DB) */

import type { ShopCategory, ShopProduct } from './types'

export const SHOP_CATEGORIES: ShopCategory[] = [
  { id: 'cloth', label: 'เสื้อผ้า', labelEn: 'Cloth', emoji: '👕' },
  { id: 'racket', label: 'แร็กเก็ต & อุปกรณ์', labelEn: 'Racket & Gear', emoji: '🏓' },
  { id: 'food', label: 'อาหาร & ขนม', labelEn: 'Food & Snack', emoji: '🥤' },
]

/** ชุดสินค้าเริ่มต้น — ใช้เป็น (1) ข้อมูล seed ครั้งแรกของตาราง ShopProduct (2) ชุดสำรองชั่วคราวเมื่อเรียก API ไม่สำเร็จ */
export const DEFAULT_SHOP_PRODUCTS: ShopProduct[] = [
  // ── เสื้อผ้า ─────────────────────────────────────────────
  { id: 'cloth-tshirt-ss', name: 'เสื้อยืด P19 Dry-Fit (แขนสั้น)', nameEn: 'P19 Dry-Fit T-Shirt SS', category: 'cloth', price: 390, unit: 'ตัว', emoji: '👕' },
  { id: 'cloth-polo', name: 'เสื้อโปโล P19 Team', nameEn: 'P19 Team Polo', category: 'cloth', price: 590, unit: 'ตัว', emoji: '👔' },
  { id: 'cloth-cap', name: 'หมวกแก๊ป P19', nameEn: 'P19 Cap', category: 'cloth', price: 290, unit: 'ใบ', emoji: '🧢' },
  { id: 'cloth-socks', name: 'ถุงเท้ากีฬา (คู่)', nameEn: 'Sport Socks (pair)', category: 'cloth', price: 120, unit: 'คู่', emoji: '🧦' },

  // ── แร็กเก็ต & อุปกรณ์ ──────────────────────────────────
  { id: 'racket-beginner', name: 'แร็กเก็ตเริ่มต้น (คาร์บอน)', nameEn: 'Beginner Carbon Racket', category: 'racket', price: 1890, unit: 'อัน', emoji: '🏓' },
  { id: 'racket-pro', name: 'แร็กเก็ต PRO รุ่นแข่งขัน', nameEn: 'PRO Competition Racket', category: 'racket', price: 3900, unit: 'อัน', emoji: '🎾' },
  { id: 'racket-grip', name: 'เทปพันด้าม (Overgrip)', nameEn: 'Overgrip Tape', category: 'racket', price: 90, unit: 'ม้วน', emoji: '🎗️' },
  { id: 'racket-ball3', name: 'ลูกพิคเคิลบอล (แพ็ก 3 ลูก)', nameEn: 'Pickleball (pack of 3)', category: 'racket', price: 350, unit: 'แพ็ก', emoji: '🟡' },
  { id: 'racket-bag', name: 'กระเป๋าแร็กเก็ต P19', nameEn: 'P19 Racket Bag', category: 'racket', price: 790, unit: 'ใบ', emoji: '🎒' },

  // ── อาหาร & ขนม ─────────────────────────────────────────
  { id: 'food-water', name: 'น้ำเปล่า 600 มล.', nameEn: 'Drinking Water 600ml', category: 'food', price: 15, unit: 'ขวด', emoji: '💧' },
  { id: 'food-electrolyte', name: 'เครื่องดื่มเกลือแร่', nameEn: 'Electrolyte Drink', category: 'food', price: 25, unit: 'ขวด', emoji: '🥤' },
  { id: 'food-coffee', name: 'กาแฟกระป๋อง', nameEn: 'Canned Coffee', category: 'food', price: 35, unit: 'กระป๋อง', emoji: '☕' },
  { id: 'food-chips', name: 'มันฝรั่งทอดกรอบ', nameEn: 'Potato Chips', category: 'food', price: 25, unit: 'ซอง', emoji: '🍟' },
  { id: 'food-banana', name: 'กล้วยหอม', nameEn: 'Banana', category: 'food', price: 15, unit: 'ลูก', emoji: '🍌' },
]

/** 3900 -> "฿3,900" */
export const formatTHB = (n: number) => `฿${n.toLocaleString('th-TH')}`
