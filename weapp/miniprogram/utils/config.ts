export const API_BASE = 'http://127.0.0.1:3001/api'

export function resolveApiAsset(path: string) {
  if (!path) return ''
  if (/^https?:\/\//.test(path)) return path
  const origin = API_BASE.replace(/\/api\/?$/, '')
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`
}
