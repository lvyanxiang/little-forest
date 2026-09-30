import { diffDays, startOfToday } from './date'

export const STORE_HOURS = [
  { id: 1, label: '09:00 – 10:30', max: 8 },
  { id: 2, label: '10:30 – 12:00', max: 8 },
  { id: 3, label: '13:00 – 14:30', max: 10 },
  { id: 4, label: '14:30 – 16:00', max: 10 },
  { id: 5, label: '16:00 – 17:30', max: 8 },
  { id: 6, label: '17:30 – 19:00', max: 6 },
]

const BOOKED_SEED: Record<string, Record<number, number>> = {
  '0': { 1: 6, 2: 8, 3: 3, 4: 7, 5: 2, 6: 1 },
  '1': { 1: 2, 2: 4, 3: 8, 4: 5, 5: 0, 6: 3 },
  '2': { 1: 0, 2: 1, 3: 2, 4: 3, 5: 0, 6: 0 },
  '3': { 1: 3, 2: 6, 3: 4, 4: 8, 5: 5, 6: 2 },
  '4': { 1: 7, 2: 8, 3: 9, 4: 6, 5: 4, 6: 1 },
  '5': { 1: 1, 2: 3, 3: 5, 4: 2, 5: 1, 6: 0 },
  '6': { 1: 4, 2: 5, 3: 7, 4: 8, 5: 3, 6: 2 },
}

export type BookingStatus = 'confirmed' | 'cancelled'

export interface Booking {
  id: string
  dateTs: number
  slotId: number
  slot: string
  people: number
  name: string
  phone: string
  status: BookingStatus
}

const STORAGE_KEY = 'forest_bookings'

export function getBookings(): Booking[] {
  try {
    const raw = wx.getStorageSync(STORAGE_KEY)
    return Array.isArray(raw) ? raw as Booking[] : []
  } catch {
    return []
  }
}

export function addBooking(booking: Booking): void {
  const list = getBookings()
  list.push(booking)
  wx.setStorageSync(STORAGE_KEY, list)
}

export function cancelBooking(id: string): void {
  const list = getBookings().map((item) => (
    item.id === id ? { ...item, status: 'cancelled' as const } : item
  ))
  wx.setStorageSync(STORAGE_KEY, list)
}

export function getUpcomingCount(): number {
  const today = startOfToday()
  return getBookings().filter((item) => item.status === 'confirmed' && item.dateTs >= today).length
}

export function getConfirmedCount(): number {
  return getBookings().filter((item) => item.status === 'confirmed').length
}

export function getBookedCount(dateTs: number, slotId: number): number {
  const offset = diffDays(dateTs, startOfToday())
  const key = String(((offset % 7) + 7) % 7)
  const seed = (BOOKED_SEED[key] && BOOKED_SEED[key][slotId]) || 0
  const extra = getBookings()
    .filter((item) => item.status === 'confirmed' && item.dateTs === dateTs && item.slotId === slotId)
    .reduce((sum, item) => sum + item.people, 0)
  return seed + extra
}

export function getSlotAvailability(dateTs: number, slotId: number, max: number) {
  const bookedRaw = getBookedCount(dateTs, slotId)
  const booked = Math.min(bookedRaw, max)
  const avail = Math.max(0, max - bookedRaw)
  const fillPct = Math.max(0, Math.min(100, (booked / max) * 100))
  return { booked, avail, isFull: avail <= 0, fillPct }
}
