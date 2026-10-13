export interface WechatProfile {
  id: string
  nickname: string
  isDefaultNickname?: boolean
  hasAvatar: boolean
  updatedAt: string
  avatarUrl?: string
  avatarLoadFailed?: boolean
}

export interface WechatSession {
  token: string
  expiresAt: string
  user: WechatProfile
}

const SESSION_KEY = 'forest_wechat_session'

export function getSession(): WechatSession | null {
  const value = wx.getStorageSync(SESSION_KEY) as WechatSession | undefined
  const expiresAt = Date.parse(value?.expiresAt || '')
  if (!value || typeof value.token !== 'string' || !value.user?.id || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    wx.removeStorageSync(SESSION_KEY)
    return null
  }
  return value
}

export function saveSession(session: WechatSession) {
  wx.setStorageSync(SESSION_KEY, session)
}

export function clearSession() {
  wx.removeStorageSync(SESSION_KEY)
}
