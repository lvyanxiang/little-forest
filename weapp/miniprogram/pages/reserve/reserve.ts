import { ApiSlot, createBooking, fetchMyBookings, fetchSlots } from '../../utils/booking'
import { addDays, diffDays, formatFullDate, formatShortDate, formatWeekday, startOfToday, toDateKey, weekdayOf } from '../../utils/date'
import { getLayoutMetrics } from '../../utils/layout'
import { FALLBACK_STORE, fetchStore, type StoreInfo } from '../../utils/store'
import { syncTabBar } from '../../utils/tab'

type ResvStep = 'pick' | 'form' | 'success'

interface DateChip {
  ts: number
  monthLabel: string
  day: number
  weekday: string
  selected: boolean
  closed: boolean
}

interface SlotView {
  id: number
  label: string
  max: number
  booked: number
  avail: number
  isFull: boolean
  isPast: boolean
  isSel: boolean
  fillPct: number
  barColor: string
  statusLabel: string
  statusColor: string
  cardBg: string
  cardBorder: string
  timeColor: string
  muted: string
  showShimmer: boolean
}

function buildQuickDates(selectedTs: number, closedWeekdays: number[]): DateChip[] {
  const today = startOfToday()
  return Array.from({ length: 14 }, (_, i) => {
    const ts = addDays(today, i)
    return {
      ts,
      monthLabel: i === 0 ? '今天' : `${new Date(ts).getMonth() + 1}月`,
      day: new Date(ts).getDate(),
      weekday: `周${formatWeekday(ts)}`,
      selected: ts === selectedTs,
      closed: closedWeekdays.includes(weekdayOf(ts)),
    }
  })
}

function decorateSlots(slots: ApiSlot[], selectedSlot: number | null, closed: boolean): SlotView[] {
  return slots.map((slot) => {
    const booked = slot.booked
    const isPast = !closed && Boolean(slot.isPast)
    const avail = closed || isPast ? 0 : slot.avail
    const isFull = closed || isPast || slot.isFull
    const fillPct = slot.max > 0 ? Math.max(0, Math.min(100, (booked / slot.max) * 100)) : 0
    const isSel = !closed && !isPast && selectedSlot === slot.id
    const barColor = isFull
      ? '#8A7558'
      : fillPct >= 80
        ? '#B87C4C'
        : fillPct >= 50
          ? '#C4A44C'
          : '#8A7558'
    const statusLabel = closed
      ? '该日闭馆'
      : isPast
        ? '已过时'
        : slot.isFull
          ? '已约满'
          : avail <= 2
            ? `仅剩 ${avail} 个名额`
            : `剩余 ${avail} 个名额`
    const statusColor = isFull || closed ? '#8A7558' : avail <= 2 ? '#B87C4C' : '#8A7558'
    return {
      id: slot.id,
      label: slot.label,
      max: slot.max,
      booked: closed ? 0 : booked,
      avail,
      isFull,
      isPast,
      isSel,
      fillPct: closed ? 0 : fillPct,
      barColor,
      statusLabel,
      statusColor,
      cardBg: isSel ? '#EDE4CE' : isFull ? '#F0EBE0' : '#F5EFE0',
      cardBorder: isSel ? '#5C7A3A' : isFull ? '#D8CFC4' : '#C4B49A',
      timeColor: isFull ? '#8A7558' : '#1E3A1E',
      muted: '#8A7558',
      showShimmer: fillPct >= 70 && !isFull && !closed,
    }
  })
}

let noticeShakeTimer: ReturnType<typeof setTimeout> | null = null

