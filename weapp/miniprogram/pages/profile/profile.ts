import { Booking, cancelBooking, fetchMyBookings, getConfirmedCount } from '../../utils/booking'
import { formatFullDate, maskPhone, startOfToday } from '../../utils/date'
import { getLayoutMetrics } from '../../utils/layout'
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
    statusText: item.status === 'cancelled' ? '已取消' : '已到访',
  }
}

Page({
  data: {
    displayName: '书友',
    displayPhone: '未登录',
    confirmedCount: 0,
    upcoming: [] as BookingView[],
    past: [] as BookingView[],
    cancelTarget: '',
    pageBottom: 80,
  },
  onLoad() {
    this.setData({ pageBottom: getLayoutMetrics().tabBarHeight + 16 })
  },
  onShow() {
    this.refresh()
    syncTabBar(this, 2, Boolean(this.data.cancelTarget))
  },
  async refresh() {
    try {
      const bookings = await fetchMyBookings()
      this.applyBookings(bookings)
    } catch (err) {
      wx.showToast({ title: err instanceof Error ? err.message : '加载预约失败', icon: 'none' })
    }
    syncTabBar(this, 2, Boolean(this.data.cancelTarget))
  },
  applyBookings(bookings: Booking[]) {
    const today = startOfToday()
    const last = bookings[0]
    const upcoming = bookings
      .filter((item) => item.status === 'confirmed' && item.dateTs >= today)
      .sort((a, b) => a.dateTs - b.dateTs)
      .map(toView)
    const past = bookings
      .filter((item) => item.status !== 'confirmed' || item.dateTs < today)
      .sort((a, b) => b.dateTs - a.dateTs)
      .map(toView)

    this.setData({
      displayName: last ? last.name : '书友',
      displayPhone: last ? maskPhone(last.phone) : '未登录',
      confirmedCount: getConfirmedCount(),
      upcoming,
      past,
    })
  },
  onGoReserve() {
    wx.switchTab({ url: '/pages/reserve/reserve' })
  },
  onAskCancel(e: WechatMiniprogram.TouchEvent) {
    const id = String(e.currentTarget.dataset.id || '')
    if (!id) return
    this.setData({ cancelTarget: id })
    syncTabBar(this, 2, true)
  },
  onCloseCancel() {
    this.setData({ cancelTarget: '' })
    syncTabBar(this, 2, false)
  },
  async onConfirmCancel() {
    const { cancelTarget } = this.data
    if (!cancelTarget) return
    try {
      await cancelBooking(cancelTarget)
      this.setData({ cancelTarget: '' })
      await this.refresh()
      syncTabBar(this, 2, false)
      wx.showToast({ title: '已取消预约', icon: 'none' })
    } catch (err) {
      wx.showToast({ title: err instanceof Error ? err.message : '取消失败', icon: 'none' })
    }
  },
  noop() {},
})
