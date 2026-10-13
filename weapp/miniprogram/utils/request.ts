import { API_BASE } from './config'
import { clearSession, getSession } from './session'

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE'

function readMessage(data: unknown) {
  if (!data || typeof data !== 'object') return '请求失败'
  const message = (data as { message?: string | string[] }).message
  if (Array.isArray(message)) return message[0] || '请求失败'
  if (typeof message === 'string' && message) return message
  return '请求失败'
}

export function request<T>(path: string, method: Method = 'GET', data?: Record<string, unknown>, authenticated = false): Promise<T> {
  if (!API_BASE) return Promise.reject(new Error('尚未配置小程序服务域名，请联系管理员'))
  const session = authenticated ? getSession() : null
  if (authenticated && !session) return Promise.reject(new Error('请先微信登录'))
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE}${path}`,
      method,
      data,
      header: { 'content-type': 'application/json', ...(session ? { Authorization: `Bearer ${session.token}` } : {}) },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          if (authenticated && session?.token !== getSession()?.token) {
            reject(new Error('登录状态已变化，请重试'))
            return
          }
          resolve(res.data as T)
          return
        }
        if (res.statusCode === 401 && authenticated && session?.token === getSession()?.token) clearSession()
        reject(new Error(readMessage(res.data)))
      },
      fail(error) {
        // Keep the native transport error for device debugging; never log session headers or request data.
        console.error('[API] request failed', { url: `${API_BASE}${path}`, method, errMsg: error.errMsg })
        reject(new Error('暂时连不上服务，请稍后重试'))
      },
    })
  })
}
