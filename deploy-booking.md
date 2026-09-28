# 🚀 Deploy — booking.p19avenue.com (สร้าง DB ใหม่)

> เอกสารนี้สำหรับ deploy **เฉพาะ** `https://booking.p19avenue.com` พร้อม **ฐานข้อมูลใหม่ (ว่างเปล่า)**
> ต่างจาก `DEPLOY2.md` (deploy คู่ขนานเดิม) ตรงที่เอกสารนี้ครอบคลุม: pre-flight → สำรองของเดิม → pull → build ที่ฝัง URL → **สร้าง DB ใหม่** → seed → ตรวจครบ → rollback → เก็บกวาด
>
> | | ค่า |
> |---|---|
> | เอกสารนี้เขียนที่ commit | `ed93d58` (v 2.0) |
> | วันที่จัดทำ | 2026-09-28 |
> | VPS | `103.4.217.209` (`root@ns1`) |
> | โฟลเดอร์โค้ดบน VPS | `/home/p19-arena` (repo `pkbom105/p19-arena`) |

## 0) ภาพรวม — ค่าที่ใช้จริง

| รายการ | ค่า |
|---|---|
| URL | `https://booking.p19avenue.com` |
| Container | `p19-arena-booking` |
| Image | `p19-arena-booking` |
| Port (host → container) | `3003` → `3000` (ทางเลือก zero-downtime: `3004`) |
| Volume (ใหม่) | **`p19-db-booking-v2`** ← DB ใหม่ของงานนี้ |
| DB ปลายทางใน container | `/app/db/data.db` (ตั้งโดย `ENV DATABASE_URL` ใน `Dockerfile`) |
| Build-arg ที่ **ต้อง** ใส่ | `NEXT_PUBLIC_SITE_URL=https://booking.p19avenue.com` |
| Build-arg อื่น | `NEXT_PUBLIC_BASE_PATH=` (ปล่อยว่าง = ราก `/`) · `NEXT_PUBLIC_LINE_CHANNEL_ID=2011357077` |
| Health check | `GET /api/health` → `200` = healthy, `503` = unhealthy (`db.ok` บอกสถานะ DB) |
| Seed ข้อมูลเริ่มต้น | `POST /api/seed` (idempotent) |
| nginx vhost | `booking.p19avenue.com` → `proxy_pass http://localhost:3003` |
| SSL | `/etc/letsencrypt/live/booking.p19avenue.com/` |
| สคริปต์ที่ใช้ได้ | `/usr/local/bin/p19pull2` (ปลอดภัย) — **ห้ามใช้ `p19pull`** |

**ทำไมต้องสร้าง DB ใหม่:** SQLite เก็บไฟล์เดียวใน volume → "DB ใหม่" = **volume ใหม่ที่ว่างเปล่า** แล้ว container จะสร้างตารางให้อัตโนมัติตอน start (ดูข้อ 6)

---

## 1) ⚠️ อ่านก่อน — ข้อบังคับของเครื่อง `ns1`

เครื่องนี้ **ใช้ร่วมหลายโปรเจกต์** (qform, n8n, db-crm, postgres×2, shadowbox, watchtower, และ p19 อีก 3 container) — ข้อผิดพลาดจะกระทบคนอื่นด้วย

| ห้ามเด็ดขาด | เหตุผล |
|---|---|
| `docker system prune -a --volumes -f` · `docker system prune --volumes` | ลบ volume ของโปรเจกต์อื่นที่ไม่มี container ถือครอง (มีอยู่จริง: `noteapp_*`) → **ข้อมูลโปรเจกต์อื่นหาย** |
| ลบ/แตะ volume **`p19-db`** | ถูกใช้ร่วมโดย **2 container**: `p19-arena` (หยุดอยู่) + `p19-booking` (ตัวเก่า :3002) → ลบ = ข้อมูล deploy 1 หาย |
| `rm -rf /var/lib/docker/...` | ทำให้ metadata Docker ไม่ตรง → พังทั้งเครื่อง |
| `git reset --hard` / `checkout --force` บน VPS | ทับงานที่อาจถูกแก้บนเซิร์ฟเวอร์ (destructive) |
| ลบ container `p19-booking` (:3002) | ยังรันอยู่ (Up) และ **ใช้ DB ร่วมกับ deploy 1** — ต้องยืนยันก่อนว่าที่ไหนไม่ชี้ 3002 |
| รัน `p19pull` | มี `docker system prune -a --volumes -f` อยู่บรรทัดท้าย |

