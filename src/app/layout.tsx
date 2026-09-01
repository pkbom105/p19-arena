import type { Metadata } from "next";
import { Noto_Sans_Thai, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const notoThai = Noto_Sans_Thai({
  variable: "--font-noto-sans-thai",
  subsets: ["latin", "thai"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "P19 Pickleball Arena — จองสนาม",
  description: "ระบบจองสนาม Pickleball ออนไลน์ P19 Pickleball Arena",
  keywords: ["P19", "Pickleball", "Arena", "จองสนาม", "พิคเคิลบอล"],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body
        className={`${notoThai.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
