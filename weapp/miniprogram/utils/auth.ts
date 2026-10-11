import { API_BASE } from './config'
import { request } from './request'
import { clearSession, getSession, saveSession, type WechatProfile, type WechatSession } from './session'

let loginTask: Promise<WechatSession> | null = null

export function loginWechat(): Promise<WechatSession> {
  if (loginTask) return loginTask
  loginTask = new Promise<string>((resolve, reject) => {
    wx.login({
      success: (result) => result.code ? resolve(result.code) : reject(new Error('未取得微信登录凭证，请重试')),
      fail: () => reject(new Error('微信登录失败，请重试')),
    })
  }).then((code) => request<WechatSession>('/wechat/login', 'POST', { code }))
    .then((session) => { saveSession(session); return session })
    .finally(() => { loginTask = null })
  return loginTask
}

export async function ensureWechatLogin() {
  const session = getSession()
  if (session) return session
  const agreed = await new Promise<boolean>((resolve) => {
    wx.showModal({
      title: '微信登录后预约',
      content: '使用微信账号保存和查看您的预约。头像昵称可自行完善，手机号仅使用预约时填写的号码。',
      confirmText: '微信登录',
      success: (result) => resolve(result.confirm),
      fail: () => resolve(false),
    })
  })
  if (!agreed) throw new Error('已取消微信登录')
  return loginWechat()
}

async function loadAvatar(profile: WechatProfile): Promise<string> {
  const session = getSession()
  if (!profile.hasAvatar || !session) return ''
  return new Promise((resolve) => {
    wx.downloadFile({
      url: `${API_BASE}/wechat/avatar`,
      header: { Authorization: `Bearer ${session.token}` },
      success: (result) => resolve(result.statusCode === 200 ? result.tempFilePath : ''),
      fail: () => resolve(''),
    })
  })
}

export async function fetchWechatProfile() {
  const session = getSession()
  if (!session) throw new Error('请先微信登录')
  const profile = await request<WechatProfile>('/wechat/me', 'GET', undefined, true)
  profile.avatarUrl = await loadAvatar(profile)
  if (getSession()?.token !== session.token) throw new Error('登录状态已变化，请重试')
  saveSession({ ...session, user: profile })
  return profile
}

export async function saveWechatProfile(nickname: string, avatarPath?: string) {
  const session = getSession()
  if (!session) throw new Error('请先微信登录')
  if (avatarPath) {
    await new Promise<void>((resolve, reject) => {
      wx.uploadFile({
        url: `${API_BASE}/wechat/profile`,
        filePath: avatarPath,
        name: 'avatar',
        formData: { nickname },
        header: { Authorization: `Bearer ${session.token}` },
        success(result) {
          try {
            const body = JSON.parse(result.data) as { message?: string | string[] }
            if (result.statusCode >= 200 && result.statusCode < 300) { resolve(); return }
            if (result.statusCode === 401) clearSession()
            reject(new Error(Array.isArray(body.message) ? body.message[0] : body.message || '保存资料失败'))
          } catch { reject(new Error('保存资料失败，请稍后重试')) }
        },
        fail: () => reject(new Error('头像上传失败，请稍后重试')),
      })
    })
  } else {
    await request('/wechat/profile', 'POST', { nickname }, true)
  }
  return fetchWechatProfile()
}

export async function logoutWechat() {
  try {
    if (getSession()) await request('/wechat/logout', 'POST', undefined, true)
  } finally {
    clearSession()
  }
}
