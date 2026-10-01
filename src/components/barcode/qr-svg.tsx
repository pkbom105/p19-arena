'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

/**
 * QR 2D → SVG ผ่านไลบรารี `qrcode` (มีอยู่ในโปรเจกต์แล้ว — ไม่ต้องติดตั้งเพิ่ม)
 * data-slot: qr-image (div ครอบ) — ปรับขนาดด้วย CSS ของผู้เรียกได้
 */
export function QrSvg({
  text,
  level = 'M',
  className,
}: {
  text: string
  level?: 'L' | 'M' | 'Q' | 'H'
  className?: string
}) {
  const [svg, setSvg] = useState('')

  useEffect(() => {
    let alive = true
    QRCode.toString(text || ' ', { type: 'svg', margin: 0, errorCorrectionLevel: level })
      .then((s) => {
        if (!alive) return
        // บังคับให้ SVG ยืดเต็มกล่องแม่ (ไม่พึ่ง CSS จากภายนอก — ใช้ได้ทั้งในแผ่นฉลากและ preview เดี่ยว)
        setSvg(s.replace(/<svg[^>]*>/, (tag) =>
          tag.replace(/width="[^"]*"/, 'width="100%"').replace(/height="[^"]*"/, 'height="100%"')
        ))
      })
      .catch(() => { if (alive) setSvg('') })
    return () => { alive = false }
  }, [text, level])

  if (!svg) return null

  return (
    <div
      data-slot="qr-image"
      className={className}
      // SVG ที่ได้จากไลบรารี qrcode (ไม่มี input จากผู้ใช้ภายนอก) — ปลอดภัยต่อการ inject
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
