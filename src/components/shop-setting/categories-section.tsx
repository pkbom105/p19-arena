'use client'

import { CategoryList } from './category-list'
import type { ShopCategoryRow } from '@/components/pos-shop/types'

/**
 * sub-menu "หมวดสินค้า (POS)" ของหน้า /dashboard/shop-setting
 * ห่อ CategoryList ไว้เป็นไฟล์ของตัวเอง (รายการหมวดรับมาจาก page เพื่อใช้ state ร่วมกับส่วนสินค้า)
 */
export function CategoriesSection({ categories, onUpdated }: {
  categories: ShopCategoryRow[]
  onUpdated: () => void | Promise<void>
}) {
  return <CategoryList categories={categories} onUpdated={onUpdated} />
}
