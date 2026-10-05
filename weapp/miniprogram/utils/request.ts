import { API_BASE } from './config'

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

function readMessage(data: unknown) {
  if (!data || typeof data !== 'object') return '请求失败'
  const message = (data as { message?: string | string[] }).message
  if (Array.isArray(message)) return message[0] || '请求失败'
  if (typeof message === 'string' && message) return message
  return '请求失败'
}

export function request<T>(path: string, method: Method = 'GET', data?: Record<string, unknown>): Promise<T> {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE}${path}`,
      method,
      data,
      header: { 'content-type': 'application/json' },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data as T)
          return
        }
        reject(new Error(readMessage(res.data)))
      },
      fail() {
        reject(new Error('连不上服务，请确认本机已启动 service'))
      },
    })
  })
}
