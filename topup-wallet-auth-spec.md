# 🔐 สเปก: แยกการล็อกอินออกจากกระเป๋าเงิน Top-up (Un-link LINE → multi-provider)

> **สถานะ:** เอกสารวางแผน (ยังไม่เริ่มแก้โค้ด) · **เวอร์ชัน:** 1.0
> **เจ้าของงาน:** ทีม P19 Arena · **เป้าหมาย:** ให้กระเป๋าเงิน/Top-up ใช้งานได้บน production โดย**ไม่บังคับ** ล็อกอิน LINE
> **ผู้ให้บริการตัวตนที่เลือก:** Google + เบอร์โทร (OTP) เป็นช่องทางหลัก · **LINE = ตัวเลือกผูกเพิ่มได้** (เพื่อรับตั๋ว/แจ้งเตือน)
> **Production จริง (ตาม DEPLOY.md):** VPS + SQLite · `https://booking.p19avenue.com/` (subdomain, พาธราก `/`)

---

## 1) เป้าหมาย / ขอบเขต

### อยู่ในขอบเขต
1. แยก "ตัวตนผู้ใช้" ออกจาก "การล็อกอิน LINE" ให้กระเป๋าเงินทำงานได้ด้วย Google หรือเบอร์+OTP
2. คงระบบเดิม (LINE login, การจอง, ตั๋ว, แอดมิน) ให้ทำงานเหมือนเดิมแบบไม่พัง
3. หน้าแอดมินเห็นเจ้าของกระเป๋าทุกช่องทาง ไม่ใช่เฉพาะคนที่มี LINE
4. มีการผูก/ถอด LINE แบบเลือกได้ (opt-in) ในหน้า account
5. เตรียมพร้อม production: ความปลอดภัย, การย้ายข้อมูลเงินเดิม, แผนถอยกลับ

### นอกขอบเขต (แยกงาน)
- ระบบสะสมแต้ม/คูปอง, การคืนเงินอัตโนมัติ, แอปมือถือ, การย้ายไป Postgres (**แต่มีข้อเสนอใน §14**)

### เกณฑ์ความสำเร็จ (Definition of Done)
- ลูกค้าใหม่สมัคร/ล็อกอินด้วย Google หรือเบอร์+OTP แล้วเติมเงินได้ครบ flow
- ลูกค้า LINE เดิมยังล็อกอินได้ และ**ยอดเงินคงเหลือไม่เปลี่ยนแม้แต่บาทเดียว**
- แอดมินอนุมัติ top-up แล้วเครดิตเข้า**ครั้งเดียว** (กัน double-approve)
- ไม่มีข้อความ/ป้ายในหน้าจอที่สื่อว่าต้องมี LINE เท่านั้น (ยกเว้นปุ่ม "ผูก LINE" ที่เป็นทางเลือก)

---

## 2) สถาปัตยกรรมปัจจุบัน — จุดที่ LINE ผูกกับกระเป๋าเงิน

| # | จุดผูก | หลักฐานในโค้ด | ผลถ้าไม่แก้ |
|---|---|---|---|
| 1 | ประตูเดียวที่ออก "เซสชันลูกค้า" | `src/app/api/line-token/route.ts` (เรียก `setSessionCookie(..., CUSTOMER_SESSION_COOKIE, user.id)` เฉพาะเมื่อ `purpose === 'topup'`) | ไม่มี LINE = เข้ากระเป๋าเงินไม่ได้ |
| 2 | API กระเป๋าบังคับเซสชันนี้ | `src/app/api/wallet/session/route.ts`, `src/app/api/wallet/topups/route.ts` — คืน 401 พร้อมข้อความ **"LINE login required"** | ล็อกอิน LINE ทุกครั้ง |
| 3 | แอดมินเห็นแค่ผู้ใช้ที่มี LINE | `src/app/api/admin/wallets/route.ts` กรอง `where: { lineUserId: { not: null } }` · `src/app/api/users/route.ts` กรองเดียวกัน | เจ้าของกระเป๋าที่ไม่มี LINE ไม่โผล่ในหน้ารวม |
| 4 | โครงสร้างข้อมูลไม่มีตัวตนทางเลือก | `prisma/schema.prisma` → `User.lineUserId` unique · `email String?` (ไม่ unique) · `phone String?` (ไม่ unique) · ไม่มี `googleId` / ตาราง Account | ไม่มีคีย์ไว้ระบุตัวตนคนที่ไม่ใช้ LINE |
| 5 | UI ฝั่งลูกค้าล็อกอินด้วย LINE | `src/components/wallet/customer-topup-section.tsx` (LIFF/OAuth + sessionStorage) · `src/app/account/topup/page.tsx` · `src/components/booking/step-line-login.tsx` | ต้องรื้อปุ่ม/ขั้นตอนล็อกอิน |
| 6 | การแจ้งเตือน | ตรวจแล้ว: **ไม่มีการ push LINE ตอนอนุมัติ/ปฏิเสธ top-up** · push มีเฉพาะตั๋วจอง (`src/lib/line-messaging.ts` → `sendTicketPush` ใน `/api/bookings`) | ข้อดี: แยกได้โดยไม่ทำให้แจ้งเตือน top-up หาย |
| 7 | ชั้นความปลอดภัย | ไม่มี `middleware.ts` · `/api/admin/*` ไม่มีการตรวจสิทธิ์เลย | **ตัวบล็อก production** ต้องแก้คู่กัน (เกี่ยวข้องกับเงิน) |
| 8 | ข้อความในหน้าจอ | `topup-section.tsx` ใช้ `lineDisplayName \|\| name \|\| 'LINE member'` และหัวข้อ "Customer wallets" นับเฉพาะคนมี LINE (ผ่านข้อ 3) | ผู้ใช้ที่ไม่ใช้ LINE จะเห็นข้อความผิดบริบท |

