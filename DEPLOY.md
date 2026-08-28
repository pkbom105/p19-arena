# 🚀 Deploy บน VPS (Production) — P19 Pickleball Arena

> Production = **VPS** (SQLite ทำงานเต็มรูปแบบ) · Vercel = **preview เท่านั้น** (ไม่มี DB — API จะ 500 บน preview ถือเป็นเรื่องปกติ)
>
> **Deploy URL:** `https://p19avenue.com/p19arena` — แอปรันภายใต้ subpath `/p19arena`
> (ตั้งผ่าน `NEXT_PUBLIC_BASE_PATH=/p19arena` ตอน build — Dockerfile ตั้งค่านี้ให้แล้ว)

## 0) สิ่งที่ต้องมีบน VPS
- **Docker** (แนะนำ — ใช้ `Dockerfile` ในรีโป) **หรือ** Node.js ≥ 20
- Git และ (ถ้าต้องการ domain/HTTPS) **Caddy** / Nginx

## 1) Deploy แบบ Docker (แนะนำ — ง่ายที่สุด)
```bash
git clone https://github.com/pkbom105/p19-arena.git && cd p19-arena
docker build -t p19-arena .
docker volume create p19-db
docker run -d --name p19-arena --restart unless-stopped \
  -p 3000:3000 \
  -v p19-db:/app/db \
  p19-arena
# ทดสอบ: curl http://localhost:3000/p19arena → ต้องได้ 200
```
- `Dockerfile` build แบบ multi-stage (deps → builder → runner), รันด้วย user ไม่ใช่ root
- **basePath `/p19arena` ถูกตั้งใน image แล้ว** (ARG `NEXT_PUBLIC_BASE_PATH=/p19arena` — ถ้าจะเปลี่ยน: `docker build --build-arg NEXT_PUBLIC_BASE_PATH=/ .`)
- **DB อยู่ที่ `/app/db/data.db` ใน volume `p19-db`** — ข้อมูลการจองอยู่รอดตอน rebuild container
- สำรอง DB: `docker exec p19-arena cat /app/db/data.db > backup-$(date +%F).db`

## 2) Deploy แบบ Node ตรง ๆ (ไม่ใช้ Docker)
```bash
git clone https://github.com/pkbom105/p19-arena.git && cd p19-arena
npm ci
npx prisma generate
```

## 3) ตั้งค่า environment (เฉพาะแบบ Node — แบบ Docker ไม่ต้อง)
`.env` **ไม่ถูก commit** (ปลอดภัย) — ต้องสร้างเองบน VPS:
```bash
cat > .env <<'EOF'
DATABASE_URL="file:../db/dev.db"
EOF
```

## 4) สร้างฐานข้อมูล (เฉพาะแบบ Node)
```bash
mkdir -p db
npx prisma db push        # สร้างตารางทั้งหมด (Court/TimeSlot/Equipment/User/Booking/Settings/PriceRule)
```
> DB เก็บที่ `db/dev.db` — **สำรองไฟล์นี้เป็นประจำ** (`cp db/dev.db ~/backups/dev-$(date +%F).db`)

## 5) Build + รัน (แบบ Node)
```bash
NEXT_PUBLIC_BASE_PATH=/p19arena npm run build:standalone   # ต้องมี basePath เพื่อให้ตรงกับ /p19arena
npm run start:standalone:node     # รันที่ 0.0.0.0:3000 (ทดสอบก่อน: curl localhost:3000/p19arena)
```

### รันถาวรด้วย PM2 (แนะนำ)
```bash
npm i -g pm2
pm2 start npm --name p19-arena -- run start:standalone:node
pm2 save && pm2 startup      # ปิด/เปิดเครื่องรันเอง
pm2 logs p19-arena           # ดู log
```

### หรือ systemd (ทางเลือก)
```ini
# /etc/systemd/system/p19-arena.service
[Unit]
Description=P19 Pickleball Arena
After=network.target

[Service]
WorkingDirectory=/path/to/p19-arena
ExecStart=/usr/bin/node .next/standalone/server.js
Environment=NODE_ENV=production
Environment=HOSTNAME=0.0.0.0
Environment=PORT=3000
Restart=always

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl enable --now p19-arena
```

## 6) Reverse proxy — p19avenue.com/p19arena (Caddy — HTTPS อัตโนมัติ)
**สำคัญ:** อย่า strip พาธ `/p19arena` ออก (ห้ามใช้ `handle_path`) — แอปตั้ง basePath ไว้แล้ว ต้องได้รับพาธเต็ม:
```
p19avenue.com {
    reverse_proxy /p19arena/* localhost:3000
}
```
```bash
sudo caddy start --config Caddyfile   # หรือ systemd
```
ผลลัพธ์: `https://p19avenue.com/p19arena` → แอป P19 Pickleball Arena ✓
> หมายเหตุ Nginx: ใช้ `location /p19arena { proxy_pass http://localhost:3000; }` (ไม่ต้อง rewrite พาธ)

## 7) อัปเดตเวอร์ชันภายหลัง
```bash
# Docker
git pull && docker build -t p19-arena . && docker rm -f p19-arena && \
docker run -d --name p19-arena --restart unless-stopped -p 3000:3000 -v p19-db:/app/db p19-arena

# Node
git pull && npm ci && npx prisma generate
npx prisma db push        # ถ้า schema เปลี่ยน (ระวัง --accept-data-loss)
NEXT_PUBLIC_BASE_PATH=/p19arena npm run build:standalone
pm2 restart p19-arena
```

## ⚠️ ข้อควรระวัง
- อย่ารัน `prisma db push --accept-data-loss` บน prod โดยไม่สำรอง DB ก่อน
- อย่า commit `.env` หรือ `db/*.db` ขึ้น git (ถูก gitignore อยู่แล้ว)
- พอร์ตที่เปิดใน firewall: 80/443 (Caddy) — 3000 ให้เปิดเฉพาะ localhost
