# 🚀 Deploy บน VPS (Production) — P19 Pickleball Arena

> Production = **VPS** (SQLite ทำงานเต็มรูปแบบ) · Vercel = **preview เท่านั้น** (ไม่มี DB — API จะ 500 บน preview ถือเป็นเรื่องปกติ)

## 0) สิ่งที่ต้องมีบน VPS
- **Node.js ≥ 20** (`node -v` เช็ก) — ไม่ต้องติดตั้ง bun (มี script แบบ node ให้แล้ว)
- Git, และ (ถ้าต้องการ domain/HTTPS) **Caddy** — รีโปมี `Caddyfile` ให้แล้ว

## 1) ดึงโค้ด + ติดตั้ง
```bash
git clone https://github.com/pkbom105/p19-arena.git && cd p19-arena
npm ci
npx prisma generate
```

## 2) ตั้งค่า environment
`.env` **ไม่ถูก commit** (ปลอดภัย) — ต้องสร้างเองบน VPS:
```bash
cat > .env <<'EOF'
DATABASE_URL="file:../db/dev.db"
EOF
```

## 3) สร้างฐานข้อมูล (SQLite)
```bash
mkdir -p db
npx prisma db push        # สร้างตารางทั้งหมด (Court/TimeSlot/Equipment/User/Booking/Settings/PriceRule)
```
> DB เก็บที่ `db/dev.db` — **สำรองไฟล์นี้เป็นประจำ** (`cp db/dev.db ~/backups/dev-$(date +%F).db`)

## 4) Build + รัน
```bash
npm run build:standalone          # next build + คัดลอก static/public เข้า standalone
npm run start:standalone:node     # รันที่ 0.0.0.0:3000 (ทดสอบก่อน: curl localhost:3000)
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

## 5) Reverse proxy (Caddy — HTTPS อัตโนมัติ)
ใช้ `Caddyfile` ที่มีในรีโป (proxy :8080 → :3000) หรือแก้เป็นโดเมนจริง:
```
yourdomain.com {
    reverse_proxy localhost:3000
}
```
```bash
sudo caddy start --config Caddyfile   # หรือ systemd
```

## 6) อัปเดตเวอร์ชันภายหลัง
```bash
git pull
npm ci && npx prisma generate
npx prisma db push        # ถ้า schema เปลี่ยน (ระวัง --accept-data-loss)
npm run build:standalone
pm2 restart p19-arena
```

## ⚠️ ข้อควรระวัง
- อย่ารัน `prisma db push --accept-data-loss` บน prod โดยไม่สำรอง DB ก่อน
- อย่า commit `.env` หรือ `db/*.db` ขึ้น git (ถูก gitignore อยู่แล้ว)
- พอร์ตที่เปิดใน firewall: 80/443 (Caddy) — 3000 ให้เปิดเฉพาะ localhost