### ระบบที่ต้องหยุดพัง (regression-critical)
- `/api/line-token` + `/api/line-auth` (ล็อกอิน LINE เดิม) · `/api/wallet/session`, `/api/wallet/topups` · `/api/admin/topups` (อนุมัติ → `walletBalance increment` ใน transaction) · `/api/bookings` + ตั๋ว/`/ticket/[id]` · `/api/my-bookings` (ค้นด้วย `lineUserId`/เบอร์/รหัสตั๋ว) · หน้า Dashboard ทั้งชุด

### ข้อเท็จจริงสภาพแวดล้อม (ณ วันเขียน)
- DB ใช้งานได้จริงในเครื่องนี้: `/api/bookings` ตอบ 200 · `p19-arena/db/dev.db` มีตารางครบ (User/Booking/TopUpRequest)
- **สาเหตุจริงที่ `/api/admin/wallets` + `/api/admin/topups` ตอบ 500:** Prisma Client ที่ generate ไว้ **เก่ากว่า** `prisma/schema.prisma` → ข้อความใน dev.log: `Unknown field 'walletBalance' for select statement on model 'User'` และ `db.topUpRequest` เป็น `undefined` → แก้ด้วยการรัน `npx prisma generate` (ไม่ใช่ปัญหาพาธ `DATABASE_URL`)
- `AUTH_SECRET` **ยังไม่ตั้งใน .env** → ออก/อ่านเซสชันไม่ได้ (โค้ดบังคับ ≥32 ตัวอักษร) → ทดสอบล็อกอินในเครื่องนี้ไม่ได้
- **ไม่มีโฟลเดอร์ `prisma/migrations`** → ทีมใช้ `prisma db push` (สคริปต์ `db:push` ใช้ `--accept-data-loss` → เสี่ยงกับข้อมูลเงินจริง)
- แหล่งความจริงของ env อยู่ที่ `src/lib/env.ts` (fail-fast ตอน boot)

---

## 3) สถาปัตยกรรมเป้าหมาย

**หลักการ:** *User = บัญชีเดียว* (ยังมี `walletBalance` ที่ User เหมือนเดิม — **ไม่ย้ายเงินไปที่อื่น**) แต่ "วิธีพิสูจน์ตัวตน" แยกออกเป็นหลายช่องทางได้

```
                ┌───────────── ช่องทางล็อกอิน (ผู้ให้บริการตัวตน) ─────────────┐
   Google  ──┐  │                                                              │
   เบอร์+OTP ─┼─►│  ยืนยันตัวตน → หา/สร้าง User → ออกเซสชันกลาง (cookie เดิม)  ├─► User
   LINE ─────┘  │                                                              │     ├ walletBalance
                └──────────────────────────────────────────────────────────────┘     ├ bookings
                                                                                     ├ lineUserId (optional link)
                                                                                     ├ googleId (optional link)
                                                                                     └ phone (verified, optional link)
```

### 3.1 โมเดลตัวตน
- **แหล่งความจริงของบัญชี = ตาราง `User`** (คงเดิม เพื่อไม่ให้เงิน/การจอง/ตั๋วพัง)
- เพิ่ม "ตัวระบุ" ที่ไม่บังคับ: `googleId`, `phone` (+`phoneVerifiedAt`), `email` (+`emailVerifiedAt`), คง `lineUserId`
- **การผูกหลายช่องทางเข้า User เดียว** เป็นหน้าที่ของ "นโยบายผูกบัญชี" (§13 ข้อ D2) ไม่ใช่การเดาจากอีเมลแบบเงียบ ๆ

### 3.2 เซสชัน
- **คงกลไกเดิม 100%**: cookie `p19_customer_session` แบบ HMAC, payload { role: 'customer', subject: User.id, expiresAt }, อายุ 14 วัน, httpOnly, secure บน prod, sameSite strict, เซ็นด้วย `AUTH_SECRET`
- เปลี่ยนแค่ **"ประตูที่ออกเซสชัน"** ให้เป็นกลาง: ตัวออกเซสชันใช้ร่วมกันได้ทุก provider (Google / OTP / LINE)
- **ห้ามใช้เซสชันของ next-auth แยกต่างหาก** เพราะ API ที่ใช้อยู่ทั้งหมดอ่าน cookie ตัวเดียวกันนี้ (`next-auth` ติดตั้งไว้แต่ไม่ถูกใช้เลย และ v4 ไม่เข้ากับ App Router ของ Next 16 → ดู §13 ข้อ D5)
- ทางเลือก (backward compatible): เพิ่มฟิลด์ `provider` ใน payload ได้ เพราะตัวอ่านเดิมตรวจแค่ `role`/`subject`/`expiresAt`

### 3.3 Flow เป้าหมาย (สรุป)
1. **Google Login**: ปุ่ม → เริ่ม OAuth (state + PKCE, cookie อายุสั้น sameSite lax) → Google → callback ตรวจ state → แลก token → อ่าน (sub, email, email_verified, name, picture) → upsert ผู้ใช้ → **ออกเซสชันกลาง** → กลับหน้าที่ต้องการ
2. **เบอร์ + OTP**: กรอกเบอร์ → ขอ OTP (เก็บ hash + อายุ + จำนวนครั้ง, จำกัด rate) → ส่ง SMS ผ่านผู้ให้บริการ → ผู้ใช้กรอกรหัส → ยืนยัน → upsert ผู้ใช้ (เบอร์ที่ยืนยันแล้ว) → ออกเซสชันกลาง
3. **LINE (เดิม แต่เป็นทางเลือก)**: คงพฤติกรรมเดิมทั้งหมด → ใช้ผูกกับบัญชีที่มีอยู่แล้วได้ (เพื่อรับตั๋ว/แจ้งเตือน) และถอดได้
4. **ผูก/ถอด**: ในหน้า account แสดงว่าผูกช่องทางใดแล้ว · ถอดได้เมื่อเหลือช่องทางอื่นอย่างน้อย 1 (ห้ามถอดตัวสุดท้าย)
5. **แอดมิน**: การ์ด/wallets แสดงทุกเจ้าของกระเป๋า พร้อมป้ายช่องทางตัวตนและชื่อสำรองตามลำดับ (§7.3)