**ข้อควรรู้เพิ่ม:**
- container รันเป็น user `nextjs` (uid `1001`) → ใช้ **named volume** เท่านั้น (อย่าใช้ bind mount เพราะสิทธิ์จะไม่ตรง)
- ดิสก์ต้องว่าง **≥ 6 GB** ก่อน build (เคยพังจริง: `no space left on device` ตอน `COPY /app/.next/standalone`)
- build ใช้เวลา 5-7 นาที (build cache ถูกเคลียร์) → ทำงานใน **tmux** เพื่อกัน SSH หลุด (`client_loop: send disconnect: Broken pipe`)
- **อย่า start `p19-arena` (3001) พร้อม `p19-booking` (3002)** — ทั้งคู่ใช้ volume `p19-db` → SQLite จะมี 2 writer (lock / เสี่ยงไฟล์เสียหาย)

## 2) Pre-flight — ตรวจ 8 อย่างก่อนแตะอะไร

```bash
ssh root@103.4.217.209
tmux new -s deploy-booking          # กัน SSH หลุดกลาง build

echo "== 1. ดิสก์ (ต้องว่าง >= 6G) ==";   df -h /
echo "== 2. docker footprint ==";         docker system df
echo "== 3. container p19 ==";            docker ps -a --filter name=p19 --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
echo "== 4. volume p19 ==";               docker volume ls | grep p19
echo "== 5. nginx ชี้พอร์ตไหน ==";        nginx -T 2>/dev/null | grep -n -A4 'server_name booking.p19avenue.com' | grep -E 'server_name|proxy_pass'
echo "== 6. vhost ซ้ำ (ถ้ามี) ==";        grep -i "conflicting server name" /var/log/nginx/error.log* 2>/dev/null | tail -3
echo "== 7. โค้ดบน VPS ==";               cd /home/p19-arena && git --no-pager log --oneline -1 && git status --porcelain | head
echo "== 8. health ตัวที่รันอยู่ ==";      curl -s http://127.0.0.1:3003/api/health; echo
```

| ข้อ | เกณฑ์ผ่าน | ถ้าไม่ผ่าน |
|---|---|---|
| 1 | Avail ≥ 6 GB | `docker builder prune -af` (ปลอดภัย) แล้วเช็กซ้ำ — ถ้ายังไม่พอ **หยุด** แล้วหาไฟล์ใหญ่ใน `/home` |
| 2 | `Images` reclaimable น้อย แต่ `Build Cache` ควรเป็น 0 | เคลียร์ build cache ด้วย `docker builder prune -af` |
| 3 | `p19-arena-booking` = Up (healthy) :3003 | ถ้า Exited → ตรวจ `docker logs --tail 50 p19-arena-booking` ก่อน deploy |
| 4 | มี `p19-db` และ `p19-db-booking` | ห้ามลบ/ห้าม rename ทั้งสองตัว |
| 5 | เห็น `proxy_pass http://localhost:3003` | ถ้าเป็น **3002** → nginx ยังชี้ตัวเก่า **หยุด แล้วถามก่อน** |
| 6 | ไม่มีบรรทัด conflict | ถ้ามี → vhost ซ้ำ ต้องแก้ก่อน (ดูข้อ 9.2) |
| 7 | branch `main` และ `git status` ว่าง | มีไฟล์ค้าง → **หยุดถามก่อน** ห้ามทับ |
| 8 | `status":"ok"` และ `db.ok = true` | ถ้า degraded → DB มีปัญหา ต้องแก้ก่อน deploy |

---

## 3) สำรองของเดิม + ติดป้าย rollback (ทำก่อนทุกครั้ง)

```bash
mkdir -p /root/p19-backups

# 3.1 สำรอง DB ของ deploy 2 (ตัวที่ยังรันอยู่)
docker exec p19-arena-booking cat /app/db/data.db > /root/p19-backups/booking-$(date +%F-%H%M).db
ls -lh /root/p19-backups/          # ต้องมีขนาด > 0

# 3.2 ติดป้าย image ปัจจุบันไว้ย้อนกลับได้ใน 1 นาที
docker tag p19-arena-booking:latest p19-arena-booking:rollback-$(date +%F)
docker images | grep p19

# 3.3 บันทึก env ของ container เก่าไว้เทียบ
docker inspect p19-arena-booking --format '{{range .Config.Env}}{{println .}}{{end}}' \
  > /root/p19-backups/env-old-$(date +%F).txt
cat /root/p19-backups/env-old-*.txt
```

