export type LocationHistoryItem = {
  address: string
  latitude: number
  longitude: number
  at: number
}

const STORAGE_KEY = 'lf_store_location_history'
const MAX_ITEMS = 8

export function loadLocationHistory(): LocationHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const rows = raw ? (JSON.parse(raw) as LocationHistoryItem[]) : []
    return Array.isArray(rows) ? rows : []
  } catch {
    return []
  }
}

export function rememberLocation(item: Omit<LocationHistoryItem, 'at'>) {
  const next: LocationHistoryItem = {
    address: item.address.trim(),
    latitude: Number(item.latitude),
    longitude: Number(item.longitude),
    at: Date.now(),
  }
  const prev = loadLocationHistory().filter(
    (row) =>
      row.address !== next.address ||
      Math.abs(row.latitude - next.latitude) > 0.00001 ||
      Math.abs(row.longitude - next.longitude) > 0.00001,
  )
  const list = [next, ...prev].slice(0, MAX_ITEMS)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  return list
}

export function removeLocationHistory(at: number) {
  const list = loadLocationHistory().filter((row) => row.at !== at)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  return list
}

export function formatHistoryTime(at: number) {
  const d = new Date(at)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${m}-${day} ${h}:${min}`
}
