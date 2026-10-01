'use client'

import { encodeEan13, modulesToRuns } from '@/lib/ean13'

/** ความสูง (หน่วย viewBox): แท่งข้อมูล / แท่ง guard ที่ยื่นยาวกว่า */
const H_DATA = 56
const H_GUARD = 64
const H_TEXT = 14

/**
 * EAN-13 → SVG (viewBox กว้าง 95 โมดูล ให้ปรับสเกลได้อิสระโดยไม่เพี้ยน)
 * data-slot: ean13-svg / ean13-bar / ean13-digits
 */
export function Ean13Svg({
  code,
  className,
  showDigits = true,
}: {
  code: string
  className?: string
  showDigits?: boolean
}) {
  const bits = encodeEan13(code)
  const runs = modulesToRuns(bits)
  const height = H_GUARD + (showDigits ? H_TEXT : 0)

  return (
    <svg
      data-slot="ean13-svg"
      viewBox={`0 0 ${bits.length} ${height}`}
      preserveAspectRatio="none"
      className={className}
      role="img"
      aria-label={`EAN-13 ${code}`}
    >
      <rect x={0} y={0} width={bits.length} height={height} fill="#fff" />
      {runs.map((r, i) => (
        <rect
          key={i}
          data-slot="ean13-bar"
          x={r.x}
          y={0}
          width={r.width}
          height={r.guard ? H_GUARD : H_DATA}
          fill="#000"
          shapeRendering="crispEdges"
        />
      ))}
      {showDigits && (
        <text
          data-slot="ean13-digits"
          x={bits.length / 2}
          y={H_GUARD + 11}
          textAnchor="middle"
          fontSize={13}
          fontFamily="monospace"
          letterSpacing={1}
          fill="#000"
        >
          {code}
        </text>
      )}
    </svg>
  )
}