> **หมายเหตุ:** volume `p19-db-booking` (DB เก่า) **ไม่ต้องลบและไม่ต้องแก้** — เก็บไว้เป็นทางย้อนกลับ งานนี้จะไปใช้ volume ใหม่แทน

---

## 4) Pull โค้ดล่าสุดบน VPS

```bash
cd /home/p19-arena

git fetch origin
git --no-pager log --oneline HEAD..origin/main | head -20   # ดูว่าจะได้อะไรเพิ่ม

git pull --ff-only origin main
git --no-pager log --oneline -1                             # ต้องได้ ed93d58 (v 2.0)
git status -sb                                              # ต้อง ## main...origin/main (ไม่มี ahead/behind)
```

- `--ff-only` เท่านั้น — ปลอดภัยสุด ไม่ทับงานบนเซิร์ฟเวอร์
- ถ้าขึ้น `Already up to date.` = VPS ถือรุ่นล่าสุดแล้ว ข้ามไปข้อ 5 ได้
- ถ้า pull ไม่ผ่านเพราะมี commit/ไฟล์บน VPS → **หยุดถามก่อน** ห้าม `reset --hard`

## 5) Build image (ต้องฝัง URL ของ booking)

```bash
cd /home/p19-arena

# 5.1 เคลียร์ build cache ก่อน — ปลอดภัย ไม่แตะ container/image/volume ใคร
docker builder prune -af
df -h /                              # ยืนยันว่าง ≥ 6G

# 5.2 build image โดยฝัง URL ของ booking (บรรทัด NEXT_PUBLIC_SITE_URL = บังคับ)
docker build \
  --build-arg NEXT_PUBLIC_SITE_URL=https://booking.p19avenue.com \
  --build-arg NEXT_PUBLIC_BASE_PATH= \
  -t p19-arena-booking:v2.0 .

# 5.3 ตรวจว่า URL ถูกฝังจริง (รัน image ชั่วคราวแล้วลบทิ้ง)
docker run --rm --entrypoint printenv p19-arena-booking:v2.0 NEXT_PUBLIC_SITE_URL
# ต้องได้: https://booking.p19avenue.com      ← ถ้าได้ p19arena... เท่ากับ build ผิด
```

| เรื่อง | รายละเอียด |
|---|---|
| ค่า default ใน `Dockerfile` | `NEXT_PUBLIC_SITE_URL=https://p19arena.p19avenue.com` → **ไม่ใส่ build-arg = URL ผิดโดเมน** (กระทบ LINE Login redirect_uri + ลิงก์ ticket) |
| `NEXT_PUBLIC_BASE_PATH=` | ต้องปล่อยว่าง (Next.js ไม่รับค่า `"/"`) เพื่อให้แอปอยู่ที่รากของโดเมน |
| เวลาที่ใช้ | ~5-7 นาที (build cache ถูกล้าง) |
| ถ้าสงสัยติด cache ของ URL เก่า | เพิ่ม `--no-cache` (ช้าขึ้น ~2-3 นาที แต่ชัวร์) |
| tag `v2.0` | ทำให้ image ตัวเก่า (`p19-arena-booking:latest`) ยังอยู่ครบ → rollback ได้ |
| ถ้าล้มด้วย `no space left on device` | ดูข้อ 13.1 (ห้าม build ซ้ำก่อนปลดพื้นที่) |

---

## 6) สร้าง DB ใหม่ 🆕

```bash
# 6.1 สร้าง volume ใหม่ (ว่างเปล่า) — นี่คือ "DB ใหม่" ของงานนี้
docker volume create p19-db-booking-v2
docker volume ls | grep p19            # ต้องเห็น p19-db-booking-v2 เพิ่มมา
```

**ไม่ต้องสร้างไฟล์ DB มือ** — `Dockerfile` ตั้ง `CMD` ไว้เป็น:

```
prisma db push --skip-generate && node server.js
```

⇒ ตอน container start ครั้งแรก มันจะสร้าง `/app/db/data.db` + ตารางทั้งหมดให้อัตโนมัติ (รันซ้ำในครั้งต่อไป = ไม่ลบข้อมูลเดิม, idempotent)

