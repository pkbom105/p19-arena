'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiUrl } from '@/lib/api'
import { SHOP_CATEGORIES } from '@/components/pos-shop/catalog'
import type { ShopCategory, ShopCategoryRow } from '@/components/pos-shop/types'

/** ชุดสำรองในโค้ด — ใช้เมื่อเรียก API ไม่สำเร็จ เพื่อให้หน้าเว็บยังใช้งานได้ */
const FALLBACK_CATEGORIES: ShopCategoryRow[] = SHOP_CATEGORIES.map((c, index) => ({
  ...c,
  isActive: true,
  sortOrder: index,
}))

/**
 * โหลดหมวดสินค้าจากตาราง ShopCategory ผ่าน /api/shop-categories
 * ถ้าเรียก API ไม่สำเร็จจะใช้ SHOP_CATEGORIES ในโค้ดเป็นชุดสำรอง (หน้าเว็บยังใช้งานได้)
 */
export function useShopCategories(includeInactive = false) {
  const [categories, setCategories] = useState<ShopCategoryRow[]>(FALLBACK_CATEGORIES)
  const [catLoading, setCatLoading] = useState(false)

  const reloadCategories = useCallback(async () => {
    setCatLoading(true)
    try {
      const res = await fetch(apiUrl(`/api/shop-categories${includeInactive ? '?all=1' : ''}`))
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) setCategories(data)
    } catch (err) {
      console.error('Failed to fetch shop categories', err)
    } finally {
      setCatLoading(false)
    }
  }, [includeInactive])

  useEffect(() => {
    reloadCategories()
  }, [reloadCategories])

  /** หมวดที่เพิ่งสร้างจากฟอร์ม → ต่อเข้า state ทันทีโดยไม่ต้องโหลดใหม่ทั้งชุด */
  const addCategory = useCallback((category: ShopCategory) => {
    setCategories((prev) => {
      if (prev.some((c) => c.id === category.id)) return prev
      return [...prev, { ...category, isActive: true, sortOrder: prev.length }]
    })
  }, [])

  return { categories, catLoading, reloadCategories, addCategory }
}
