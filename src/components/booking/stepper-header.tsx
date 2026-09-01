'use client'

import { Check } from 'lucide-react'
import { useBookingStore } from '@/store/booking-store'

const STEPS = [
  { label: 'เข้าสู่ระบบ LINE', short: 'LINE' },
  { label: 'เลือกวัน', short: 'วัน' },
  { label: 'เลือกสนาม', short: 'สนาม' },
  { label: 'เลือกเวลา', short: 'เวลา' },
  { label: 'สรุปรายการ', short: 'สรุป' },
  { label: 'ยืนยันการจอง', short: 'ยืนยัน' },
]

export function StepperHeader() {
  const { step, goToStep } = useBookingStore()
  const currentStep = Math.min(step, 6)

  const handleClick = (targetStep: number) => {
    if (targetStep >= currentStep) return
    goToStep(targetStep)
  }

  const canClick = (stepNum: number) => {
    return stepNum < currentStep
  }

  return (
    <div className="flex items-center justify-between px-2 py-3">
      {STEPS.map((s, i) => {
        const stepNum = i + 1
        const isCompleted = currentStep > stepNum
        const isCurrent = currentStep === stepNum
        const clickable = canClick(stepNum)

        return (
          <div key={i} className="flex items-center">
            <button
              type="button"
              className="flex flex-col items-center focus:outline-none"
              onClick={() => handleClick(stepNum)}
              disabled={!clickable}
              aria-label={s.label}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                  isCompleted && clickable
                    ? 'bg-emerald-500 text-white cursor-pointer hover:bg-emerald-600 hover:scale-110 active:scale-95'
                    : isCompleted
                    ? 'bg-emerald-500 text-white'
                    : isCurrent
                    ? 'bg-emerald-500 text-white ring-4 ring-emerald-100'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : stepNum}
              </div>
              <span
                className={`text-[11px] mt-1.5 font-medium ${
                  isCurrent
                    ? 'text-emerald-600'
                    : isCompleted && clickable
                    ? 'text-emerald-600 cursor-pointer hover:underline'
                    : isCompleted
                    ? 'text-emerald-600'
                    : 'text-muted-foreground'
                }`}
              >
                {s.short}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <div
                className={`w-6 sm:w-8 lg:w-10 h-0.5 mx-0.5 sm:mx-1 mb-4 transition-all ${
                  isCompleted ? 'bg-emerald-500' : 'bg-muted'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
