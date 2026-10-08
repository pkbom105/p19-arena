import type { NextConfig } from "next";

// basePath ของแอป — ตั้งผ่าน NEXT_PUBLIC_BASE_PATH (เช่น '/p19arena' สำหรับ https://p19avenue.com/p19arena)
// client-side ต้องใช้ apiUrl()/BASE_PATH จาก src/lib/api.ts คู่กัน
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

// บน Vercel ต้องไม่ใช้ output: 'standalone'
// (Next 16.3 ไม่ emit .next/next-server.js.nft.json เมื่อ standalone แต่ Vercel ยังต้องใช้ไฟล์นี้
//  ทำให้เกิด ENOENT ตอน build — ดู https://github.com/vercel/next.js/issues/96646)
// ใช้ standalone เฉพาะตอน self-host / Docker (รัน build:standalone)
const nextConfig: NextConfig = {
  ...(basePath ? { basePath } : {}),
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  // ให้ standalone มี Prisma client + engine ครบ (ใช้โดย /api/** และ /ticket/[id])
  outputFileTracingIncludes: {
    "/api/**": ["./node_modules/.prisma/client/**"],
    "/ticket/[id]": ["./node_modules/.prisma/client/**"],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // URL เก่า → ใหม่ (กันลิงก์/bookmark เก่าเจอ 404)
  async redirects() {
    return [
      {
        source: "/dashboard/pos",
        destination: "/dashboard/shop/pos-booking",
        permanent: false,
      },
      {
        source: "/dashboard/pos-booking",
        destination: "/dashboard/shop/pos-booking",
        permanent: false,
      },
      {
        source: "/dashboard/pos-shop",
        destination: "/dashboard/shop/pos-shop",
        permanent: false,
      },
      {
        source: "/dashboard/shop-report",
        destination: "/dashboard/shop/shop-report",
        permanent: false,
      },
      // หน้า /activity ย้ายเป็นพื้นที่สมาชิก /member (sub menu: Profile / กิจกรรม / โค้ช) — ลิงก์/QR เก่าไม่พัง
      { source: "/activity", destination: "/member", permanent: false },
      { source: "/activity/coach", destination: "/member/coach", permanent: false },
      { source: "/activity/activities", destination: "/member/activities", permanent: false },
      {
        source: "/activity/activities/party-match",
        destination: "/member/activities/party-match",
        permanent: false,
      },
      { source: "/activity/member", destination: "/member", permanent: false },
    ];
  },
  reactStrictMode: false,
};

export default nextConfig;