### 3.4 สิ่งที่ไม่เปลี่ยน (เจตนา)
- ตรรกะเงิน: `TopUpRequest.status` + transaction `updateMany` + `walletBalance increment` ยังอยู่ที่ `/api/admin/topups` เหมือนเดิม (กัน double-approve)
- จำนวนเงินที่เติมล่วงหน้า (100/500/1000/2000) + ข้อจำกัดสลิป 300 KB ไม่เปลี่ยน
- การค้นหาการจองของลูกค้า (`/api/my-bookings`) ไม่เปลี่ยน

---

## 4) สเปกข้อมูล (prisma/schema.prisma)

| ฟิลด์/ตาราง | ประเภท | ข้อกำหนด | เหตุผล |
|---|---|---|---|
| `User.googleId` | String? @unique | เพิ่มใหม่ (nullable) | ผูกบัญชี Google |
| `User.phone` | String? **@unique** | เพิ่ม unique (ดูความเสี่ยงเดิมใน §10.2) | เข้าสู่ระบบด้วยเบอร์ |
| `User.phoneVerifiedAt` | DateTime? | เพิ่มใหม่ | ป้องกันเบอร์ปลอม/สวมสิทธิ์ |
| `User.email` | String? (เสนอ @unique) | ถ้าทำ unique ต้องเคลียร์ข้อมูลซ้ำก่อน | กันสองบัญชีอีเมลเดียว |
| `User.emailVerifiedAt` | DateTime? | เพิ่มใหม่ | Google ส่ง `email_verified` มาให้ใช้ |
| `User.lineUserId` | คงเดิม @unique | ยังใช้เป็น "ตัวเลือกผูก" | ไม่ทำข้อมูล/แชทเดิมหาย |
| (ทางเลือก) `AuthIdentity` | ตารางใหม่ | provider, providerUserId, userId, unique(provider, providerUserId) | รองรับ provider เพิ่มในอนาคตโดยไม่แก้ User |
| (ทางเลือก) `OtpCode` | ตารางใหม่ | phone, codeHash, expiresAt, attempts, consumedAt, createdAt | เก็บ OTP แบบไม่เก็บรหัสตรง ๆ |
| (เสนอเพิ่มเพื่อ production) `WalletLedger` | ตารางใหม่ | userId, amount(+/-), type, refId, balanceAfter, createdAt | **ตรวจย้อนหลังเรื่องเงินได้** — ปัจจุบันมีแต่ยอดคงเหลือ ไม่มีประวัติ |
| (เสนอ) `AuditLog` | ตารางใหม่ | actorId, action, targetId, meta, createdAt | ใครอนุมัติ/แก้เงิน เมื่อไร |

**ดัชนีที่ควรมี:** `TopUpRequest(status, createdAt)` และ `(userId, createdAt)` มีอยู่แล้ว · เพิ่ม `OtpCode(phone, createdAt)` และ `WalletLedger(userId, createdAt)`

---

## 5) สเปก API

### 5.1 เพิ่มใหม่ (ข้อเสนอชื่อเส้นทาง)
| เส้นทาง | วิธี | หน้าที่ | หมายเหตุด้านความปลอดภัย |
|---|---|---|---|
| `/api/auth/google/start` | GET | สร้าง state + PKCE → เก็บใน cookie อายุ ~10 นาที (sameSite lax) → 302 ไป Google | ต้องมี `returnTo` ที่ตรวจได้ว่าเป็นพาธภายในเท่านั้น (กัน open redirect) |
| `/api/auth/google/callback` | GET | ตรวจ state → แลก code → อ่าน claims → upsert User → ออกเซสชันกลาง → 302 กลับ | ปฏิเสธถ้า `email_verified` ไม่เป็นจริง |
| `/api/auth/phone/request` | POST | ตรวจรูปแบบเบอร์ → สร้าง OTP (hash) → ส่ง SMS | rate limit ต่อเบอร์ + ต่อ IP + cooldown, ไม่บอกว่าเบอร์มีในระบบหรือไม่ (กัน enumeration) |
| `/api/auth/phone/verify` | POST | ตรวจ OTP (อายุ/จำนวนครั้ง) → upsert User → ออกเซสชันกลาง | ลบ/ทำเครื่องหมาย OTP ที่ใช้แล้ว, จำกัดจำนวนครั้งผิด |
| `/api/account/identities` | GET | แสดงว่าบัญชีนี้ผูกช่องทางใดแล้ว | ต้องมีเซสชัน |
| `/api/account/line/link` | POST | ผูก LINE เข้ากับ User ปัจจุบัน (จาก LIFF/line-token) | ถ้า `lineUserId` ถูกใช้กับ User อื่น → ปฏิเสธ/แจ้งให้ย้าย |
| `/api/account/line/unlink` | POST | ถอด LINE | **ห้ามถอดถ้าเป็นช่องทางเดียวที่เหลือ** |
| `/api/auth/logout` | POST | ล้าง cookie เซสชัน | ใช้ helper `clearSessionCookie` ที่มีอยู่ |

### 5.2 ปรับแก้ของเดิม
| ไฟล์ | สิ่งที่แก้ | เหตุผล |
|---|---|---|
| `src/app/api/wallet/session/route.ts` | ข้อความ 401 จาก "LINE login required" → ข้อความกลาง เช่น "Sign-in required" | ไม่ผูกกับ LINE |
| `src/app/api/wallet/topups/route.ts` | เช่นเดียวกัน (GET/POST) | เช่นเดียวกัน |
| `src/app/api/admin/wallets/route.ts` | **เอา `where: { lineUserId: { not: null } }` ออก** แล้วใช้เกณฑ์เจ้าของกระเป๋า (§13 ข้อ D1) + คืนฟิลด์ `hasLine/hasGoogle/phone` | ให้แอดมินเห็นทุกช่องทาง |
| `src/app/api/admin/topups/route.ts` | คงเดิม (เงิน) แต่เพิ่มชื่อสำรอง (`name`/`phone`/`email`) ใน select ถ้าต้องใช้แสดง | ผู้ใช้ไม่มี LINE ก็ยังอ่านออก |
| `src/app/api/users/route.ts` | **พิจารณาแยกเป็นสองรายการ**: "สมาชิก LINE" (เดิม คงไว้ให้หน้า LINE credential) กับ "สมาชิกกระเป๋าเงิน" (ใหม่) | ไม่ให้หน้าเดิมเปลี่ยนความหมายโดยไม่ตั้งใจ |
| `src/lib/env.ts` | เพิ่มคีย์ใหม่ (Google/SMS) + validate + log | มาตรฐานเดิมของโปรเจกต์ |
| `src/lib/session-auth.ts` | เพิ่มตัวออกเซสชันแบบใช้ร่วม (ของเดิมยังใช้ได้) + (ทางเลือก) ใส่ `provider` ใน payload | ประตูออกเซสชันเป็นกลาง |

