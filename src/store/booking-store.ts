import { create } from 'zustand'

export interface Court {
  id: string
  name: string
  description: string | null
  pricePerHour: number
  isActive: boolean
  sortOrder: number
}

export interface TimeSlot {
  id: string
  startTime: string
  endTime: string
  dayOfWeek: number
  isActive: boolean
  sortOrder: number
}

export interface RentalItem {
  id: string
  name: string
  nameEn: string | null
  pricePerUnit: number
  quantity: number
}

export interface PriceRule {
  id: string
  name: string | null
  days: string | null // "0,1,2,3,4,5,6" (0=อาทิตย์..6=เสาร์) ; null/"" = ทุกวัน
  startTime: string
  endTime: string
  price: number
  sortOrder: number
}

export interface BookingItem {
  id: string
  date: string
  court: Court
  timeSlots: TimeSlot[]
}

export interface BookingData {
  courtId: string
  bookingDate: string
  playerName: string
  playerPhone: string
  playerEmail: string
  note: string
}

export interface LineUser {
  id: string
  lineUserId: string
  lineDisplayName: string | null
  linePictureUrl: string | null
  name: string | null
  phone: string | null
  email: string | null
}

export interface PaymentSlip {
  dataUrl: string
  name: string
  size: number
}

/** โค้ชที่เลือกมาจากหน้า /activity/coach (?coach= → sessionStorage) — คิดเงินรวมกับค่าสนาม */
export interface CoachSelection {
  id: string
  name: string
  pricePerHour: number
}

interface BookingStore {
  step: number
  setStep: (step: number) => void
  goToStep: (targetStep: number) => void

  courts: Court[]
  setCourts: (courts: Court[]) => void

  timeSlots: TimeSlot[]
  setTimeSlots: (slots: TimeSlot[]) => void

  selectedDate: string
  setSelectedDate: (date: string) => void

  /** ช่องที่เลือกในกริด "สนาม × เวลา" (หน้าเดียวจบ) — key รูปแบบ `${courtId}|${slotId}` */
  selectedCells: string[]
  toggleCell: (key: string) => void
  clearCells: () => void

  bookingItems: BookingItem[]
  addBookingItems: (items: Omit<BookingItem, 'id'>[]) => void
  removeBookingItem: (itemId: string) => void
  clearAllBookingItems: () => void

  rentalSelections: RentalItem[]
  setRentalSelections: (items: RentalItem[]) => void
  updateRentalQuantity: (itemId: string, quantity: number) => void

  priceRules: PriceRule[]
  setPriceRules: (rules: PriceRule[]) => void

  bookingForm: BookingData
  setBookingForm: (data: Partial<BookingData>) => void
  resetBookingForm: () => void

  lineUser: LineUser | null
  setLineUser: (user: LineUser | null) => void

  slip: PaymentSlip | null
  setSlip: (slip: PaymentSlip | null) => void

  coach: CoachSelection | null
  setCoach: (coach: CoachSelection | null) => void

  /** จำนวนชั่วโมงที่ผู้ใช้กำหนดให้โค้ชดูแล (ติ๊กจากขั้นสรุปการจอง) */
  coachHours: number
  setCoachHours: (value: number | ((prev: number) => number)) => void

  /** ช่องเวลาที่ติ๊กให้โค้ชดูแล รูปแบบ `${itemId}|${slotId}` — ส่งต่อให้ API คิดค่าโค้ชเฉพาะชั่วโมงที่ติ๊ก */
  coachTickedKeys: string[]
  setCoachTickedKeys: (value: string[] | ((prev: string[]) => string[])) => void

  submittedBookings: unknown[]
  setSubmittedBookings: (bookings: unknown[]) => void

  isLoading: boolean
  setIsLoading: (loading: boolean) => void

  lookupPhone: string
  setLookupPhone: (phone: string) => void

  lineLoginSkipped: boolean
  setLineLoginSkipped: (skipped: boolean) => void
}

