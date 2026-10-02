# user-note.md — P19 Arena: ระดับผู้ใช้ & สิทธิ์การเข้าถึง

> โน้ตอ้างอิงระดับผู้ใช้ (User Levels) และหน้าที่แต่ละระดับเข้าได้
> ใช้คู่กับโค้ดจริง: `src/app/`, `src/components/pos/pos-sidebar.tsx`, `src/components/dashboard/helpers.ts`

---

## 1. ระดับผู้ใช้ (User Levels)

| Level | Role | สิทธิ์ | หมายเหตุ |
|:-----:|------|--------|----------|
| **1** | **Admin** | **All access** — ทุกหน้า ทุกเมนู | ผู้ดูแลระบบสูงสุด |
| **2** | **Shop** | กลุ่มงานร้าน (ครอบ Level 3) | เจ้าของ/ผู้จัดการร้าน |
| **3 + POS** | **Shop staff (พนักงาน POS)** | `booking` / `pos-shop` / `shop-report` | พนักงานขายหน้าร้าน + เคาน์เตอร์จอง |
| **3** | **Customer (ลูกค้า)** | หน้าเดียว → `http://localhost:3000/` | ผู้ใช้ทั่วไป (ไม่ต้อง login / LINE) |

**ลำดับชั้น:** `Level 1 (Admin)` › `Level 2 (Shop)` › `Level 3 (+POS / Customer)`

**หมายเหตุ:** Level 1 (Admin) → **แสดงเมนูครบทุกตัว (show all menu)** · **Setting = Level 1 เท่านั้น**

**หมายเหตุ 2:** Level 2 (Shop) → หน้า Shop อยู่ใต้ base **`/dashboard/shop/`** (`pos-booking` / `pos-shop` / `shop-report`)

---

## 2. ตารางสิทธิ์เข้าถึงหน้า (Access Matrix)

สัญลักษณ์: ✅ = เข้าได้ · ❌ = เข้าไม่ได้

| หน้า (Route) | Level 1 Admin | Level 2 Shop | Level 3 + POS | Level 3 Customer |
|---|:---:|:---:|:---:|:---:|
| `/` — หน้าแรก / จองสนาม (customer) | ✅ | ✅ | ✅ | ✅ |
| `/activity` — กิจกรรม | ✅ | ✅ | ❌ | ❌ |
| `/activity/member` | ✅ | ✅ | ❌ | ❌ |
| `/activity/coach` | ✅ | ✅ | ❌ | ❌ |
| `/activity/activities` | ✅ | ✅ | ❌ | ❌ |
| `/dashboard/1` — Dashboard (default: Court) | ✅ | ✅ | ❌ | ❌ |
| `/dashboard/1/court` | ✅ | ✅ | ❌ | ❌ |
| `/dashboard/1/booking` | ✅ | ✅ | ❌ | ❌ |
| `/dashboard/1/slip` | ✅ | ✅ | ❌ | ❌ |
| `/dashboard/1/activity` | ✅ | ✅ | ❌ | ❌ |
| `/dashboard/1/line` | ✅ | ✅ | ❌ | ❌ |
| `/dashboard/shop/pos-booking` — booking (เคาน์เตอร์จอง) | ✅ | ✅ | ✅ | ❌ |
| `/dashboard/shop/pos-shop` — pos-shop (แคชเชียร์ร้าน) | ✅ | ✅ | ✅ | ❌ |
| `/dashboard/shop/shop-report` — shop-report (รายงานร้าน) | ✅ | ✅ | ✅ | ❌ |
| `/dashboard/shop-setting` | ✅ | ✅ | ❌ | ❌ |
| `/dashboard/barcode` | ✅ | ✅ | ❌ | ❌ |
| `/settings` — Setting (เฉพาะ Level 1) | ✅ | ❌ | ❌ | ❌ |
| `/check` · `/ticket/[id]` | ✅ | ✅ | ✅ | ✅ (ตามลิงก์ตั๋ว) |

---

## 3. สรุปสั้นต่อระดับ (Cheat Sheet)

- **Level 1 — Admin:** เข้าได้ทุกหน้าในระบบ (all access) — **แสดงเมนูครบทุกตัว (show all menu)** รวมหน้า Setting (เฉพาะ Admin)
- **Level 2 — Shop:** กลุ่มงานร้าน + Dashboard หลังบ้าน (ไม่มี POS ถ้าไม่ใช่ Level 3+POS; **ไม่มีหน้า Setting**)
- **Level 3 + POS:** เฉพาะ 3 หน้า → `booking` (`/dashboard/shop/pos-booking`), `pos-shop` (`/dashboard/shop/pos-shop`), `shop-report` (`/dashboard/shop/shop-report`)
- **Level 3 — Customer:** หน้าเดียวคือ `http://localhost:3000/` (หน้าแรก/จองสนาม)

---

## 4. แหล่งอ้างอิงในโค้ด (Source of Truth)

| สิ่งที่อ้าง | ไฟล์ |
|---|---|
| หน้า Customer (จองสนาม) | `src/app/page.tsx` |
| เมนู ADMIN กลุ่ม POS (`POS_NAV`) | `src/components/pos/pos-sidebar.tsx` |
| เมนู Dashboard + section (`SECTIONS`) | `src/components/dashboard/helpers.ts`, `src/components/dashboard/dashboard-sidebar.tsx` |
| Route Dashboard (Level 1) | `src/app/dashboard/1/page.tsx`, `src/app/dashboard/1/[section]/page.tsx` |
| Route Shop (Level 2) | `src/app/dashboard/shop/page.tsx`, `src/app/dashboard/shop/{pos-booking,pos-shop,shop-report}/page.tsx` |
| หน้ากิจกรรม | `src/app/activity/` |
| หน้า Settings | `src/app/settings/page.tsx` |
| หน้า Ticket / Check | `src/app/ticket/[id]/page.tsx`, `src/app/check/page.tsx` |

---

## 5. สถานะการบังคับใช้สิทธิ์ในโค้ดปัจจุบัน (สำคัญ)

- **ปัจจุบันยังไม่มีการบังคับใช้ (enforcement) ตามระดับนี้ในโค้ด** — ทุกหน้าเปิดเข้าถึงได้โดยไม่ต้อง login
- `src/proxy.ts` ใส่เฉพาะ **security HTTP headers** (CSP, X-Frame-Options ฯลฯ) เท่านั้น ไม่มี role/auth gating
- `prisma/schema.prisma` → model `User` ยัง**ไม่มีฟิลด์ `level` / `role`** (มีแค่ข้อมูล LINE: `lineUserId`, `lineDisplayName`, `linePictureUrl`, `name`, `phone`, `email`)
- ตารางด้านบนเป็น **ข้อกำหนด (requirement)** ของสิทธิ์ — ถ้าจะให้บังคับใช้จริงต้องเพิ่มฟิลด์ `level`/`role` และตัวเช็คสิทธิ์ในระดับ middleware/layout ต่อไป
- URL กลุ่ม Shop `/dashboard/shop/*` **ย้าย route แล้ว** — route จริงอยู่ที่ `src/app/dashboard/shop/{pos-booking, pos-shop, shop-report}` · redirect จาก URL เก่า (`/dashboard/pos-booking`, `/dashboard/pos-shop`, `/dashboard/shop-report`) ไปใหม่แล้วใน `next.config.ts`

---

_Last updated: 2026-10-02 — P19 Arena_
