import { getClientId } from './client'
import { fromDateKey, startOfToday } from './date'
import { request } from './request'

export type BookingStatus = 'confirmed' | 'cancelled'

export interface ApiSlot {
  id: number
  startTime: string
  endTime: string
  label: string
  max: number
  booked: number
  avail: number
  isFull: boolean
  isPast: boolean
}

export interface SlotDay {
  date: string
  closed: boolean
  slots: ApiSlot[]
}

export interface Booking {
  id: string
  date: string
  dateTs: number
  slotId: number
  slot: string
  people: number
  name: string
  phone: string
  status: BookingStatus
}

type ApiBooking = {
  id: string
  date: string
  slotId: number
  slotLabel: string
  people: number
  name: string
  phone: string
  status: BookingStatus
}

let cachedBookings: Booking[] = []

function toBooking(row: ApiBooking): Booking {
  return {
    id: row.id,
    date: row.date,
    dateTs: fromDateKey(row.date),
    slotId: row.slotId,
    slot: row.slotLabel,
    people: row.people,
    name: row.name,
    phone: row.phone,
    status: row.status,
  }
}

export async function fetchSlots(date: string) {
  return request<SlotDay>(`/slots?date=${encodeURIComponent(date)}`)
}

export async function fetchMyBookings() {
  const rows = await request<ApiBooking[]>(`/bookings?clientId=${encodeURIComponent(getClientId())}`)
  cachedBookings = rows.map(toBooking)
  return cachedBookings
}

export async function createBooking(input: {
  visitDate: string
  slotId: number
  name: string
  phone: string
  people?: number
}) {
  const row = await request<ApiBooking>('/bookings', 'POST', {
    clientId: getClientId(),
    visitDate: input.visitDate,
    slotId: input.slotId,
    name: input.name,
    phone: input.phone,
    people: input.people ?? 1,
  })
  const booking = toBooking(row)
  cachedBookings = [booking, ...cachedBookings.filter((item) => item.id !== booking.id)]
  return booking
}

export async function cancelBooking(id: string) {
  const row = await request<ApiBooking>(`/bookings/${id}/cancel`, 'POST', {
    clientId: getClientId(),
  })
  const booking = toBooking(row)
  cachedBookings = cachedBookings.map((item) => (item.id === id ? booking : item))
  return booking
}

export function getBookings() {
  return cachedBookings
}

export function getUpcomingCount() {
  const today = startOfToday()
  return cachedBookings.filter((item) => item.status === 'confirmed' && item.dateTs >= today).length
}

export function getConfirmedCount() {
  return cachedBookings.filter((item) => item.status === 'confirmed').length
}