| ตารางที่ถูกสร้างอัตโนมัติ |
|---|
| `Court`, `TimeSlot`, `RentalEquipment`, `User`, `Booking`, `Settings`, `PriceRule`, `CoachBooking`, `ErrorLog` |

> ⚠️ **อย่าคัดลอกไฟล์ DB เก่าเข้า volume ใหม่** — ถ้าต้องการข้อมูลเดิม ให้ใช้ volume เก่า `p19-db-booking` แทนทั้งก้อน (แล้วงานนี้ก็จะไม่ใช่ "DB ใหม่" อีกต่อไป)
> ⚠️ DB ใหม่ = **ว่างเปล่า** → ต้องทำข้อ 8 (seed + ตั้งค่า LINE) ไม่งั้นหน้าเว็บจะไม่มีสนาม/ช่วงเวลา/ราคา และ LINE Login จะใช้ไม่ได้

---

## 7) รัน container ใหม่

### ทาง A (แนะนำ — ง่ายสุด, ไม่ต้องแตะ nginx, เว็บหยุด 1-2 นาที)

```bash
# 🛑 ยืนยันก่อนรัน: คำสั่งลบ container เดิม (volume ไม่หาย — named volume ปลอดภัย)
docker rm -f p19-arena-booking

docker run -d --name p19-arena-booking --restart unless-stopped \
  -p 3003:3000 \
  -v p19-db-booking-v2:/app/db \
  p19-arena-booking:v2.0

# รอ boot (ครั้งแรกนานกว่า เพราะ prisma สร้างตาราง)
for i in $(seq 1 40); do
  sleep 2
  C=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3003/api/health)
  [ "$C" = "200" ] && break
  [ "$i" = "40" ] && { echo 'HEALTH FAILED'; docker logs --tail 40 p19-arena-booking; }
done
echo "health: $C"
```

### ทาง B (zero-downtime — รันคู่ที่พอร์ต 3004 ก่อน แล้วค่อยสลับ nginx)

```bash
docker run -d --name p19-arena-booking-v2 --restart unless-stopped \
  -p 3004:3000 \
  -v p19-db-booking-v2:/app/db \
  p19-arena-booking:v2.0

curl -s http://127.0.0.1:3004/api/health; echo
# ตรวจให้ครบตามข้อ 10 ก่อน แล้วค่อยสลับ nginx ที่ข้อ 9.2 → ค่อยลบ container เก่า (ข้อ 12)
```

| ข้อควรระวัง | เหตุผล |
|---|---|
| พอร์ตที่ว่างให้ใช้ | `3004` (ขึ้นไป) — `3000`=qform, `3001`=p19-arena (หยุดอยู่), `3002`=p19-booking ตัวเก่า, `3003`=ของเดิม |
| อย่าใช้ `-v p19-db:/app/db` | นั่นคือ DB ของ deploy 1 และถูกใช้ร่วมกับตัวเก่า (3002) → ข้อมูลจะปนกัน |
| อย่าลบ container ด้วย `-v` | `docker rm -v` จะลบ anonymous volume — ห้ามใช้ในงานนี้ |
| หลัง start สำเร็จ | ไฟล์ `data.db` ใหม่จะอยู่ที่ `/var/lib/docker/volumes/p19-db-booking-v2/_data/data.db` |

## 8) Seed ข้อมูลเริ่มต้น + ตั้งค่า LINE (จำเป็นสำหรับ DB ใหม่)

```bash
# 8.1 seed ข้อมูลฐาน (ถ้ารันทาง B ให้เปลี่ยน 3003 → 3004)
curl -s -X POST http://127.0.0.1:3003/api/seed; echo
# ต้องได้: {"message":"Seed completed"}

# 8.2 ตรวจว่า DB ใหม่มีข้อมูลจริง
curl -s http://127.0.0.1:3003/api/courts | head -c 400; echo
curl -s http://127.0.0.1:3003/api/timeslots | head -c 200; echo
curl -s http://127.0.0.1:3003/api/pricerules | head -c 300; echo
curl -s http://127.0.0.1:3003/api/settings; echo
```

**`POST /api/seed` สร้างอะไรให้** (idempotent — รันซ้ำไม่พัง):

