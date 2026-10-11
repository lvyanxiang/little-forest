export type StorePayload = {
  id: number
  address: string
  closedWeekdays: number[]
  noticeHeading: string
  noticeItems: string[]
  noticeFoot: string
  homeHeroText: string
  homeHeroImageUrl: string
  successNoticeLines: string[]
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

export type AdminUser = { email: string; expiresAt: string }

const TOKEN_KEY = 'little-forest-admin-token'
export const AUTH_EXPIRED_EVENT = 'little-forest-auth-expired'

export function getAdminToken() {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function clearAdminToken() {
  sessionStorage.removeItem(TOKEN_KEY)
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (!(init?.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  const token = getAdminToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(path, {
    ...init,
    headers,
  })
  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    throw new Error('服务暂时不可用，请稍后重试')
  }
  if (!res.ok) {
    if (res.status === 401 && path !== '/api/auth/login') {
      clearAdminToken()
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
    }
    const message = Array.isArray(data?.message) ? data.message[0] : data?.message
    throw new Error(message || `请求失败 ${res.status}`)
  }
  return data as T
}

export const api = {
  login: async (email: string, password: string): Promise<AdminUser> => {
    const result = await request<AdminUser & { token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    sessionStorage.setItem(TOKEN_KEY, result.token)
    return { email: result.email, expiresAt: result.expiresAt }
  },
  me: () => request<AdminUser>('/api/auth/me'),
  logout: async () => {
    await request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' })
    clearAdminToken()
  },
  health: () => request<{ ok: boolean }>('/api/health'),
  getStore: () => request<StorePayload>('/api/admin/store'),
  saveStore: (body: Partial<StorePayload>) =>
    request<StorePayload>('/api/admin/store', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  uploadHomeImage: async (file: File) => {
    const body = new FormData()
    body.append('image', file)
    return request<StorePayload>('/api/admin/store/home-image', { method: 'POST', body })
  },
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