### 5.3 สัญญา error ที่ควรเป็นมาตรฐาน
- 401 = ยังไม่ล็อกอิน (`{ error: 'Sign-in required' }`) · 403 = ล็อกอินแล้วแต่ไม่มีสิทธิ์ · 409 = ข้อมูลชนกัน (เช่น OTP ถูกใช้แล้ว/บัญชีถูกผูกแล้ว) · 429 = โดน rate limit (OTP) · 400 = ข้อมูลไม่ถูกต้อง · 500 = ระบบผิดพลาด
- **ข้อความในหน้าจอควรเป็นคู่ TH/EN** ตามที่หน้าอื่นใช้ (ตอนนี้หน้าฝั่งลูกค้าใช้ EN)

---

## 6) สเปกเซสชัน (คงเดิม + ข้อควรปรับ)

| หัวข้อ | ค่าปัจจุบัน | ข้อเสนอ |
|---|---|---|
| ชื่อ cookie | `p19_customer_session` | คงเดิม (ห้ามเปลี่ยนชื่อ ไม่งั้นผู้ใช้เดิมหลุด) |
| รูปแบบ | base64url(payload) + '.' + HMAC-SHA256(base64url, `AUTH_SECRET`) | คงเดิม |
| อายุ | 14 วัน (cookie + payload) | พิจารณา 30 วันสำหรับ "จดจำฉัน" หรือคง 14 วัน (ตัดสินใจ) |
| sameSite | strict | คงไว้ (redirect กลับจาก Google เป็น top-level GET ใช้ได้) · **cookie ของ state ใช้ lax** |
| httpOnly/secure | เปิด (secure เมื่อ NODE_ENV=production) | คงเดิม |
| subject | `User.id` | **คงเดิม** (API เดิมทั้งหมดพึ่งค่านี้) |
| การเพิกถอน | ไม่มี (stateless) | ถ้าต้องการ "ออกจากทุกอุปกรณ์" ต้องมีตาราง session หรือเปลี่ยน `AUTH_SECRET` (ผลกระทบทั้งระบบ) — ตัดสินใจว่าจะทำหรือไม่ |

---

## 7) สเปกหน้าจอ (UI/UX)

### 7.1 หน้าลูกค้าที่ต้องแก้
| ไฟล์/หน้า | สิ่งที่ทำ |
|---|---|
| `src/components/wallet/customer-topup-section.tsx` (+ `/account/topup`) | เปลี่ยนขั้นตอนล็อกอินจาก LINE → เลือกช่องทาง (Google / เบอร์ OTP) · คงปุ่ม "ผูก LINE" เป็นทางเลือก · แสดงชื่อ/รูปจากช่องทางที่ล็อกอิน · ยังแสดงประวัติคำขอเติมเงิน 20 รายการเหมือนเดิม |
| `src/components/booking/step-line-login.tsx` | **คงไว้เป็นตัวเลือก** (จองแบบไม่ล็อกอินได้อยู่แล้ว) แต่ถ้าจะใช้ Google ช่วย auto-fill ควรมีปุ่มเดียวกันแบบไม่บังคับ |
| หน้า account (ใหม่หรือที่มีอยู่) | แสดง "ช่องทางที่ผูกแล้ว" + ปุ่มผูก/ถอด (LINE) + สถานะเบอร์ยืนยัน/อีเมลยืนยัน |
| หน้า `/account/*` (หน้าลูกค้า) | เพิ่มทางเข้า "กระเป๋าเงินของฉัน" ที่ล็อกอินด้วย Google/เบอร์ได้ |

### 7.2 ข้อกำหนด UX ที่ควรยึด
- ปุ่ม Google ต้องเป็นไปตามแบรนด์ไกด์ของ Google (ไม่ดัดแปลงโลโก้/สี)
- ข้อความ TH/EN คู่กัน · แจ้งชัดว่า "กระเป๋าเงินไม่ต้องใช้ LINE แล้ว"
- กรณีเป็นบัญชีใหม่: บอกให้ผู้ใช้ทราบก่อนว่ากำลังสร้างบัญชีใหม่ (กันงงกับยอดเงินเดิม)
- กรณีเบอร์/อีเมลถูกใช้กับบัญชีอื่น: ต้องมีข้อความแนะนำ (ไปที่ §13 D2) ไม่ใช่สร้างซ้ำเงียบ ๆ

### 7.3 หน้าลูกค้าฝั่งแอดมิน: `/dashboard/1/topup`
- การ์ดสรุป 3 ใบ (รายการจอง / Top-Up / ยอดเงินคงเหลือ) ยังอยู่ แต่ **ชื่อ/ตัวเลขต้องไม่ผูกกับ LINE อีก** — เกณฑ์การนับตาม §13 D1
- การ์ดลูกค้า: รูปโปรไฟล์สำรองเป็นอักษรย่อเมื่อไม่มีรูป (ตอนนี้มีแล้ว) · ชื่อสำรองลำดับ: `name → email → phone → Google name → 'Customer'`
- เพิ่มป้ายบอกช่องทาง (LINE / Google / เบอร์) และ "ยืนยันเบอร์แล้วหรือยัง"
- เลิกใช้คำว่า "LINE member" เป็นค่า fallback

---

## 8) ความปลอดภัย / PDPA (บังคับก่อนขึ้น production)