const initialForm: BookingData = {
  courtId: '',
  bookingDate: '',
  playerName: '',
  playerPhone: '',
  playerEmail: '',
  note: '',
}

export const useBookingStore = create<BookingStore>((set, get) => ({
  step: 1,
  setStep: (step) => set({ step }),

  /** Navigate to a previous step, clearing current selection but never bookingItems */
  goToStep: (targetStep: number) => {
    const current = get().step
    if (targetStep >= current) return

    const clear: Record<string, unknown> = { step: targetStep }

    // Clear current selection (date/grid cells) when going back
    // Never clear bookingItems or rentalSelections - those are preserved across "จองเพิ่ม" cycles
    if (targetStep <= 1) {
      clear.selectedDate = ''
      clear.selectedCells = []
      clear.lineLoginSkipped = false
    }
    if (targetStep <= 2) {
      // กลับมาที่กริด (สนาม+เวลา หน้าเดียว) — คง selectedDate ไว้เพื่อเลือกเพิ่มต่อได้ทันที
      clear.selectedCells = []
    }
    set(clear)
  },

  courts: [],
  setCourts: (courts) => set({ courts }),

  timeSlots: [],
  setTimeSlots: (timeSlots) => set({ timeSlots }),

  selectedDate: '',
  setSelectedDate: (selectedDate) => set({ selectedDate }),

  selectedCells: [],
  toggleCell: (key) =>
    set((state) => ({
      selectedCells: state.selectedCells.includes(key)
        ? state.selectedCells.filter((k) => k !== key)
        : [...state.selectedCells, key],
    })),
  clearCells: () => set({ selectedCells: [] }),

  bookingItems: [],

  /** เพิ่มรายการจองจากกริด (จัดกลุ่มตามสนามแล้ว) และล้างช่องที่เลือก */
  addBookingItems: (items) =>
    set((state) => ({
      bookingItems: [
        ...state.bookingItems,
        ...items.map((item) => ({ ...item, id: crypto.randomUUID() })),
      ],
      selectedCells: [],
    })),

  removeBookingItem: (itemId) =>
    set((state) => ({
      bookingItems: state.bookingItems.filter((item) => item.id !== itemId),
    })),

  clearAllBookingItems: () =>
    set({ bookingItems: [], rentalSelections: [], slip: null, coachHours: 0, coachTickedKeys: [] }),

  rentalSelections: [],
  setRentalSelections: (rentalSelections) => set({ rentalSelections }),
  updateRentalQuantity: (itemId, quantity) =>
    set((state) => ({
      rentalSelections: state.rentalSelections.map((r) =>
        r.id === itemId ? { ...r, quantity: Math.max(0, quantity) } : r
      ),
    })),

  priceRules: [],
  setPriceRules: (priceRules) => set({ priceRules }),

  bookingForm: { ...initialForm },
  setBookingForm: (data) =>
    set((state) => ({ bookingForm: { ...state.bookingForm, ...data } })),
  resetBookingForm: () => set({ bookingForm: { ...initialForm } }),

  lineUser: null,
  setLineUser: (lineUser) => set({ lineUser }),

  slip: null,
  setSlip: (slip) => set({ slip }),

  coach: null,
  setCoach: (coach) => set({ coach }),

  coachHours: 0,
  setCoachHours: (value) =>
    set((state) => ({ coachHours: typeof value === 'function' ? value(state.coachHours) : value })),

  coachTickedKeys: [],
  setCoachTickedKeys: (value) =>
    set((state) => ({
      coachTickedKeys: typeof value === 'function' ? value(state.coachTickedKeys) : value,
    })),

  submittedBookings: [],
  setSubmittedBookings: (submittedBookings) => set({ submittedBookings }),

  isLoading: false,
  setIsLoading: (isLoading) => set({ isLoading }),

  lookupPhone: '',
  setLookupPhone: (lookupPhone) => set({ lookupPhone }),

  lineLoginSkipped: false,
  setLineLoginSkipped: (lineLoginSkipped) => set({ lineLoginSkipped }),
}))
