# 🚀 Deploy บน VPS (Production) — P19 Pickleball Arena

> Production = **VPS** (SQLite ทำงานเต็มรูปแบบ) · Vercel = **preview เท่านั้น** (ไม่มี DB — API จะ 500 บน preview ถือเป็นเรื่องปกติ)
>
> **Deploy URL:** `https://p19arena.p19avenue.com/` — subdomain สำหรับแอป booking (สะอาด URL ราก `/`)
> (ตั้งผ่าน `NEXT_PUBLIC_BASE_PATH=/` ตอน build — Dockerfile ตั้ง default ไว้ให้แล้ว; ากต้องการ subpath ใช้ `--build-arg NEXT_PUBLIC_BASE_PATH=/p19arena`)

## 0) สิ่งที่ต้องมีบน VPS
- **Docker** (แนะนำ — ใช้ `Dockerfile` ในรีโป) **หรือ** Node.js ≥ 20
- Git และ (ถ้าต้องการ domain/HTTPS) **Caddy** / Nginx

## 1) Deploy แบบ Docker (แนะนำ — ง่ายที่สุด)
```bash
git clone https://github.com/pkbom105/p19-arena.git && cd p19-arena
docker build -t p19-arena .
docker volume create p19-db
docker run -d --name p19-arena --restart unless-stopped \
  -p 3001:3000 \
  -v p19-db:/app/db \
  p19-arena
# ทดสอบ: curl http://localhost:3001/ → ต้องได้ 200
```
- `Dockerfile` build แบบ multi-stage (deps → builder → runner), รันด้วย user ไม่ใช่ root
- **basePath default = `/`** (clean URL สำหรับ subdomain `https://p19arena.p19avenue.com`; ถ้าจะรันใต้พาธ: `docker build --build-arg NEXT_PUBLIC_BASE_PATH=/p19arena .`)
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
npm run build:standalone   # basePath default = / (clean URL)
npm run start:standalone:node     # รันที่ 0.0.0.0:3000 (ทดสอบก่อน: curl localhost:3001/)
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

## 6) Reverse proxy — https://p19arena.p19avenue.com (nginx — HTTPS อัตโนมัติ)

**สำคัญ:** แอปใช้ basePath default = `/` — ห้าม strip หรือ rewrite พาธ (ไม่ต้องแตะ `location` ที่เป็นของ Apache แล้ว)**

```nginx
server {
	listen 443 ssl http2;
	server_name p19arena.p19avenue.com;
	ssl_certificate /etc/letsencrypt/live/p19arena.p19avenue.com/fullchain.pem;
	ssl_certificate_key /etc/letsencrypt/live/p19arena.p19avenue.com/privkey.pem;
	location / {
		proxy_pass http://localhost:3001;
		proxy_http_version 1.1;
		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection "upgrade";
		proxy_set_header Host $host;
		proxy_set_header X-Real-IP $remote_addr;
		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
		proxy_set_header X-Forwarded-Proto $scheme;
	}
}
```

ผลลัพธ์: `https://p19arena.p19avenue.com/` → แอป P19 Pickleball Arena ✓

> DirectAdmin: ใช้ Proxy feature ชี้ไปที่ `http://localhost:3001` (หรือแทรก `location /` ด้านบนใน vhost ของ subdomain ก็ได้)

## 7) อัปเดตเวอร์ชันภายหลัง
```bash
# Docker
git pull && docker build -t p19-arena . && docker rm -f p19-arena && \
docker run -d --name p19-arena --restart unless-stopped -p 3001:3000 -v p19-db:/app/db p19-arena

# Node
git pull && npm ci && npx prisma generate
npx prisma db push        # ถ้า schema เปลี่ยน (ระวัง --accept-data-loss)
npm run build:standalone
pm2 restart p19-arena
```

## ⚠️ ข้อควรระวัง
- อย่ารัน `prisma db push --accept-data-loss` บน prod โดยไม่สำรอง DB ก่อน
- อย่า commit `.env` หรือ `db/*.db` ขึ้น git (ถูก gitignore อยู่แล้ว)
- พอร์ตที่เปิดใน firewall: 80/443 (nginx) — 3001 ให้เปิดเฉพาะ localhost
