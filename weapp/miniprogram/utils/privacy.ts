type PrivacyResolve = (result: { event: 'agree' | 'disagree'; buttonId?: string }) => void
type PrivacyApi = {
  onNeedPrivacyAuthorization?: (handler: (resolve: PrivacyResolve) => void) => void
  openPrivacyContract?: (options: { fail?: () => void }) => void
}

const privacy = wx as unknown as PrivacyApi
let pending: PrivacyResolve | null = null

export function registerPrivacyAuthorization() {
  privacy.onNeedPrivacyAuthorization?.((resolve) => {
    pending = resolve
    const pages = getCurrentPages()
    const page = pages[pages.length - 1]
    if (page) page.setData({ showPrivacy: true })
    else { resolve({ event: 'disagree' }); pending = null }
  })
}

export function finishPrivacyAuthorization(agree: boolean) {
  pending?.({ event: agree ? 'agree' : 'disagree', ...(agree ? { buttonId: 'agree-profile-privacy' } : {}) })
  pending = null
}

export function openPrivacyContract() {
  if (!privacy.openPrivacyContract) {
    wx.showToast({ title: '请升级微信查看隐私指引', icon: 'none' })
    return
  }
  privacy.openPrivacyContract({ fail: () => wx.showToast({ title: '隐私指引暂不可用，请联系管理员', icon: 'none' }) })
}
