// Development tools use the local backend; trial/release must use a real HTTPS API.
export const DEVELOP_API_BASE = 'http://127.0.0.1:3001/api'
export const PRODUCTION_API_BASE = '' // e.g. https://api.your-domain.cn/api
const version = wx.getAccountInfoSync().miniProgram.envVersion
export const API_BASE = version === 'develop' ? DEVELOP_API_BASE : PRODUCTION_API_BASE

export function resolveApiAsset(path: string) {
  if (!path) return ''
  if (/^https?:\/\//.test(path)) return path
  const origin = API_BASE.replace(/\/api\/?$/, '')
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`
}