1. **ตรวจสิทธิ์ `/api/admin/*`** (ปัจจุบันไม่มีเลย) — ถ้าไม่แก้ เท่ากับใครก็อนุมัติเงินได้
2. Google: `state` + PKCE, ตรวจ `email_verified`, จำกัด `returnTo` เป็นพาธภายใน
3. OTP: hash รหัส (ห้ามเก็บ plaintext), อายุสั้น (เช่น 5 นาที), จำกัดจำนวนครั้ง, cooldown ต่อเบอร์/IP, กันเบอร์ enumeration, log แบบไม่เปิดเผยรหัส
4. Rate limit ระดับแอปสำหรับ `/api/auth/*` (เช่น ต่อ IP) และสำหรับ `POST /api/wallet/topups` (กันสแปมสลิป)
5. ไม่ log PII (เบอร์/อีเมล/สลิป) ลง `ErrorLog` — ควรมีตัวกรองก่อนบันทึก
6. ตรวจประเภท/ขนาดไฟล์สลิป (มีอยู่: JPEG/PNG ≤300 KB) — คงไว้
7. PDPA: ระบุการเก็บ เบอร์/อีเมล/Google sub ในนโยบายความเป็นส่วนตัว + ช่องทางขอใช้สิทธิ์ (ลบ/แก้ข้อมูล) + ระยะเวลาเก็บ
8. บันทึก audit เรื่องเงิน (ใครอนุมัติ/ยอดเท่าไร) — แนะนำตาราง `AuditLog`/`WalletLedger`
9. ทบทวน secret management: `AUTH_SECRET` ≥32 ตัวอักษร, Google/SMS secret ออกเฉพาะ env ฝั่งเซิร์ฟเวอร์ (ห้าม `NEXT_PUBLIC_`)
10. แผนรับมือเหตุ: บัญชีถูกยึด → ช่องทางเพิกถอน (จาก §6) และการแจ้งเตือนเมื่อผูก/ถอดช่องทางใหม่

---

## 9) Checklist ตั้งค่า / env

### 9.1 ตัวแปรใหม่
| ตัวแปร | ใช้ที่ไหน | หมายเหตุ |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Google OAuth | ห้ามตั้งเป็น `NEXT_PUBLIC_` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth | เก็บเฉพาะฝั่งเซิร์ฟเวอร์ |
| `SMS_PROVIDER` | OTP | เช่น `thaibulksms` / `smsmkt` / `twilio` |
| `SMS_API_KEY`, `SMS_API_SECRET` (หรือ token) | OTP | ตามผู้ให้บริการที่เลือก |
| `SMS_SENDER_NAME` | OTP | ชื่อผู้ส่ง (ต้องจดทะเบียนกับเจ้า SMS) |
| `OTP_TTL_SECONDS`, `OTP_MAX_ATTEMPTS`, `OTP_COOLDOWN_SECONDS` | OTP | ค่าเริ่มต้นที่แนะนำ: 300 / 5 / 60 |

### 9.2 Checklist ก่อนเริ่ม (ทำทีละข้อ ติ๊กได้)
- [ ] ตกลงผู้ให้บริการ SMS + ได้ API key + ชื่อผู้ส่งที่อนุมัติแล้ว
- [ ] สร้าง Google OAuth Client (Web) + consent screen + ใส่ redirect URI ครบทุก env
- [ ] ยืนยันโดเมน production จริง (จาก DEPLOY.md: `https://booking.p19avenue.com/` — **subdomain พาธราก `/`**) → callback = `https://booking.p19avenue.com/api/auth/google/callback`
- [ ] ยืนยันว่าจะใช้ `NEXT_PUBLIC_BASE_PATH` หรือไม่ (โค้ดรองรับ แต่ production ปัจจุบันใช้ subdomain) — **ถ้าใส่ basePath ต้องเติมใน redirect URI ด้วย**
- [ ] ตั้ง `AUTH_SECRET` (≥32 ตัวอักษร) บนทุก env — **เครื่อง dev ยังไม่มี**
- [ ] แก้ `DATABASE_URL` ให้ชี้ DB ถูกต้อง (dev ตอนนี้เป็นพาธสัมพัทธ์ที่ทำให้ API 500)
- [ ] เตรียม env แยกสำหรับ staging (DB แยกไฟล์)
- [ ] อัปเดต `src/lib/env.ts` ให้ตรวจคีย์ใหม่ (fail-fast)
- [ ] อัปเดต DEPLOY.md/เอกสาร env และแจ้งทีม

---

## 10) แผน migration + rollback (ข้อมูลเงินจริง — ห้ามพลาด)

### 10.1 Pre-flight checks (รันก่อนแตะ schema ทุกครั้ง)
1. ตรวจอีเมล/เบอร์ซ้ำ: `SELECT phone, COUNT(*) FROM User WHERE phone IS NOT NULL GROUP BY phone HAVING COUNT(*) > 1` (ทำแบบเดียวกันกับ email)
2. ตรวจเจ้าของกระเป๋าปัจจุบัน: จำนวนผู้ใช้ที่มี `walletBalance > 0` แยกเป็น "มี lineUserId" / "ไม่มี"
3. ตรวจผู้ใช้ที่มีเงินแต่ไม่มีอีเมล/เบอร์ (กลุ่มที่ต้องใช้ flow "ยึดบัญชี")
4. ผลรวมยอดเงินทั้งระบบ **ก่อน** เปลี่ยน: `SELECT SUM(walletBalance) FROM User` → จดตัวเลขนี้ไว้เป็น "ตัวเลขควบคุม"
5. `PRAGMA integrity_check` บนไฟล์ DB

### 10.2 ความเสี่ยงที่ต้องจัดการ (SQLite + `db push`)
- SQLite **ไม่รองรับการเพิ่ม UNIQUE แบบออนไลน์** — Prisma ต้องสร้างตารางใหม่+คัดลอกข้อมูล (ตารางจะถูกล็อกช่วงสั้น ๆ) → ควรทำใน**ช่วงเวลาใช้งานน้อย**
- สคริปต์เดิม `db:push` ใช้ `--accept-data-loss` → **ห้ามใช้กับ production โดยไม่ backup** และควรเปลี่ยนไปใช้ `prisma migrate` (สร้าง baseline) ก่อนข้อมูลจริงเยอะ
- ถ้ามีอีเมล/เบอร์ซ้ำ การเพิ่ม unique จะ**ล้มเหลว** → ต้องเคลียร์ (รวมหรือล้างค่า) ให้เสร็จก่อน

