'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Camera, ScanLine, Loader2, X, CameraOff, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * แยกเอารหัสตั๋ว 8 หลักจากข้อความที่สแกนมาจาก QR
 * QR ของตั๋วมีข้อความ "รหัสจอง: XXXXXXXX" — รองรับทั้งรูปแบบตรง ๆ
 * และ fallback ให้จับ token 8 ตัวอักษร/เลขตัวแรก
 */
export function parseTicketCodeFromText(text: string): string | null {
  const explicit = text.match(/รหัสจอง[:：]\s*([A-Z0-9]{8})/i)
  if (explicit) return explicit[1].toUpperCase()
  const fallback = text.match(/\b([A-Z][A-Z0-9]{7})\b/i)
  if (fallback) return fallback[1].toUpperCase()
  return null
}

export function TicketQrScanner({
  onScan,
}: {
  /** เรียกเมื่อสแกนได้รหัสตั๋วแล้ว — ส่งรหัส 8 หลักตัวพิมพ์ใหญ่ */
  onScan: (code: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [starting, setStarting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [found, setFound] = useState(false)
  const viewerId = useMemo(
    () => `qr-scanner-${Math.random().toString(36).slice(2)}`,
    []
  )
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const stopRequested = useRef(false)
  const onScanRef = useRef(onScan)

  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

  const stopScanner = async () => {
    stopRequested.current = true
    const s = scannerRef.current
    scannerRef.current = null
    try {
      if (s) {
        if (s.isScanning) await s.stop()
        s.clear()
      }
    } catch {
      // ignore
    }
  }

  const startScanner = async () => {
    stopRequested.current = false
    setErrorMsg(null)
    setFound(false)
    setStarting(true)
    try {
      const scanner = new Html5Qrcode(viewerId, { verbose: false })
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => {
          if (stopRequested.current) return
          const code = parseTicketCodeFromText(decodedText)
          if (!code) return
          setFound(true)
          onScanRef.current(code)
          stopScanner()
          setOpen(false)
        },
        () => {
          // ignore per-frame failures
        }
      )
    } catch (err) {
      const e = err as Error
      if (/NotAllowedError|Permission/i.test(e?.message || '')) {
        setErrorMsg('ไม่ได้รับอนุญาตให้ใช้กล้อง — กรุณาอนุญาตกล้องในเบราว์เซอร์')
      } else if (/NotFoundError|no camera/i.test(e?.message || '')) {
        setErrorMsg('ไม่พบกล้องบนอุปกรณ์นี้')
      } else {
        setErrorMsg('ไม่สามารถเปิดกล้องได้ กรุณาลองใหม่อีกครั้ง')
      }
    } finally {
      setStarting(false)
    }
  }

  const handleOpen = async () => {
    setOpen(true)
    // รอให้ DOM ของ view render เสร็จก่อนสั่ง start
    setTimeout(() => {
      startScanner()
    }, 50)
  }

  const handleClose = async () => {
    await stopScanner()
    setOpen(false)
    setErrorMsg(null)
    setFound(false)
  }

  useEffect(() => {
    return () => {
      // cleanup ตอน unmount — ปิดกล้องเสมอ
      stopRequested.current = true
      const s = scannerRef.current
      scannerRef.current = null
      if (s && typeof s.stop === 'function') {
        s.stop().catch(() => {}).then(() => { try { s.clear() } catch { /* ignore */ } })
      }
    }
  }, [])

  return (
    <>
      <Button
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
        onClick={handleOpen}
      >
        <Camera className="h-4 w-4 mr-2" />
        สแกน QR ด้วยกล้อง
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
          <div className="flex items-center justify-between p-4 text-white">
            <div className="flex items-center gap-2 font-medium">
              <ScanLine className="h-5 w-5" />
              สแกน QR รหัสตั๋ว
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20"
              aria-label="ปิด"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8">
            {starting && (
              <div className="text-white/80 flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm">กำลังเปิดกล้อง...</p>
              </div>
            )}

            {errorMsg && (
              <div className="flex flex-col items-center gap-3 text-center text-white/90">
                <CameraOff className="h-10 w-10 text-red-300" />
                <p className="text-sm max-w-xs">{errorMsg}</p>
                <p className="text-xs text-white/60 max-w-xs">
                  Android/iPhone: กดที่ไอคอนกล้องในแถบที่อยู่ แล้วเลือก "อนุญาต" เพื่อให้ใช้กล้องได้
                </p>
                <Button variant="outline" className="border-white/30 text-white" onClick={handleClose}>
                  ปิด
                </Button>
              </div>
            )}

            {found && (
              <div className="flex flex-col items-center gap-2 text-emerald-300">
                <CheckCircle2 className="h-10 w-10" />
                <p className="text-sm">สแกนสำเร็จ! กำลังค้นหาการจอง...</p>
              </div>
            )}

            {!starting && !errorMsg && !found && (
              <>
                <div id={viewerId} className="w-64 sm:w-72 aspect-square" />
                <p className="mt-4 text-center text-xs text-white/70 max-w-xs">
                  นำ QR บนตั๋วมาไว้ในกรอบ — เมื่อเจอ จะค้นหาการจองให้อัตโนมัติ
                </p>
                <p className="mt-2 text-center text-[11px] text-white/50 max-w-xs">
                  ครั้งแรก เบราว์เซอร์จะถามขออนุญาตใช้กล้อง — กด "อนุญาต/Allow"
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