| สิ่งที่สร้าง | รายละเอียด |
|---|---|
| สนาม | 3 สนาม (`สนาม 1` 300/ชม., `สนาม 2` 300/ชม., `สนาม 3` 400/ชม.) |
| ช่วงเวลา | 12 ช่วง × 7 วัน (08:00-12:00, 13:00-21:00) |
| อุปกรณ์เช่า | `แร็กเก็ตพิคเคิลบอล` 50 บาท (และลบรายการ "บอล" ออก เพราะให้ฟรี) |
| กฎราคา | จ-ศ 07:00-22:00 = 300 · ส-อา 07:00-22:00 = 400 |
| Settings | `arena_name`, `arena_phone`, `arena_address` |

### 8.3 ตั้งค่า LINE (DB ใหม่จะยังไม่มีค่า → LINE Login จะไม่ทำงาน)

| ต้องทำ | ที่ไหน |
|---|---|
| Callback URL ต้องมี `https://booking.p19avenue.com/` | LINE Developers Console (เพิ่มได้หลาย URL — คงของเดิมไว้ได้) |
| `line_channel_id` + `line_channel_secret` | หน้า Dashboard → ตั้งค่า → LINE แล้วกดบันทึก (ค่าอยู่ในตาราง `Settings`) |
| หรือใช้ env `LINE_CHANNEL_SECRET` แทน | เติม `-e LINE_CHANNEL_SECRET=...` ตอน `docker run` (ทางเลือก) |
| `NEXT_PUBLIC_LINE_CHANNEL_ID` | ถูกฝังใน image ตอน build (= `2011357077`) ไม่ต้องตั้งใน DB |

> ลำดับความสำคัญ: ค่าใน DB (`Settings`) มีผลเหนือ env — ดู `src/app/api/line-token/route.ts`
> ถ้าไม่ตั้งอะไรเลย → `GET /api/line-token` จะตอบ `500 LINE credentials are not configured`

---

## 9) nginx

### 9.1 ถ้าใช้ทาง A (พอร์ต 3003 เดิม) — **ไม่ต้องแก้ nginx**

เพียงยืนยันว่ายังชี้ถูก:
```bash
nginx -T 2>/dev/null | grep -n -A4 'server_name booking.p19avenue.com' | grep -E 'server_name|proxy_pass|listen'
# ต้องเห็น proxy_pass http://localhost:3003
```

### 9.2 ถ้าใช้ทาง B (ย้ายไปพอร์ต 3004) — 🛑 ต้องยืนยันก่อนแก้ config production

```bash
# ปิดพอร์ต 3003 → 3004 ใน vhost
cp /etc/nginx/conf.d/booking.p19avenue.com.conf /etc/nginx/conf.d/booking.p19avenue.com.conf.bak-$(date +%F)
sed -i 's|proxy_pass http://localhost:3003;|proxy_pass http://localhost:3004;|' /etc/nginx/conf.d/booking.p19avenue.com.conf
grep -n 'proxy_pass' /etc/nginx/conf.d/booking.p19avenue.com.conf

nginx -t && systemctl reload nginx
```

> 📌 ถ้าไฟล์จริงชื่อ/พาธอื่น ให้ดูจาก `nginx -T` (แต่ละบล็อกจะพิมพ์บรรทัด `# configuration file /path/...` กำกับ) แล้วแก้ไฟล์นั้นแทน — **อย่าเดา path**

> ⚠️ **กับดักที่พบจริงบนเครื่องนี้:** มี vhost 2 บล็อกที่ประกาศ `server_name booking.p19avenue.com` ซ้ำกัน (บล็อกหนึ่ง listen `103.4.217.209:80/443` อีกบล็อก listen ทั้ง `103.4.217.209` และ `216.144.255.179`) → nginx จะใช้ **บล็อกแรกที่โหลดก่อน** และขึ้น warning `conflicting server name ... ignored` ให้ตรวจ:
> ```bash
> grep -i "conflicting server name" /var/log/nginx/error.log* | tail -5
> nginx -T 2>/dev/null | grep -n 'proxy_pass'       # ดูว่าไฟล์ไหน/พอร์ตไหนถูกใช้จริง
> ```
> ถ้าบล็อกที่ "มีผล" ไม่ใช่ไฟล์ที่เราแก้ **ห้ามแก้เอง** — แจ้งกลับก่อน (การปิด vhost placeholder ของ DirectAdmin = กระทบ production)

---

## 10) ตรวจหลัง deploy (checklist — ครบทุกข้อก่อนประกาศว่าเสร็จ)