### 10.3 ลำดับการทำ (แนะนำ)
1. **Backup**: หยุดเขียนชั่วคราว → คัดลอกไฟล์ `db/dev.db` เป็นชื่อมี timestamp (เช่น `dev-YYYYMMDD-HHMM.db`) → เก็บนอกเครื่อง + ตรวจว่าเปิดได้
2. **Schema แบบ additive เท่านั้น**: เพิ่มคอลัมน์ nullable (`googleId`, `phoneVerifiedAt`, `emailVerifiedAt`) + ตารางใหม่ (`OtpCode`, ถ้าทำ `WalletLedger`) → รัน `db push`/migrate → **ยังไม่ใส่ unique**
3. **Deploy โค้ด** ที่รองรับทั้งสองสภาพ (ผู้ใช้เดิมยังใช้ได้)
4. **เก็บข้อมูลจริง (backfill)**: ให้ผู้ใช้ผูกช่องทางเมื่อล็อกอินครั้งแรก (เบอร์ยืนยัน/Google) — หรือแอดมินผูกให้เฉพาะรายที่ร้องขอ
5. **หลังข้อมูลสะอาดแล้ว** จึงเพิ่ม constraint `@unique` ของ `phone`/`email` (maintenance window) → ตรวจตัวเลขควบคุม (ข้อ 10.1.4) ต้องเท่าเดิม
6. **Smoke test** + เฝ้าดู error log 24–48 ชม.

### 10.4 แผน "ยึดบัญชี" ของลูกค้าเดิม (สำคัญที่สุด)
| กรณี | แนวทางที่เสนอ |
|---|---|
| ลูกค้า LINE เดิม ต้องการใช้ Google/เบอร์ | ล็อกอินช่องทางใหม่ → ระบบถาม "ผูกกับบัญชีเดิมไหม" → ยืนยันด้วยการล็อกอิน LINE อีกครั้งในหน้าเดียวกัน (พิสูจน์ว่าเป็นเจ้าของ) → รวมบัญชี (เก็บ User เดิมไว้ = ยอดเงินไม่หาย) |
| ลูกค้าเดิมไม่มี LINE แล้ว (แจ้งเบอร์/สลิปทางร้าน) | แอดมินผูกเบอร์ที่ยืนยันแล้วให้ User เดิมจากหน้าแอดมิน (มี audit log) |
| ลูกค้าเดิมมีเงินคงเหลือ ยืนยันตัวตนไม่ได้ | **ห้ามลบ** — คงไว้ + ให้แอดมินโอนยอดให้บัญชีใหม่พร้อมบันทึกเหตุผล (ต้องมีตาราง audit) |
| ผู้ใช้กรอกเบอร์/อีเมลที่ชนกับบัญชีอื่น | ปฏิเสธ + แนะนำผูก/ยึดบัญชี (ห้ามสร้างซ้ำซ้อน) |

### 10.5 Rollback
| สถานการณ์ | สัญญาณ (Trigger) | การแก้ |
|---|---|---|
| ล็อกอินใหม่พัง | error 5xx ที่ `/api/auth/*` > 1% ต่อ 15 นาที | ปิดปุ่ม/ปิดฟีเจอร์ด้วย env flag → ผู้ใช้ยังใช้ LINE เดิมได้ |
| อนุมัติเงินผิด/ยอดไม่ตรง | ยอดรวม ≠ ตัวเลขควบคุม (10.1.4) | หยุดรับ top-up ใหม่ → ตรวจ `WalletLedger` (ถ้ามี) → คืนค่า |
| DB เสียหาย/constraint ล้ม | migrate ล้มกลางทาง | หยุดแอป → คืนไฟล์จาก backup (10.3.1) → deploy โค้ดเวอร์ชันก่อนหน้า |
| ข้อมูลตัวตนชนกัน | ผู้ใช้เห็นข้อมูลคนอื่น | ปิดเส้นทางที่เกี่ยวข้องทันที + แจ้งเหตุ + ตรวจ `@unique` |

**เป้าหมายเวลา rollback:** ≤ 15 นาที (เพราะเป็นไฟล์ SQLite + deploy แบบ standalone/PM2) → เตรียมคำสั่งไว้ล่วงหน้า + ซ้อม 1 ครั้งบน staging

---

## 11) Checklist ทดสอบ (Test Matrix)

### 11.1 ล็อกอิน/ตัวตน
- [ ] Google: ล็อกอินครั้งแรก (สร้างบัญชีใหม่) · ล็อกอินซ้ำ (ไม่สร้างซ้ำ) · ยกเลิกหน้า consent · state ไม่ตรง · code หมดอายุ · อีเมลยังไม่ยืนยัน (`email_verified=false` → ปฏิเสธ)
- [ ] เบอร์ OTP: ขอ OTP ปกติ · รหัสผิดเกินจำนวน · รหัสหมดอายุ · ขอซ้ำเร็วเกิน (cooldown) · เบอร์รูปแบบผิด · เบอร์ถูกใช้กับบัญชีอื่น
- [ ] LINE: ล็อกอินเดิมยังทำงาน · ผูก LINE กับบัญชี Google/เบอร์ · ถอด LINE เมื่อเหลือช่องทางอื่น · พยายามถอดช่องทางสุดท้าย (ต้องถูกปฏิเสธ)
- [ ] `returnTo`/open redirect: ส่งค่าภายนอกเข้ามา → ต้องถูกบล็อก

