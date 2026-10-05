const STORAGE_KEY = 'forest_client_id'

function createId() {
  return `lf_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

export function getClientId() {
  try {
    const saved = wx.getStorageSync(STORAGE_KEY)
    if (typeof saved === 'string' && saved.length >= 8) return saved
  } catch {
    // ignore
  }
  const next = createId()
  wx.setStorageSync(STORAGE_KEY, next)
  return next
}
