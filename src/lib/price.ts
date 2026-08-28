export interface PriceRule {
  id: string
  name: string | null
  days: string | null // "0,1,2,3,4,5,6" (0=อาทิตย์..6=เสาร์) ; null/"" = ทุกวัน
  startTime: string // "HH:mm"
  endTime: string // "HH:mm"
  price: number
  sortOrder: number
}

/** Convert "HH:mm" to minutes since midnight. */
export function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** True if a rule applies to the given day. days null/"" = ทุกวัน. */
export function ruleMatchesDay(r: PriceRule, dayOfWeek: number): boolean {
  if (!r.days || r.days.trim() === '') return true
  return r.days
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .some((d) => d === dayOfWeek)
}

/**
 * Find the price that applies to a time slot on a given day.
 * Returns the base price when no rule matches.
 *
 * Matching:
 *  - Rule must cover the slot's startTime (start <= t < end).
 *  - A day-specific rule (has days) beats an all-day rule (days null/"").
 *  - Among equal specificity, the rule with the smallest startTime wins.
 */
export function getSlotPrice(
  basePrice: number,
  dayOfWeek: number,
  startTime: string,
  rules: PriceRule[]
): number {
  const start = toMinutes(startTime)

  const matches = rules.filter((r) => {
    if (!ruleMatchesDay(r, dayOfWeek)) return false
    const rs = toMinutes(r.startTime)
    const re = toMinutes(r.endTime)
    // Ignore empty / overnight-wrapped rules within same storage.
    if (re <= rs) return false
    return start >= rs && start < re
  })

  if (matches.length === 0) return basePrice

  matches.sort((a, b) => {
    const aSpecific = a.days && a.days.trim() !== '' ? 1 : 0
    const bSpecific = b.days && b.days.trim() !== '' ? 1 : 0
    if (bSpecific !== aSpecific) return bSpecific - aSpecific
    return toMinutes(a.startTime) - toMinutes(b.startTime)
  })

  return matches[0].price
}

/** Price of a whole booking item (court + date + slots) using rules. */
export function getItemPriceWithRules(
  item: { date: string; timeSlots: { startTime: string }[]; court: { pricePerHour: number } },
  rules: PriceRule[]
): number {
  const dayOfWeek = new Date(item.date + 'T00:00:00').getDay()
  return item.timeSlots.reduce(
    (sum, ts) => sum + getSlotPrice(item.court.pricePerHour, dayOfWeek, ts.startTime, rules),
    0
  )
}