| # | ตรวจ | คำสั่ง | เกณฑ์ผ่าน |
|---|---|---|---|
| 1 | health ในเครื่อง | `curl -s http://127.0.0.1:3003/api/health` | `"status":"ok"` และ `db.ok = true` |
| 2 | ผ่านโดเมน | `curl -s https://booking.p19avenue.com/api/health` | `200` (ไม่ใช่ 502) |
| 3 | URL ที่ฝังใน image | `docker exec p19-arena-booking printenv NEXT_PUBLIC_SITE_URL` | `https://booking.p19avenue.com` |
| 4 | **DB ใหม่จริง** | `docker exec p19-arena-booking ls -la /app/db` | มี `data.db` และเป็นของใหม่ (ขนาดเล็ก) |
| 5 | volume ที่ผูกอยู่ | `docker inspect p19-arena-booking --format '{{range .Mounts}}{{.Name}} -> {{.Destination}}{{"\n"}}{{end}}'` | `p19-db-booking-v2 -> /app/db` |
| 6 | seed แล้ว | `curl -s http://127.0.0.1:3003/api/courts` | เห็น 3 สนาม |
| 7 | จองทดสอบ 1 ครั้ง | เปิดหน้าเว็บจริง → จอง → ดูหน้า ticket | ลิงก์ ticket เป็น `booking.p19avenue.com` |
| 8 | LINE Login | กดเข้าสู่ระบบด้วย LINE 1 ครั้ง | สำเร็จ (ต้องตั้งข้อ 8.3 ก่อน) |
| 9 | ไม่กระทบคนอื่น | `docker ps --format 'table {{.Names}}\t{{.Status}}'` | qform(3000), p19-booking(3002), postgres×2, n8n, db-crm ยัง Up เหมือนเดิม |
| 10 | ดิสก์ | `df -h /` | ไม่ต่ำกว่าเดิมจนน่ากังวล (เข้าใจว่า build กินที่) |
| 11 | เก็บหลักฐาน | `docker logs --tail 30 p19-arena-booking` | ไม่มี error ต่อเนื่อง |

**ทริคยืนยันว่าตัวไหนตอบจริง** (กรณีไม่แน่ใจว่า nginx ไป 3003 หรือที่อื่น):
เทียบ `uptimeSec` ใน `/api/health` กับ `docker ps` — ตัวที่เพิ่ง start จะมี uptime เป็นนาที ไม่ใช่หลักวัน

---

## 11) Rollback (ถ้าข้อ 10 ไม่ผ่าน)

```bash
# 11.1 หยุด/ลบตัวใหม่ (ทาง B: ชื่อ p19-arena-booking-v2)
docker rm -f p19-arena-booking

# 11.2 รันตัวเก่ากลับ ด้วย image ที่ติดป้ายไว้ + DB เก่า (ไม่เคยถูกแตะ)
docker run -d --name p19-arena-booking --restart unless-stopped \
  -p 3003:3000 \
  -v p19-db-booking:/app/db \
  p19-arena-booking:rollback-<วันที่>

# 11.3 ตรวจกลับ
sleep 15 && curl -s http://127.0.0.1:3003/api/health; echo
```
- ถ้าใช้ทาง B → ต้องแก้ nginx กลับเป็น `3003` + `nginx -t && systemctl reload nginx`
- DB เก่า (`p19-db-booking`) ยังครบทุกแถว เพราะงานนี้ไม่เคยแตะ — ข้อมูลการจองเดิมกลับมาเหมือนเดิม

## 12) เก็บกวาด (ทำหลังเว็บใหม่ทำงานครบ 3-7 วัน)

> 🛑 ทุกคำสั่งในข้อนี้เป็นการ **ลบของจริง** — ต้องยืนยันทีละคำสั่งก่อนรัน

```bash
# 12.1 ลบ container เก่า (ทาง B = ตัวที่ยังรันที่ 3003)
docker ps -a --filter name=p19 --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'
docker stop p19-arena-booking && docker rm p19-arena-booking

# 12.2 ลบ image เก่า/ตัวค้าง (ลบแบบเจาะจงเท่านั้น)
docker images | grep p19
docker rmi p19-arena-booking:latest p19-arena-booking:rollback-<วันที่ที่เลิกใช้>

# 12.3 เช็กผล
docker images | grep p19
docker volume ls | grep p19
df -h /
```

