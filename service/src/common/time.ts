export function formatSlotLabel(startTime: string, endTime: string) {
  return `${startTime} – ${endTime}`;
}

export function isValidTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function timeToMinutes(value: string) {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

export function toDateKey(ts: number) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayKey() {
  return toDateKey(Date.now());
}

export function isSlotPast(dateKey: string, startTime: string, now = Date.now()) {
  const today = toDateKey(now);
  if (dateKey < today) return true;
  if (dateKey > today) return false;
  const current = new Date(now);
  return current.getHours() * 60 + current.getMinutes() >= timeToMinutes(startTime);
}

export function weekdayOf(dateKey: string) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

export function formatPhoneDisplay(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  return phone;
}