Page({
  data: {
    step: 'pick' as ResvStep,
    selectedTs: startOfToday(),
    selectedSlot: null as number | null,
    selectedDateText: formatFullDate(startOfToday()),
    selectedSlotLabel: '',
    isQuickDate: true,
    moreDateLabel: '更多日期',
    quickDates: [] as DateChip[],
    slots: [] as SlotView[],
    rawSlots: [] as ApiSlot[],
    dayClosed: false,
    closedWeekdays: FALLBACK_STORE.closedWeekdays,
    showCalendar: false,
    name: '',
    phone: '',
    noticeRead: false,
    noticeShake: false,
    fieldsReady: false,
    canSubmit: false,
    submitting: false,
    successDate: '',
    pageBottom: 80,
    noticeHeading: FALLBACK_STORE.noticeHeading,
    noticeItems: FALLBACK_STORE.noticeItems,
    noticeFoot: FALLBACK_STORE.noticeFoot,
    successNoticeLines: FALLBACK_STORE.successNoticeLines,
    storeAddress: FALLBACK_STORE.address,
  },
  onLoad() {
    this.setData({ pageBottom: getLayoutMetrics().tabBarHeight })
    this.bootstrap()
  },
  onShow() {
    syncTabBar(this, 1, this.data.showCalendar)
    if (this.data.step === 'pick') {
      this.refreshPick()
    }
    fetchMyBookings()
      .then(() => syncTabBar(this, 1, this.data.showCalendar))
      .catch(() => {})
  },
  async bootstrap() {
    try {
      const store = await fetchStore()
      this.applyStore(store)
    } catch {
      this.applyStore(FALLBACK_STORE)
    }
    await this.refreshPick()
  },
  applyStore(store: StoreInfo) {
    this.setData({
      closedWeekdays: store.closedWeekdays,
      noticeHeading: store.noticeHeading,
      noticeItems: store.noticeItems,
      noticeFoot: store.noticeFoot,
      successNoticeLines: store.successNoticeLines,
      storeAddress: store.address,
    })
  },
  async refreshPick() {
    const { selectedTs, selectedSlot, closedWeekdays } = this.data
    const today = startOfToday()
    const isQuickDate = diffDays(selectedTs, today) >= 0 && diffDays(selectedTs, today) < 14
    const dateKey = toDateKey(selectedTs)
    let rawSlots: ApiSlot[] = this.data.rawSlots
    let dayClosed = closedWeekdays.includes(weekdayOf(selectedTs))
    try {
      const day = await fetchSlots(dateKey)
      rawSlots = day.slots
      dayClosed = day.closed
    } catch (err) {
      rawSlots = []
      wx.showToast({ title: err instanceof Error ? err.message : '时段加载失败', icon: 'none' })
    }
    const nextSlot =
      rawSlots.some((item) => item.id === selectedSlot && !item.isFull && !item.isPast) && !dayClosed
        ? selectedSlot
        : null
    const selected = rawSlots.find((item) => item.id === nextSlot)
    this.setData({
      quickDates: buildQuickDates(selectedTs, closedWeekdays),
      rawSlots,
      slots: decorateSlots(rawSlots, nextSlot, dayClosed),
      selectedSlot: nextSlot,
      selectedSlotLabel: selected ? selected.label : '',
      selectedDateText: formatFullDate(selectedTs),
      isQuickDate,
      moreDateLabel: isQuickDate ? '更多日期' : formatShortDate(selectedTs),
      dayClosed,
    })
  },
  onSelectDate(e: WechatMiniprogram.TouchEvent) {
    const ts = Number(e.currentTarget.dataset.ts)
    if (!ts) return
    this.setData({ selectedTs: ts, selectedSlot: null, selectedSlotLabel: '' })
    this.refreshPick()
  },
  onOpenCalendar() {
    this.setData({ showCalendar: true })
    syncTabBar(this, 1, true)
  },
  onCloseCalendar() {
    this.setData({ showCalendar: false })
    syncTabBar(this, 1, false)
  },
  onCalendarSelect(e: WechatMiniprogram.CustomEvent<{ ts: number }>) {
    const ts = Number(e.detail.ts)
    this.setData({
      selectedTs: ts,
      selectedSlot: null,
      selectedSlotLabel: '',
      showCalendar: false,
    })
    syncTabBar(this, 1, false)
    this.refreshPick()
  },
  onSelectSlot(e: WechatMiniprogram.TouchEvent) {
    const id = Number(e.currentTarget.dataset.id)
    const full = e.currentTarget.dataset.full
    if (!id || full === true || full === 'true' || this.data.dayClosed) return
    const slot = this.data.rawSlots.find((item) => item.id === id)
    this.setData({
      selectedSlot: id,
      selectedSlotLabel: slot ? slot.label : '',
    })
    this.setData({
      slots: decorateSlots(this.data.rawSlots, id, this.data.dayClosed),
    })
  },
  onNext() {
    const { selectedSlot, dayClosed, rawSlots } = this.data
    if (!selectedSlot || dayClosed) return
    const slot = rawSlots.find((item) => item.id === selectedSlot)
    if (!slot || slot.isFull || slot.isPast) return
    this.setData({
      step: 'form',
      fieldsReady: this.isFieldsReady(this.data.name, this.data.phone),
      canSubmit: this.isFormReady(this.data.name, this.data.phone, this.data.noticeRead),
    })
  },
  onBackPick() {
    this.setData({ step: 'pick' })
    this.refreshPick()
  },
  isFieldsReady(name: string, phone: string) {
    return Boolean(name.trim() && phone.trim())
  },
  isFormReady(name: string, phone: string, noticeRead: boolean) {
    return this.isFieldsReady(name, phone) && noticeRead
  },
  shakeNotice() {
    if (noticeShakeTimer) {
      clearTimeout(noticeShakeTimer)
      noticeShakeTimer = null
    }
    this.setData({ noticeShake: false })
    wx.nextTick(() => {
      this.setData({ noticeShake: true })
      wx.vibrateShort({ type: 'medium' })
      wx.pageScrollTo({
        selector: '#notice-check',
        offsetTop: -80,
        duration: 240,
      })
      noticeShakeTimer = setTimeout(() => {
        this.setData({ noticeShake: false })
        noticeShakeTimer = null
      }, 520)
    })
  },
  onNameInput(e: WechatMiniprogram.Input) {
    const name = e.detail.value
    this.setData({
      name,
      fieldsReady: this.isFieldsReady(name, this.data.phone),
      canSubmit: this.isFormReady(name, this.data.phone, this.data.noticeRead),
    })
  },
  onPhoneInput(e: WechatMiniprogram.Input) {
    const phone = e.detail.value
    this.setData({
      phone,
      fieldsReady: this.isFieldsReady(this.data.name, phone),
      canSubmit: this.isFormReady(this.data.name, phone, this.data.noticeRead),
    })
  },
  onToggleNotice() {
    const noticeRead = !this.data.noticeRead
    this.setData({
      noticeRead,
      noticeShake: false,
      canSubmit: this.isFormReady(this.data.name, this.data.phone, noticeRead),
    })
  },
  async onConfirm() {
    const { selectedSlot, selectedTs, name, phone, noticeRead, submitting, dayClosed } = this.data
    const trimmedName = name.trim()
    const trimmedPhone = phone.trim()
    if (!noticeRead) {
      this.shakeNotice()
    }
    if (!selectedSlot || !trimmedName || !trimmedPhone || dayClosed) {
      if (!trimmedName || !trimmedPhone) {
        wx.showToast({ title: '请填写姓名和手机号', icon: 'none' })
      }
      return
    }
    if (!noticeRead || submitting) return
    if (!/^1\d{10}$/.test(trimmedPhone)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    try {
      await createBooking({
        visitDate: toDateKey(selectedTs),
        slotId: selectedSlot,
        name: trimmedName,
        phone: trimmedPhone,
        people: 1,
      })
      this.setData({
        step: 'success',
        name: trimmedName,
        phone: trimmedPhone,
        successDate: formatShortDate(selectedTs),
        submitting: false,
      })
      syncTabBar(this, 1)
    } catch (err) {
      this.setData({ submitting: false })
      wx.showToast({ title: err instanceof Error ? err.message : '预约失败', icon: 'none' })
    }
  },
  onReset() {
    const today = startOfToday()
    this.setData({
      step: 'pick',
      selectedTs: today,
      selectedSlot: null,
      selectedSlotLabel: '',
      name: '',
      phone: '',
      noticeRead: false,
      noticeShake: false,
      fieldsReady: false,
      canSubmit: false,
      submitting: false,
    })
    this.refreshPick()
  },
  onUnload() {
    if (noticeShakeTimer) {
      clearTimeout(noticeShakeTimer)
      noticeShakeTimer = null
    }
  },
})
