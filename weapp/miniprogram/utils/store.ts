import { request } from './request'
import { resolveApiAsset } from './config'

export interface StoreInfo {
  name: string
  address: string
  closedWeekdays: number[]
  noticeHeading: string
  noticeItems: string[]
  noticeFoot: string
  homeHeroText: string
  homeHeroImageUrl: string
  brandLogoUrl: string
  successNoticeLines: string[]
  quickDateDays: number
  bookingAdvanceDays: number
  uiText: Record<string, string>
}

// Only an empty loading state; business values must originate from the server.
export function createEmptyStore(): StoreInfo {
  return { name: '', address: '', closedWeekdays: [], noticeHeading: '', noticeItems: [], noticeFoot: '', homeHeroText: '', homeHeroImageUrl: '', brandLogoUrl: '', successNoticeLines: [], quickDateDays: 0, bookingAdvanceDays: 0, uiText: {} }
}

let cached: StoreInfo | null = null
let pending: Promise<StoreInfo> | null = null

export function getStore() { return cached }

export function fetchStore(): Promise<StoreInfo> {
  if (pending) return pending
  const task = request<StoreInfo>('/store').then((store) => {
    if (!store || !store.uiText || !store.name || !Number.isInteger(store.quickDateDays) || store.quickDateDays < 1 || !Number.isInteger(store.bookingAdvanceDays) || store.bookingAdvanceDays < 1 || store.quickDateDays > store.bookingAdvanceDays + 1 || !Array.isArray(store.noticeItems) || !Array.isArray(store.closedWeekdays)) throw new Error('门店配置尚未准备好，请稍后重试')
    store.homeHeroImageUrl = resolveApiAsset(store.homeHeroImageUrl)
    store.brandLogoUrl = resolveApiAsset(store.brandLogoUrl)
    cached = store
    return store
  }).finally(() => { if (pending === task) pending = null })
  pending = task
  return task
}
