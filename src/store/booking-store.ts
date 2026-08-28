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

interface BookingStore {
  step: number
  setStep: (step: number) => void
  goToStep: (targetStep: number) => void

  courts: Court[]
  setCourts: (courts: Court[]) => void

  timeSlots: TimeSlot[]
  setTimeSlots: (slots: TimeSlot[]) => void

  bookedSlots: string[]
  setBookedSlots: (slots: string[]) => void

  selectedDate: string
  setSelectedDate: (date: string) => void

  selectedCourt: Court | null
  setSelectedCourt: (court: Court | null) => void

  selectedTimeSlots: TimeSlot[]
  toggleTimeSlot: (slot: TimeSlot) => void
  clearTimeSlots: () => void

  bookingItems: BookingItem[]
  addBookingItem: () => void
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

    // Clear current selection (date/court/slots) when going back
    // Never clear bookingItems or rentalSelections - those are preserved across "จองเพิ่ม" cycles
    if (targetStep <= 1) {
      clear.selectedDate = ''
      clear.selectedCourt = null
      clear.selectedTimeSlots = []
      clear.lineLoginSkipped = false
    }
    if (targetStep <= 2) {
      clear.selectedCourt = null
      clear.selectedTimeSlots = []
    }
    if (targetStep <= 3) {
      clear.selectedTimeSlots = []
    }
    set(clear)
  },

  courts: [],
  setCourts: (courts) => set({ courts }),

  timeSlots: [],
  setTimeSlots: (timeSlots) => set({ timeSlots }),

  bookedSlots: [],
  setBookedSlots: (bookedSlots) => set({ bookedSlots }),

  selectedDate: '',
  setSelectedDate: (selectedDate) => set({ selectedDate }),

  selectedCourt: null,
  setSelectedCourt: (selectedCourt) => set({ selectedCourt }),

  selectedTimeSlots: [],
  toggleTimeSlot: (slot) =>
    set((state) => {
      const exists = state.selectedTimeSlots.some((s) => s.id === slot.id)
      if (exists) {
        return { selectedTimeSlots: state.selectedTimeSlots.filter((s) => s.id !== slot.id) }
      }
      return { selectedTimeSlots: [...state.selectedTimeSlots, slot] }
    }),
  clearTimeSlots: () => set({ selectedTimeSlots: [] }),

  bookingItems: [],

  /** Save current selection as a booking item and clear current selection */
  addBookingItem: () => {
    const { selectedDate, selectedCourt, selectedTimeSlots, bookingItems } = get()
    if (selectedDate && selectedCourt && selectedTimeSlots.length > 0) {
      set({
        bookingItems: [
          ...bookingItems,
          {
            id: crypto.randomUUID(),
            date: selectedDate,
            court: selectedCourt,
            timeSlots: [...selectedTimeSlots],
          },
        ],
        selectedCourt: null,
        selectedTimeSlots: [],
        // Keep selectedDate so user can book another court for same date
      })
    }
  },

  removeBookingItem: (itemId) =>
    set((state) => ({
      bookingItems: state.bookingItems.filter((item) => item.id !== itemId),
    })),

  clearAllBookingItems: () => set({ bookingItems: [], rentalSelections: [], slip: null }),

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

  submittedBookings: [],
  setSubmittedBookings: (submittedBookings) => set({ submittedBookings }),

  isLoading: false,
  setIsLoading: (isLoading) => set({ isLoading }),

  lookupPhone: '',
  setLookupPhone: (lookupPhone) => set({ lookupPhone }),

  lineLoginSkipped: false,
  setLineLoginSkipped: (lineLoginSkipped) => set({ lineLoginSkipped }),
}))