### 11.2 กระเป๋าเงิน (เงิน — ต้องเป๊ะ)
- [ ] ส่งคำขอเติมเงินได้ (100/500/1000/2000) + ตรวจสลิป (JPEG/PNG, ≤300 KB, เกิน → ปฏิเสธ)
- [ ] ประวัติคำขอของตัวเองแสดงครบ · ผู้ใช้ A ไม่เห็นของ B
- [ ] แอดมินอนุมัติ → ยอดเพิ่ม**ครั้งเดียว** · อนุมัติซ้ำ → ได้ 409 · ปฏิเสธ → ยอดไม่เปลี่ยน
- [ ] `SUM(walletBalance)` ตรงกับตัวเลขควบคุมก่อน–หลังการทดสอบ

### 11.3 Regression ของระบบเดิม
- [ ] จองคอร์ต/โค้ช + ออกตั๋ว + push ตั๋วผ่าน LINE ยังทำงาน
- [ ] `/api/my-bookings` (ค้นด้วย lineUserId / เบอร์ / รหัสตั๋ว) ยังทำงาน
- [ ] Dashboard ทั้ง 6 แท็บ + account + topup (การ์ด 3 ใบ + แท็บบาร์มือถือ 2 แถว) ไม่พัง
- [ ] ผู้ใช้ LINE เดิมที่ยังไม่ผูกช่องทางใหม่ → ใช้งานได้ตามปกติ

### 11.4 หน้าจอ/คุณภาพ
- [ ] ไม่มีข้อความที่บอกว่าต้องใช้ LINE (ยกเว้นปุ่มผูก LINE)
- [ ] ชื่อสำรองแสดงถูกเมื่อไม่มีรูป/ไม่มี LINE
- [ ] ข้อความ TH/EN ครบ · ไม่มี overflow ที่ 1440/390 · ไม่มี JS error
- [ ] ปุ่ม Google ตรงแบรนด์ไกด์

### 11.5 ความปลอดภัย/โหลด
- [ ] `/api/admin/*` ตอบ 401/403 เมื่อไม่ได้ล็อกอินแอดมิน (ทดสอบยิงตรงด้วย curl)
- [ ] OTP: ยิงถี่ ๆ แล้วติด rate limit · ไม่มีรหัส OTP ใน log
- [ ] ไม่มี PII ใน `ErrorLog`

### 11.6 วิธีทดสอบในเครื่องนี้ (ต้องแก้ก่อน)
1. ตั้ง `AUTH_SECRET` (≥32 ตัวอักษร) ใน `.env`
2. แก้ `DATABASE_URL` ให้เป็นพาธ absolute (หรือ `file:./db/dev.db`) — ปัจจุบันพาธสัมพัทธ์ทำให้ API 500
3. รัน dev + ตรวจว่า `/api/admin/wallets` ไม่ 500
4. ใช้การวัดแบบเดิมของโปรเจกต์ (tsc + lint + probe 2 viewport) เพื่อยืนยันว่าไม่มี overflow/JS error เพิ่ม

---

## 12) แผนปล่อย (Rollout)

| ขั้น | สิ่งที่ทำ | เกณฑ์ผ่าน |
|---|---|---|
| 1 | รวมงานเป็น PR ย่อยตาม §14 และรันใน CI (tsc/lint/build) | CI เขียว |
| 2 | Staging บน VPS + DB แยกไฟล์ + ซ้อม migration/rollback | ซ้อม rollback สำเร็จ ≤15 นาที |
| 3 | เปิดให้ทดสอบภายใน (ทีมร้าน 3–5 เบอร์) + ทดสอบยอดเงินจริง | ไม่มีข้อผิดพลาดเรื่องยอด |
| 4 | เปิดจริงแบบมี feature flag (ปุ่ม Google/OTP) | error rate ปกติ 24 ชม. |
| 5 | ประกาศให้ลูกค้า (LINE broadcast + ป้ายในหน้าเว็บ) พร้อมวิธีผูกบัญชีเดิม | มีคำถาม/ปัญหาลดลง |
| 6 | ทบทวนหลังปล่อย 1 สัปดาห์: log, ปัญหาการยึดบัญชี, ปรับ UX | รายงานสรุปให้ทีม |

**Metrics ที่ต้องเฝ้า:** จำนวนบัญชีใหม่/วัน · อัตราล็อกอินสำเร็จต่อช่องทาง · OTP ส่งไม่สำเร็จ (%) · จำนวนผู้ใช้ที่ยึดบัญชีสำเร็จ/ค้าง · 5xx · จำนวนคำขอ top-up ค้างอนุมัติ · ยอดรวมเงิน (ต้องตรงทุกวัน)

---

## 13) เรื่องที่ต้องตัดสินใจ (Open Decisions) — ต้องเคาะก่อนเริ่มโค้ด

| # | เรื่อง | ตัวเลือก | ผลกระทบ |
|---|---|---|---|
| **D1** | หน้าแอดมิน "Customer wallets" จะนับใครเป็นเจ้าของกระเป๋า | (a) ผู้ใช้ทุกคน · (b) ผู้ใช้ที่มี `walletBalance ≠ 0` · (c) ผู้ใช้ที่มีตัวตนอย่างน้อย 1 ช่องทาง (LINE/Google/เบอร์ยืนยัน) · (d) ผู้ใช้ที่มีคำขอ top-up | กระทบตัวเลขบนการ์ดและรายการในหน้า topup |
| **D2** | นโยบายผูกบัญชีเมื่อ Google/เบอร์ตรงกับบัญชีเดิม | (a) ผูกอัตโนมัติเมื่ออีเมลตรงและยืนยันแล้ว · (b) ให้ผู้ใช้ยืนยันด้วยการล็อกอิน LINE เดิม · (c) ให้แอดมินอนุมัติ | ความเสี่ยงบัญชีถูกยึด vs ความสะดวก |
| **D3** | ผู้ให้บริการ SMS + งบต่อข้อความ | ThaiBulkSMS / SMSMKT / Twilio / อื่น ๆ | ค่าใช้จ่ายและเวลาตั้งค่า (ชื่อผู้ส่งต้องจดทะเบียน) |
| **D4** | `email`/`phone` ทำ `@unique` หรือไม่ | (a) ทำทั้งคู่ · (b) ทำเฉพาะ phone · (c) ไม่ทำ (ใช้การตรวจตอนล็อกอิน) | ความยากของ migration ถ้ามีข้อมูลซ้ำ |
| **D5** | จะใช้ next-auth (Auth.js v5) หรือเขียน OAuth เอง | เขียนเอง = เข้ากับเซสชันเดิมตรงสุด · v5 = ได้ provider เยอะ แต่ต้องปรับเซสชัน/adapter | ต้องอัป dependency และมีงานผูก session |
| **D6** | อายุเซสชัน/จดจำฉัน | 14 วันเท่าเดิม · 30 วัน · ทำ "ออกจากทุกอุปกรณ์" | ต้องมีตาราง session ถ้าจะเพิกถอนได้ |
| **D7** | เก็บ `WalletLedger` + `AuditLog` ไหม | เก็บ (แนะนำ) / ไม่เก็บรอบนี้ | การตรวจย้อนหลังเรื่องเงิน (production ควรมี) |
| **D8** | จะย้าย SQLite → Postgres ไหม | อยู่ SQLite (เร็ว/ง่าย) · ย้าย Postgres (หลายผู้เขียน/backup ดีกว่า) | งานเพิ่ม แต่เหมาะกับ production ระยะยาว |

