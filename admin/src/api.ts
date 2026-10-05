export type StorePayload = {
  id: number
  name: string
  address: string
  latitude: number
  longitude: number
  phone: string
  phoneDisplay: string
  hours: string
  closedWeekdays: number[]
  noticeHeading: string
  noticeItems: string[]
  noticeFoot: string
  homeNoticeText: string
  successNoticeLines: string[]
  geocodeStatus?: 'updated' | 'unchanged' | 'skipped' | 'failed'
}

export type SlotPayload = {
  id: number
  startTime: string
  endTime: string
  maxCapacity: number
  sortOrder: number
  isActive: boolean
}

export type BookingPayload = {
  id: string
  date: string
  slotId: number
  slotLabel: string
  startTime: string
  endTime: string
  name: string
  phone: string
  people: number
  status: 'confirmed' | 'cancelled'
  createdAt: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) {
    const message = Array.isArray(data?.message) ? data.message[0] : data?.message
    throw new Error(message || `请求失败 ${res.status}`)
  }
  return data as T
}

export const api = {
  health: () => request<{ ok: boolean }>('/api/health'),
  getStore: () => request<StorePayload>('/api/admin/store'),
  saveStore: (body: Partial<StorePayload>) =>
    request<StorePayload>('/api/admin/store', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  geocodeAddress: (address: string) =>
    request<{ latitude: number; longitude: number }>(
      `/api/admin/store/geocode?address=${encodeURIComponent(address)}`,
    ),
  reverseGeocode: (latitude: number, longitude: number) =>
    request<{ address: string }>(
      `/api/admin/store/reverse-geocode?latitude=${encodeURIComponent(String(latitude))}&longitude=${encodeURIComponent(String(longitude))}`,
    ),
  listSlots: () => request<SlotPayload[]>('/api/admin/slots'),
  createSlot: (body: Partial<SlotPayload>) =>
    request<SlotPayload>('/api/admin/slots', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateSlot: (id: number, body: Partial<SlotPayload>) =>
    request<SlotPayload>(`/api/admin/slots/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  reorderSlots: (ids: number[]) =>
    request<SlotPayload[]>('/api/admin/slots/reorder', {
      method: 'PATCH',
      body: JSON.stringify({ ids }),
    }),
  removeSlot: (id: number) =>
    request<SlotPayload>(`/api/admin/slots/${id}`, { method: 'DELETE' }),
  listBookings: (date?: string) =>
    request<BookingPayload[]>(
      date ? `/api/admin/bookings?date=${encodeURIComponent(date)}` : '/api/admin/bookings',
    ),
}
