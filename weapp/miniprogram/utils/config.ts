import { DEVELOP_API_BASE, PRODUCTION_API_BASE } from './env.generated'

export { DEVELOP_API_BASE, PRODUCTION_API_BASE } from './env.generated'

const version = wx.getAccountInfoSync().miniProgram.envVersion
const deviceApi = wx as typeof wx & { getDeviceInfo?: () => { platform: string } }
const platform = deviceApi.getDeviceInfo ? deviceApi.getDeviceInfo().platform : wx.getSystemInfoSync().platform

// Only the local development simulator can reach the computer's loopback address.
// Phone previews and uploaded versions always use the production API.
export const API_BASE = version === 'develop' && platform === 'devtools' ? DEVELOP_API_BASE : PRODUCTION_API_BASE

export function resolveApiAsset(path: string) {
  if (!path) return ''
  if (/^https?:\/\//.test(path)) return path
  const origin = API_BASE.replace(/\/api\/?$/, '')
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`
}
