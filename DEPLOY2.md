# 🚀 Deploy 2 — P19 Pickleball Arena ที่ https://booking.p19avenue.com/

> งานนี้เป็น **deployment ที่สอง รันคู่กับ deploy หลัก** (p19arena.p19avenue.com) บน VPS เดียวกัน
> หัวใจสำคัญ: `NEXT_PUBLIC_SITE_URL` เป็น env ตอน build — image แยกกัน ต่าง URL กันได้จาก repo เดียว
>
> | | Deploy 1 (หลัก) | Deploy 2 (อันนี้) |
> |---|---|---|
> | URL | `https://p19arena.p19avenue.com` | `https://booking.p19avenue.com` |
> | Container | `p19-arena` | `p19-arena-booking` |
> | Image | `p19-arena` | `p19-arena-booking` |
> | Port | 3001 | **3003** (3002 ถูก container `p19-booking` ตัวเก่าครองอยู่) |
> | DB volume | `p19-db` | `p19-db-booking` |
> | เอกสาร | `DEPLOY.md` | `DEPLOY2.md` (ไฟล์นี้) |

## 1) DNS (ทำครั้งแรก)
ที่ DirectAdmin → DNS Management → `p19avenue.com` → เพิ่ม record:
```
A    booking    103.4.217.209
```
ตรวจ: `dig +short booking.p19avenue.com` → ต้องได้ `103.4.217.209`

## 2) Build + รัน container ที่สอง (port 3003)
```bash
cd /home/p19-arena   # หรือ /home/p19-booking (repo เดียวกัน)

# build image แยก โดย bake URL ของ booking เข้าไป (สำคัญ: ใช้สำหรับ LINE Login redirect_uri + ลิงก์ ticket)
docker build --build-arg NEXT_PUBLIC_SITE_URL=https://booking.p19avenue.com -t p19-arena-booking .

docker volume create p19-db-booking
docker run -d --name p19-arena-booking --restart unless-stopped \
  -p 3003:3000 -v p19-db-booking:/app/db p19-arena-booking

# ทดสอบ — ต้องได้ {"status":"ok",...}
curl -s http://127.0.0.1:3003/api/health
```
> - Container `p19-arena` (deploy 1) **ยังรันต่อที่ 3001 ตามเดิม ไม่กระทบ**
> - **Port 3002 ถูก container `p19-booking` ตัวเก่าครองอยู่** — จึงใช้ 3003; ถ้าวันหนึ่งลบ p19-booking ตัวเก่าแล้ว อาจย้ายกลับมา 3002 ได้
> - ครั้งแรกที่ build ให้ใช้ `--no-cache` เสมอ เพราะ `NEXT_PUBLIC_SITE_URL` ถูก bake ตอน build — ถ้าโดน cache จะได้ URL ของ deploy 1 (ตรวจ: `docker exec p19-arena-booking printenv NEXT_PUBLIC_SITE_URL` → ต้องได้ `https://booking.p19avenue.com`)
> - DB แยกกัน (`p19-db-booking`) — ข้อมูลการจองของ deploy 1 ไม่ถูกแตะ และ deploy 2 เริ่มจาก DB ใหม่
> - ถ้าต้องการให้ deploy 2 ใช้ **DB เดียวกัน** ให้ใช้ `-v p19-db:/app/db` แทน (แต่การจองจะปนกันทั้งสองเว็บ — แนะนำแยก)

## 3) SSL cert (ครั้งแรก)
```bash
systemctl stop nginx
certbot certonly --standalone -d booking.p19avenue.com
systemctl start nginx
ls /etc/letsencrypt/live/booking.p19avenue.com/   # ต้องเห็น fullchain.pem, privkey.pem
```

## 4) nginx vhost (port 3003)
```bash
cat > /etc/nginx/conf.d/booking.p19avenue.com.conf <<'EOF'
server {
    listen 80;
    server_name booking.p19avenue.com;
    return 301 https://$host$request_uri;
}
server {
    listen 443 ssl http2;
    server_name booking.p19avenue.com;
    ssl_certificate     /etc/letsencrypt/live/booking.p19avenue.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/booking.p19avenue.com/privkey.pem;
    location / {
        proxy_pass http://localhost:3003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
nginx -t && systemctl reload nginx
```
> ถ้า DirectAdmin เสิร์ฟ placeholder ของ booking อยู่ vhost นี้จะ override — ถ้า `nginx -t` ฟ้อง conflicting server name ให้ปิด/แก้ vhost เดิมของ DirectAdmin ก่อน

## 5) verify
```bash
curl -s https://booking.p19avenue.com/api/health        # {"status":"ok",...}
curl -s https://p19arena.p19avenue.com/api/health       # deploy 1 ยัง ok
```

## 6) LINE Login
ใน LINE Developers Console เพิ่ม Callback URL:
```
https://booking.p19avenue.com/
```
(คง `https://p19arena.p19avenue.com/` ไว้ด้วย — LINE รองรับหลาย callback URL)

## 7) อัปเดตเวอร์ชันภายหลัง
```bash
cd /home/p19-arena
git pull --ff-only origin main
# deploy 1
docker build -t p19-arena . && docker rm -f p19-arena && \
docker run -d --name p19-arena --restart unless-stopped -p 3001:3000 -v p19-db:/app/db p19-arena
# deploy 2
docker build --build-arg NEXT_PUBLIC_SITE_URL=https://booking.p19avenue.com -t p19-arena-booking . && \
docker rm -f p19-arena-booking && \
docker run -d --name p19-arena-booking --restart unless-stopped -p 3003:3000 -v p19-db-booking:/app/db p19-arena-booking
```

## 8) (แนะนำ) สคริปต์ p19pull2 — อัปเดต deploy 2 คำสั่งเดียว
```bash
cat > /usr/local/bin/p19pull2 <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
REPO=$(dirname "$(readlink -f /home/p19-arena/DEPLOY.md)" 2>/dev/null || echo /home/p19-arena)
cd /home/p19-arena
git pull --ff-only origin "$(git rev-parse --abbrev-ref HEAD)"
docker build --build-arg NEXT_PUBLIC_SITE_URL=https://booking.p19avenue.com -t p19-arena-booking .
docker rm -f p19-arena-booking 2>/dev/null || true
docker run -d --name p19-arena-booking --restart unless-stopped \
  -p 3003:3000 -v p19-db-booking:/app/db p19-arena-booking
for i in $(seq 1 30); do
  sleep 2
  CODE=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3003/api/health || true)
  [ "$CODE" = "200" ] && break
  [ "$i" = "30" ] && { echo 'HEALTH CHECK FAILED'; docker logs --tail 30 p19-arena-booking; exit 1; }
done
echo "health: $CODE — booking.p19avenue.com redeployed OK"
EOF
chmod +x /usr/local/bin/p19pull2
```

## ⚠️ ข้อควรระวัง
- **อย่าลบ container/volume ของ deploy 1** (`p19-arena`, `p19-db`) — เป็นของ p19arena.p19avenue.com
- firewall เปิดแค่ 80/443 — 3001/3003 ให้ bind เฉพาะ localhost เท่านั้น
- สำรอง DB deploy 2: `docker exec p19-arena-booking cat /app/db/data.db > backup-booking-$(date +%F).db`
