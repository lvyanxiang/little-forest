import { API_BASE } from './config'
import { request } from './request'
import { cancelLoginConsent, requestLoginConsent } from './privacy'
import { clearSession, getSession, saveSession, type WechatProfile, type WechatSession } from './session'

let loginTask: Promise<WechatSession> | null = null
let loginGeneration = 0
let profileGeneration = 0

export function loginWechat(): Promise<WechatSession> {
  if (loginTask) return loginTask
  const generation = loginGeneration
  const task = requestLoginConsent().then(() => new Promise<string>((resolve, reject) => {
    if (generation !== loginGeneration) { reject(new Error('登录已取消，请重试')); return }
    wx.login({
      success: (result) => result.code ? resolve(result.code) : reject(new Error('未取得微信登录凭证，请重试')),
      fail: () => reject(new Error('微信登录失败，请重试')),
    })
  })).then((code) => {
    if (generation !== loginGeneration) throw new Error('登录已取消，请重试')
    return request<WechatSession>('/wechat/login', 'POST', { code })
  })
    .then((session) => {
      if (generation !== loginGeneration) throw new Error('登录已取消，请重试')
      saveSession(session)
      return session
    })
    .finally(() => { if (loginTask === task) loginTask = null })
  loginTask = task
  return task
}

export async function ensureWechatLogin(verifySession = false) {
  const session = getSession()
  if (session) {
    if (!verifySession) return session
    try {
      await fetchWechatProfile()
      const verified = getSession()
      if (verified?.token !== session.token) throw new Error('登录状态已变化，请重试')
      return verified
    } catch (error) {
      // Only a rejected/expired session should lead to login. Network failures keep the form intact.
      if (getSession()) throw error
    }
  }
  return loginWechat()
}

async function loadAvatar(profile: WechatProfile, session: WechatSession): Promise<string> {
  if (!profile.hasAvatar || !session) return ''
  return new Promise((resolve) => {
    wx.downloadFile({
      url: `${API_BASE}/wechat/avatar${profile.updatedAt ? `?v=${encodeURIComponent(profile.updatedAt)}` : ''}`,
      header: { Authorization: `Bearer ${session.token}`, 'Cache-Control': 'no-cache' },
      success: (result) => resolve(result.statusCode === 200 ? result.tempFilePath : ''),
      fail: () => resolve(''),
    })
  })
}

async function hydrateProfile(profile: WechatProfile, session: WechatSession, generation: number, savedAvatarPreview?: string) {
  if (profile.id !== session.user.id) throw new Error('用户资料返回异常，请重试')
  const downloadedAvatar = await loadAvatar(profile, session)
  if (getSession()?.token !== session.token) throw new Error('登录状态已变化，请重试')
  // A profile read that started before a newer read/save must not undo the newer avatar.
  if (generation !== profileGeneration) return getSession()!.user
  profile.avatarLoadFailed = profile.hasAvatar && !downloadedAvatar
  profile.avatarUrl = downloadedAvatar || (profile.hasAvatar ? savedAvatarPreview || session.user.avatarUrl || '' : '')
  saveSession({ ...session, user: profile })
  return profile
}

export async function fetchWechatProfile() {
  const session = getSession()
  if (!session) throw new Error('请先微信登录')
  const generation = ++profileGeneration
  const profile = await request<WechatProfile>('/wechat/me', 'GET', undefined, true)
  return hydrateProfile(profile, session, generation)
}

export async function fetchWechatPhoneNumber(code: string) {
  const session = getSession()
  if (!session) throw new Error('请先微信登录')
  const result = await request<{ phoneNumber: string }>('/wechat/phone-number', 'POST', { code }, true)
  if (getSession()?.token !== session.token) throw new Error('登录状态已变化，请重试')
  if (!/^1\d{10}$/.test(result.phoneNumber)) throw new Error('手机号获取失败，请手动填写')
  return result.phoneNumber
}

export async function saveWechatProfile(nickname?: string, avatarPath?: string) {
  const session = getSession()
  if (!session) throw new Error('请先微信登录')
  let profile: WechatProfile
  if (avatarPath) {
    profile = await new Promise<WechatProfile>((resolve, reject) => {
      wx.uploadFile({
        url: `${API_BASE}/wechat/profile`,
        filePath: avatarPath,
        name: 'avatar',
        formData: nickname === undefined ? {} : { nickname },
        header: { Authorization: `Bearer ${session.token}` },
        success(result) {
          try {
            const body = JSON.parse(result.data) as WechatProfile & { message?: string | string[] }
            if (session.token !== getSession()?.token) { reject(new Error('登录状态已变化，请重试')); return }
            if (result.statusCode >= 200 && result.statusCode < 300) { resolve(body); return }
            if (result.statusCode === 401) clearSession()
            reject(new Error(Array.isArray(body.message) ? body.message[0] : body.message || '保存资料失败'))
          } catch { reject(new Error('保存资料失败，请稍后重试')) }
        },
        fail: () => reject(new Error('头像上传失败，请稍后重试')),
      })
    })
  } else {
    profile = await request<WechatProfile>('/wechat/profile', 'POST', { nickname }, true)
  }
  if (session.token !== getSession()?.token) throw new Error('登录状态已变化，请重试')
  return hydrateProfile(profile, session, ++profileGeneration, avatarPath)
}

export async function logoutWechat() {
  const session = getSession()
  loginGeneration += 1
  loginTask = null
  cancelLoginConsent()
  try {
    if (session) await request('/wechat/logout', 'POST', undefined, true)
  } finally {
    if (!session || getSession()?.token === session.token) clearSession()
  }
}
