# syntax=docker/dockerfile:1

# ===== Stage 1: deps (ติดตั้ง dependencies + prisma generate) =====
FROM node:20-slim AS deps
# openssl จำเป็นสำหรับ Prisma engine
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci
RUN npx prisma generate

# ===== Stage 2: builder (build standalone) =====
FROM node:20-slim AS builder
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# subpath ของแอป — default = ราก `/` (สะอาด URL ที่ https://p19arena.p19avenue.com)
# ต้องการ root: ปล่อยว่างไว้!! (Next.js ไม่อ่านค่า "/" — ต้องเป็น empty string เท่านั้น)
# ถ้าต้องการรันใต้ subpath เช่น /p19arena: docker build --build-arg NEXT_PUBLIC_BASE_PATH=/p19arena .
ARG NEXT_PUBLIC_BASE_PATH=
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH
# NEXT_PUBLIC_* ถูก inline ใน client bundle ตอน build — ต้องแปะตรงนี้ ไม่งั้น LINE login ใช้ค่า fallback
ARG NEXT_PUBLIC_LINE_CHANNEL_ID=2011357077
ENV NEXT_PUBLIC_LINE_CHANNEL_ID=$NEXT_PUBLIC_LINE_CHANNEL_ID
# canonical URL ของเว็บ — ใช้เป็น redirect_uri ของ LINE Login (ต้องตรง Callback URL ใน LINE console
# เป๊ะ และเหมือนกัน "ทุกเครื่อง" ไม่งั้นเครื่องที่เข้าทาง IP/host อื่นจะ login ไม่ได้เฉพาะเครื่องนั้น)
ARG NEXT_PUBLIC_SITE_URL=https://p19arena.p19avenue.com
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_TELEMETRY_DISABLED=1
# build:standalone = next build + คัดลอก .next/static และ public เข้า .next/standalone
RUN npm run build:standalone

# ===== Stage 3: runner (runtime ขนาดเล็ก) =====
FROM node:20-slim AS runner
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
# SQLite DB เก็บที่ /app/db → mount volume เพื่อเก็บข้อมูลถาวร: -v p19-db:/app/db
ENV DATABASE_URL=file:/app/db/data.db
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs
# standalone มี server.js + node_modules จำเป็น + public/ + .next/static ครบแล้ว (จาก build:standalone)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# schema + prisma CLI สำหรับสร้างตารางอัตโนมัติครั้งแรก (db push ตอน start — idempotent)
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
RUN npm i -g prisma@6.19.3 && npm cache clean --force
RUN mkdir -p /app/db && chown nextjs:nodejs /app/db
VOLUME /app/db
USER nextjs
EXPOSE 3000
# Container health monitoring — ตรวจ /api/health (รวม db check) ทุก 30 วิ
# ล้มเหลว 3 ครั้งติด = unhealthy (ดูได้ด้วย docker ps / docker inspect)
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
# สร้าง/อัปเดตตารางก่อนเปิด server (ไม่ลบข้อมูลเดิม) แล้วรัน standalone server
CMD ["sh", "-c", "prisma db push --skip-generate && node server.js"]