| ห้ามในข้อนี้ | เหตุผล |
|---|---|
| `docker system prune -a --volumes -f` | ลบ volume ของโปรเจกต์อื่นบนเครื่องนี้ |
| ลบ volume `p19-db-booking` (DB เก่า) | เก็บไว้ ≥ 7-30 วันเป็นหลักฐาน/rollback |
| ลบ/แตะ volume `p19-db` | ใช้ร่วมโดย `p19-arena` + `p19-booking` |
| ลบ container/image ของโปรเจกต์อื่น | ไม่ใช่ขอบเขตของงานนี้ |

> ⚠️ **ห้ามใช้ `p19pull2` กับงานนี้โดยตรง** — สคริปต์นั้นผูก volume `p19-db-booking` (DB เก่า) ไว้ ถ้าต้องการให้สคริปต์ชี้ DB ใหม่ ต้องแก้ตัวสคริปต์ก่อน (เป็นการแก้ของใช้ร่วม → ขออนุมัติ)

---

## 13) Troubleshooting (จากเหตุการณ์จริงบนเครื่องนี้)

### 13.1 `no space left on device`
| อาการ | สาเหตุ | วิธีแก้ |
|---|---|---|
| ล้มตอน `COPY --from=builder /app/.next/standalone` แล้วขึ้น `ResourceExhausted` | ดิสก์เต็มกลาง build | `docker builder prune -af` → `df -h /` → ต้องว่าง ≥ 6G แล้ว build ใหม่ |
| `failed to update builder last activity time: write /root/.docker/buildx/...` | เต็มจน buildx เขียนไม่ได้ | เหมือนกัน — ปลดพื้นที่ก่อน **อย่า build ซ้ำ** |
| ปลด Docker แล้วยังไม่พอ | ที่จริงอยู่นอก Docker (≈34GB) | `du -xhd1 /home \| sort -h \| tail -15` · `journalctl --disk-usage` · ไฟล์ backup ใน `/root` |

### 13.2 SSH หลุดกลาง build (`client_loop: send disconnect: Broken pipe`)
build ใช้เวลา 5-7 นาที → ทำงานใน `tmux` เสมอ (`tmux new -s deploy-booking`) หรือ ssh ด้วย `-o ServerAliveInterval=30 -o TCPKeepAlive=yes`

### 13.3 container ออกด้วย `Exited (137)`
= ถูก SIGKILL (ไม่จบภายในเวลาที่ให้) → SQLite อาจถูกตัดกลางการเขียน
ตรวจ: `curl -s http://127.0.0.1:3003/api/health` ต้องได้ `db.ok = true` (ฟิลด์นี้รัน `SELECT 1` จริง)
ถ้ายังไม่วางใจเรื่องไฟล์เสียหาย: **อย่ารัน sqlite3 ใน container** (image `node:20-slim` ไม่มี CLI ตัวนี้) — เลือกทำวิธีใดวิธีหนึ่งต่อไปนี้
- `docker exec p19-arena-booking sh -c "cd /app && node -e \"const{PrismaClient}=require('@prisma/client');new PrismaClient().\\$queryRawUnsafe('PRAGMA integrity_check').then(r=>console.log(r)).finally(()=>process.exit(0))\""`
- หรือหยุด container แล้วคัดลอก `data.db` ออกมาเปิดด้วยเครื่องมือบน host
- หรือทางที่ปลอดภัยสุด: กู้จาก backup ในข้อ 3 (`/root/p19-backups/`)


> 💡 บรรทัด `node -e` ข้างบนเป็นทางเลือกสำหรับคนที่สะดวกกับ quoting เท่านั้น — ถ้าพิมพ์แล้ว error ให้ใช้ 2 วิธีหลัง (ดู log / `docker cp`) ซึ่งเพียงพอต่อการตัดสินใจ


### 13.4 `conflicting server name "booking.p19avenue.com"`
มี vhost 2 บล็อกประกาศชื่อซ้ำ → บล็อกหลังถูก ignore (อาจไม่ใช่ไฟล์ที่เราแก้) → ตรวจด้วย `grep -i "conflicting server name" /var/log/nginx/error.log*` แล้วแจ้งกลับก่อนแก้

### 13.5 หลัง DB ใหม่แล้ว LINE Login ไม่ได้
`GET /api/line-token` ตอบ 500 → DB ใหม่ยังไม่มี `line_channel_id`/`line_channel_secret` → ตั้งในหน้า Dashboard → ตั้งค่า → LINE (หรือใส่ env `LINE_CHANNEL_SECRET`) + ตรวจ Callback URL ใน LINE Console

