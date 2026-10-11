import { fetchWechatProfile, loginWechat, logoutWechat, saveWechatProfile } from '../../utils/auth'
import { Booking, cancelBooking, fetchMyBookings, getConfirmedCount } from '../../utils/booking'
import { formatFullDate, maskPhone, startOfToday } from '../../utils/date'
import { getLayoutMetrics } from '../../utils/layout'
import { finishPrivacyAuthorization, openPrivacyContract } from '../../utils/privacy'
import { getSession, type WechatProfile } from '../../utils/session'
import { syncTabBar } from '../../utils/tab'

interface BookingView {
  id: string
  dateText: string
  slot: string
  name: string
  phoneMasked: string
  status: string
  statusText: string
}

function toView(item: Booking): BookingView {
  return {
    id: item.id,
    dateText: formatFullDate(item.dateTs),
    slot: item.slot,
    name: item.name,
    phoneMasked: maskPhone(item.phone),
    status: item.status,
    statusText: item.status === 'cancelled' ? '已取消' : '已结束',
  }
}

Page({
  data: {
    loggedIn: false,
    loggingIn: false,
    loggingOut: false,
    displayName: '书友',
    avatarUrl: '',
    confirmedCount: 0,
    upcoming: [] as BookingView[],
    past: [] as BookingView[],
    cancelTarget: '',
    pageBottom: 80,
    showProfileEditor: false,
    draftNickname: '',
    draftAvatar: '',
    nicknameAllowed: true,
    savingProfile: false,
    profileError: '',
    showPrivacy: false,
  },
  onLoad() {
    this.setData({ pageBottom: getLayoutMetrics().tabBarHeight + 16 })
  },
  onShow() {
    this.refresh()
    this.syncTabs()
  },
  syncTabs() {
    syncTabBar(this, 2, Boolean(this.data.cancelTarget || this.data.showProfileEditor || this.data.showPrivacy))
  },
  applyProfile(profile: WechatProfile | null) {
    this.setData({ loggedIn: Boolean(profile), displayName: profile?.nickname || '书友', avatarUrl: profile?.avatarUrl || '' })
  },
  async refresh() {
    if (!getSession()) {
      this.applyProfile(null)
      this.applyBookings([])
      this.syncTabs()
      return
    }
    this.applyProfile(getSession()!.user)
    try {
      this.applyProfile(await fetchWechatProfile())
      this.applyBookings(await fetchMyBookings())
    } catch (err) {
      if (!getSession()) { this.applyProfile(null); this.applyBookings([]) }
      wx.showToast({ title: err instanceof Error ? err.message : '加载失败', icon: 'none' })
    }
    this.syncTabs()
  },
  applyBookings(bookings: Booking[]) {
    const today = startOfToday()
    this.setData({
      confirmedCount: getSession() ? getConfirmedCount() : 0,
      upcoming: bookings.filter((item) => item.status === 'confirmed' && item.dateTs >= today)
        .sort((a, b) => a.dateTs - b.dateTs).map(toView),
      past: bookings.filter((item) => item.status !== 'confirmed' || item.dateTs < today)
        .sort((a, b) => b.dateTs - a.dateTs).map(toView),
    })
  },
  async onLogin() {
    if (this.data.loggingIn) return
    this.setData({ loggingIn: true })
    try {
      await loginWechat()
      await this.refresh()
      wx.showToast({ title: '微信登录成功', icon: 'success' })
    } catch (err) {
      wx.showToast({ title: err instanceof Error ? err.message : '微信登录失败', icon: 'none' })
    } finally { this.setData({ loggingIn: false }) }
  },
  async onLogout() {
    if (this.data.loggingOut) return
    this.setData({ loggingOut: true })
    try { await logoutWechat() }
    catch { wx.showToast({ title: '已退出本机登录', icon: 'none' }) }
    finally {
      this.applyProfile(null)
      this.applyBookings([])
      this.setData({ loggingOut: false, cancelTarget: '', showProfileEditor: false })
      this.syncTabs()
    }
  },
  onEditProfile() {
    if (!this.data.loggedIn) { this.onLogin(); return }
    this.setData({ showProfileEditor: true, draftNickname: this.data.displayName, draftAvatar: '', profileError: '', nicknameAllowed: true })
    this.syncTabs()
  },
  onCloseProfile() {
    if (this.data.savingProfile) return
    this.setData({ showProfileEditor: false, draftAvatar: '' })
    this.syncTabs()
  },
  onChooseAvatar(event: WechatMiniprogram.CustomEvent<{ avatarUrl: string }>) {
    if (event.detail.avatarUrl) this.setData({ draftAvatar: event.detail.avatarUrl, profileError: '' })
  },
  onNicknameInput(event: WechatMiniprogram.Input) {
    this.setData({ draftNickname: event.detail.value, profileError: '' })
  },
  onNicknameReview(event: WechatMiniprogram.CustomEvent<{ pass: boolean }>) {
    this.setData({ nicknameAllowed: event.detail.pass !== false })
    if (event.detail.pass === false) this.setData({ profileError: '昵称未通过微信审核，请修改' })
  },
  async onSaveProfile() {
    const { draftNickname, draftAvatar, savingProfile, nicknameAllowed } = this.data
    const nickname = draftNickname.trim()
    if (savingProfile) return
    if (!nickname || !nicknameAllowed) { this.setData({ profileError: '请填写合适的昵称' }); return }
    this.setData({ savingProfile: true, profileError: '' })
    try {
      this.applyProfile(await saveWechatProfile(nickname, draftAvatar || undefined))
      this.setData({ showProfileEditor: false, draftAvatar: '' })
      wx.showToast({ title: '资料已保存', icon: 'success' })
    } catch (err) {
      this.setData({ profileError: err instanceof Error ? err.message : '保存资料失败' })
      if (!getSession()) { this.applyProfile(null); this.setData({ showProfileEditor: false }); this.applyBookings([]) }
    } finally { this.setData({ savingProfile: false }); this.syncTabs() }
  },
  onOpenPrivacy() { openPrivacyContract() },
  onAgreePrivacy() {
    finishPrivacyAuthorization(true)
    this.setData({ showPrivacy: false })
    this.syncTabs()
  },
  onRejectPrivacy() {
    finishPrivacyAuthorization(false)
    this.setData({ showPrivacy: false })
    this.syncTabs()
  },
  onGoReserve() { wx.switchTab({ url: '/pages/reserve/reserve' }) },
  onAskCancel(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id || '')
    if (!id) return
    this.setData({ cancelTarget: id })
    this.syncTabs()
  },
  onCloseCancel() { this.setData({ cancelTarget: '' }); this.syncTabs() },
  async onConfirmCancel() {
    if (!this.data.cancelTarget) return
    try {
      await cancelBooking(this.data.cancelTarget)
      this.setData({ cancelTarget: '' })
      await this.refresh()
      wx.showToast({ title: '已取消预约', icon: 'none' })
    } catch (err) {
      wx.showToast({ title: err instanceof Error ? err.message : '取消失败', icon: 'none' })
    }
    this.syncTabs()
  },
  onUnload() { if (this.data.showPrivacy) finishPrivacyAuthorization(false) },
  noop() {},
})
