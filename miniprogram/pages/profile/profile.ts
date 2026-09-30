import { Booking, cancelBooking, getBookings, getConfirmedCount } from '../../utils/booking'
import { formatFullDate, maskPhone, startOfToday } from '../../utils/date'
import { syncTabBar } from '../../utils/tab'

interface BookingView {
  id: string
  dateText: string
  slot: string
  peopleText: string
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
    peopleText: `${item.people} 人`,
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
  },
  onShow() {
    this.refresh()
    syncTabBar(this, 2, Boolean(this.data.cancelTarget))
  },
  refresh() {
    const today = startOfToday()
    const bookings = getBookings()
    const last = bookings[bookings.length - 1]
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
  onConfirmCancel() {
    const { cancelTarget } = this.data
    if (!cancelTarget) return
    cancelBooking(cancelTarget)
    this.setData({ cancelTarget: '' })
    this.refresh()
    syncTabBar(this, 2, false)
    wx.showToast({ title: '已取消预约', icon: 'none' })
  },
  noop() {},
})
