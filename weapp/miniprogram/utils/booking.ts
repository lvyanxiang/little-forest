import { ensureWechatLogin } from './auth'
import { getSession } from './session'
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
let cachedUserId: string | null = null

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
  const session = getSession()
  if (!session) { cachedBookings = []; cachedUserId = null; return cachedBookings }
  try {
    const rows = await request<ApiBooking[]>('/bookings', 'GET', undefined, true)
    if (getSession()?.token !== session.token) throw new Error('登录状态已变化，请重试')
    cachedUserId = session.user.id
    cachedBookings = rows.map(toBooking)
    return cachedBookings
  } catch (error) {
    if (getSession()?.token === session.token || !getSession()) { cachedBookings = []; cachedUserId = null }
    throw error
  }
}

export async function createBooking(input: {
  visitDate: string
  slotId: number
  name: string
  phone: string
  people?: number
}) {
  const session = await ensureWechatLogin()
  if (getSession()?.token !== session.token) throw new Error('登录状态已变化，请重试')
  const row = await request<ApiBooking>('/bookings', 'POST', {
    visitDate: input.visitDate,
    slotId: input.slotId,
    name: input.name,
    phone: input.phone,
    people: input.people ?? 1,
  }, true)
  if (getSession()?.token !== session.token) throw new Error('登录状态已变化，请重试')
  const booking = toBooking(row)
  cachedBookings = [booking, ...getBookings().filter((item) => item.id !== booking.id)]
  cachedUserId = session.user.id
  return booking
}

export async function cancelBooking(id: string) {
  const session = getSession()
  const row = await request<ApiBooking>(`/bookings/${id}/cancel`, 'POST', undefined, true)
  if (getSession()?.token !== session?.token) throw new Error('登录状态已变化，请重试')
  const booking = toBooking(row)
  cachedBookings = getBookings().map((item) => (item.id === id ? booking : item))
  return booking
}

export function getBookings() {
  const userId = getSession()?.user.id || null
  if (!userId || userId !== cachedUserId) { cachedBookings = []; cachedUserId = userId }
  return cachedBookings
}

export function getUpcomingCount() {
  const today = startOfToday()
  return getBookings().filter((item) => item.status === 'confirmed' && item.dateTs >= today).length
}

export function getConfirmedCount() {
  return getBookings().filter((item) => item.status === 'confirmed').length
}
