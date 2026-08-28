import type { NextConfig } from "next";

// บน Vercel ต้องไม่ใช้ output: 'standalone'
// (Next 16.3 ไม่ emit .next/next-server.js.nft.json เมื่อ standalone แต่ Vercel ยังต้องใช้ไฟล์นี้
//  ทำให้เกิด ENOENT ตอน build — ดู https://github.com/vercel/next.js/issues/96646)
// ใช้ standalone เฉพาะตอน self-host (รัน build:standalone)
const nextConfig: NextConfig = {
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