---

## 14) ลำดับงาน + ประมาณการ (PR ย่อย)

| รอบ | เนื้อหา | ไฟล์หลัก | ต้องมี credential | ประมาณ |
|---|---|---|---|---|
| **P1** | Schema (additive) + เซสชันกลาง + ข้อความ error กลาง | `prisma/schema.prisma`, `src/lib/session-auth.ts`, `src/app/api/wallet/*`, `src/lib/env.ts` | ไม่ต้อง | 0.5–1 วัน |
| **P2** | Google Login ครบ flow + UI ปุ่ม | เพิ่ม `src/app/api/auth/google/*`, แก้ `customer-topup-section.tsx`, `/account/*` | Google Client ID/Secret | 1–1.5 วัน |
| **P3** | เบอร์ + OTP (ส่ง SMS จริง) + UI | เพิ่ม `src/app/api/auth/phone/*`, `OtpCode`, UI OTP | SMS provider + key | 1.5–2 วัน |
| **P4** | แก้เส้นทางแอดมิน (ไม่ผูก LINE) + ป้ายช่องทาง | `src/app/api/admin/wallets`, `admin/topups`, `topup-section.tsx` | ไม่ต้อง | 1 วัน |
| **P5** | ผูก/ถอด LINE + หน้า account + PDPA + audit | `/api/account/*`, หน้า account, เอกสาร | ไม่ต้อง | 1 วัน |
| **P6** | งานคู่ที่จำเป็นต่อ production: ตรวจสิทธิ์ `/api/admin/*` + rate limit | middleware/guard, `env.ts` | ไม่ต้อง | 1 วัน |
| **P7** | Migration จริง + staging + ซ้อม rollback | DB, สคริปต์ดำเนินการ | DB จริง + อนุมัติ | 1 วัน |

**รวมประมาณ:** 7–9 วันทำงาน (ยังไม่รวมเวลารอ Google verify โดเมน/ชื่อผู้ส่ง SMS ซึ่งอาจ 1–3 วันทำการ)

**ลำดับที่ปลอดภัยที่สุด:** P1 → P4 (แยกการผูกลูกค้าฝั่งแอดมิน) → P2 → P3 → P5 → P6 → P7 (หรือสลับ P2/P3 ตาม credential ที่ได้ก่อน)

---

## 15) ภาคผนวก

### 15.1 ตารางอ้างอิงโค้ด (หลักฐาน)
| เรื่อง | ไฟล์ |
|---|---|
| เซสชัน (cookie/HMAC) | `src/lib/session-auth.ts` (ชื่อ cookie, อายุ 14 วัน, ต้องมี `AUTH_SECRET` ≥32) |
| ผู้ออกเซสชันเดิม (LINE) | `src/app/api/line-token/route.ts` |
| ผู้ใช้กระเป๋า/คำขอเติมเงิน | `src/app/api/wallet/session/route.ts`, `src/app/api/wallet/topups/route.ts` |
| แอดมิน (เงิน) | `src/app/api/admin/topups/route.ts` (transaction + กัน double-approve), `src/app/api/admin/wallets/route.ts` |
| UI ลูกค้า/แอดมิน | `src/components/wallet/customer-topup-section.tsx`, `src/components/dashboard/topup-section.tsx`, `src/app/account/topup/page.tsx` |
| ตั๋ว/แจ้งเตือน LINE | `src/lib/line-messaging.ts`, `src/app/api/bookings/route.ts` |
| ตรวจ env | `src/lib/env.ts`, `src/instrumentation.ts` |
| Deploy | `DEPLOY.md` (VPS + SQLite + PM2/systemd/docker, prod = `https://booking.p19avenue.com/`) |

### 15.2 สภาพแวดล้อมที่ยังขาด (บล็อกการทดสอบในเครื่อง)
1. `AUTH_SECRET` ไม่ได้ตั้ง → เซสชันใช้ไม่ได้
2. **Prisma Client เก่ากว่า schema** → `/api/admin/wallets` 500 (`Unknown field 'walletBalance'`), `/api/admin/topups` 500 (`db.topUpRequest` ไม่มี) ขณะที่ `/api/bookings` ตอบ 200 → แก้ด้วย `npx prisma generate` (ยืนยันจาก dev.log แล้ว ว่า**ไม่ใช่**ปัญหาพาธ `DATABASE_URL`)
3. ไม่มี `prisma/migrations` → ใช้ `db push --accept-data-loss` (เสี่ยงกับข้อมูลเงินจริง)

### 15.3 ประวัติเอกสาร
| เวอร์ชัน | วันที่ | สาระสำคัญ |
|---|---|---|
| 1.0 | 2026-10-06 | จัดทำสเปกครั้งแรก: แยก LINE ออกจากกระเป๋าเงินแบบ multi-provider (Google + เบอร์ OTP, LINE เป็นตัวเลือก) — ยังไม่เริ่มแก้โค้ด |







