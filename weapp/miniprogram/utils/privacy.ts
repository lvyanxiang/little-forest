type PrivacyResolve = (result: { event: 'agree' | 'disagree'; buttonId?: string }) => void
type PrivacyApi = {
  onNeedPrivacyAuthorization?: (handler: (resolve: PrivacyResolve) => void) => void
  openPrivacyContract?: (options: { success?: () => void; fail?: () => void }) => void
}

const privacy = wx as unknown as PrivacyApi
let pending: PrivacyResolve | null = null

export function registerPrivacyAuthorization() {
  privacy.onNeedPrivacyAuthorization?.((resolve) => {
    pending = resolve
    const pages = getCurrentPages()
    const page = pages[pages.length - 1]
    if (page) {
      page.setData({ showPrivacy: true })
      const host = page as typeof page & { syncTabs?: () => void }
      host.syncTabs?.()
    }
    else { resolve({ event: 'disagree' }); pending = null }
  })
}

export function finishPrivacyAuthorization(agree: boolean, buttonId = 'agree-profile-privacy') {
  pending?.({ event: agree ? 'agree' : 'disagree', ...(agree ? { buttonId } : {}) })
  pending = null
}

export function openPrivacyContract(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!privacy.openPrivacyContract) {
      wx.showToast({ title: '请升级微信查看隐私指引', icon: 'none' })
      resolve(false)
      return
    }
    privacy.openPrivacyContract({
      success: () => resolve(true),
      fail: () => {
        wx.showToast({ title: '隐私指引暂不可用，请联系管理员', icon: 'none' })
        resolve(false)
      },
    })
  })
}

type LoginConsentDialog = { requestConsent: () => Promise<boolean>; cancel: () => void }

function getLoginConsentDialog(): LoginConsentDialog | null {
  const pages = getCurrentPages()
  const page = pages[pages.length - 1]
  return page?.selectComponent('#login-consent') as unknown as LoginConsentDialog | null
}

export async function requestLoginConsent() {
  const dialog = getLoginConsentDialog()
  if (!dialog) throw new Error('请从登录或预约页面重新登录')
  if (!await dialog.requestConsent()) throw new Error('已取消微信登录')
}

export function cancelLoginConsent() {
  getLoginConsentDialog()?.cancel()
}