### 13.6 หน้าเว็บไม่มีสนาม/ช่วงเวลา/ราคา
ยังไม่ได้ seed → `curl -X POST http://127.0.0.1:3003/api/seed`

### 13.7 `prisma db push` ล้มตอน start (container restart loop)
| สาเหตุ | ตรวจ |
|---|---|
| volume ไม่ถูกสร้าง/ผูกผิด | `docker inspect p19-arena-booking --format '{{range .Mounts}}...'` |
| ใช้ bind mount แทน named volume → สิทธิ์ไม่ตรง (container รัน uid 1001) | เปลี่ยนเป็น named volume |
| ดูสาเหตุจริง | `docker logs --tail 60 p19-arena-booking` |

### 13.8 `database is locked`
เกิดเมื่อมี 2 process เขียน SQLite เดียวกัน → ห้าม start `p19-arena` (3001) พร้อม `p19-booking` (3002) เพราะใช้ `p19-db` ร่วมกัน

### 13.9 health ตอบ `503` / `"status":"degraded"`
ดูฟิลด์ `db.error` ใน response — มักเป็น path/สิทธิ์ของ DATABASE_URL หรือดิสก์เต็ม

### 13.10 ลิงก์ ticket / LINE redirect ชี้ `p19arena.p19avenue.com`
build โดยไม่ได้ใส่ `--build-arg NEXT_PUBLIC_SITE_URL` → build ใหม่ (ถ้าสงสัย cache ให้ `--no-cache` หรือเปลี่ยน tag) แล้วตรวจซ้ำด้วย `printenv`

---

## 14) สรุปคำสั่งห้ามใช้บนเครื่องนี้ (Cheat sheet)

```text
ห้าม: docker system prune -a --volumes -f      (ลบ volume โปรเจกต์อื่น)
ห้าม: docker system prune --volumes            (เช่นกัน)
ห้าม: rm -rf /var/lib/docker/*                 (พังทั้งเครื่อง)
ห้าม: git reset --hard / checkout --force      (ทับงานบน VPS)
ห้าม: ใช้ p19pull (มี prune --volumes)
ห้าม: แตะ volume p19-db (ใช้ร่วม 2 container)
ห้าม: start p19-arena พร้อม p19-booking (SQLite 2 writer)

ต้องยืนยันก่อน: docker rm / docker rmi / ลบ volume / แก้ nginx vhost
ควรใช้: tmux · git pull --ff-only · docker builder prune -af · named volume
```

---

## 15) เอกสารที่เกี่ยวข้อง

| ไฟล์ | เนื้อหา |
|---|---|
| `DEPLOY.md` | deploy 1 — `p19arena.p19avenue.com` (container `p19-arena`, พอร์ต 3001, volume `p19-db`) |
| `DEPLOY2.md` | dual deploy เดิม — ภาพรวม 2 deploy บน VPS เดียวกัน (ที่มา: พอร์ต 3002 ถูก container เก่าครองอยู่) |
| `deploy-booking.md` | เอกสารนี้ — deploy booking พร้อม **DB ใหม่** (volume `p19-db-booking-v2`) |
| `note2.txt` (นอก repo, `/home/pannavith1/code-amd7/`) | runbook เดิม + สคริปต์ `p19pull` / `p19pull2` (ระวัง `p19pull` มี prune) |

---

### สถานะปัจจุบันบน VPS (ณ วันที่จัดทำ)

| Container | Image | พอร์ต | Volume | สถานะ |
|---|---|---|---|---|
| `p19-arena` | `p19-arena:latest` | 3001 | **`p19-db`** | Exited (หยุดไว้) |
| `p19-arena-booking` | `p19-arena-booking:latest` | 3003 | `p19-db-booking` | Up 4 days (healthy) — ตัวที่เอกสารนี้จะแทนที่ |
| `p19-booking` (เก่า) | `p19-booking:latest` | 3002 | **`p19-db`** (ใช้ร่วมกับตัวบน) | Up 5 days — ยังรันอยู่, clone ที่ commit `ac99360` |

> nginx: `booking.p19avenue.com` → `proxy_pass http://localhost:3003` (พบ vhost ซ้ำ 1 จุด — ดูข้อ 9.2)




