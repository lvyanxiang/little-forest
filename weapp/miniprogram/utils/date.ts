const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
export const MONTH_NAMES = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']

export function startOfToday(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function startOfDay(date: Date | number): number {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function addDays(baseTs: number, n: number): number {
  const d = new Date(baseTs)
  d.setDate(d.getDate() + n)
  return d.getTime()
}

export function diffDays(a: number, b: number): number {
  return Math.round((a - b) / 86400000)
}

export function sameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b)
}

export function formatFullDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

export function formatShortDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

export function formatWeekday(ts: number): string {
  return WEEKDAYS[new Date(ts).getDay()]
}

export function maskPhone(phone: string): string {
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}

export function toDateKey(ts: number): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromDateKey(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

export function weekdayOf(ts: number): number {
  return new Date(ts).getDay()
}
