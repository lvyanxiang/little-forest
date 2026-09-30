import { STORE_HOURS, addBooking, getSlotAvailability } from '../../utils/booking'
import { addDays, diffDays, formatFullDate, formatShortDate, formatWeekday, startOfToday } from '../../utils/date'
import { getLayoutMetrics } from '../../utils/layout'
import { NOTICE_FOOT, NOTICE_HEADING, NOTICE_ITEMS, SUCCESS_NOTICE_LINES } from '../../utils/notice'
import { syncTabBar } from '../../utils/tab'

type ResvStep = 'pick' | 'form' | 'success'

interface DateChip {
  ts: number
  monthLabel: string
  day: number
  weekday: string
  selected: boolean
}

interface SlotView {
  id: number
  label: string
  max: number
  booked: number
  avail: number
  isFull: boolean
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

function buildQuickDates(selectedTs: number): DateChip[] {
  const today = startOfToday()
  return Array.from({ length: 14 }, (_, i) => {
    const ts = addDays(today, i)
    return {
      ts,
      monthLabel: i === 0 ? '今天' : `${new Date(ts).getMonth() + 1}月`,
      day: new Date(ts).getDate(),
      weekday: `周${formatWeekday(ts)}`,
      selected: ts === selectedTs,
    }
  })
}

let noticeShakeTimer: ReturnType<typeof setTimeout> | null = null

function buildSlots(selectedTs: number, selectedSlot: number | null): SlotView[] {
  return STORE_HOURS.map((slot) => {
    const { booked, avail, isFull, fillPct } = getSlotAvailability(selectedTs, slot.id, slot.max)
    const isSel = selectedSlot === slot.id
    const barColor = isFull
      ? '#8A7558'
      : fillPct >= 80
        ? '#B87C4C'
        : fillPct >= 50
          ? '#C4A44C'
          : '#8A7558'
    const statusLabel = isFull ? '已约满' : avail <= 2 ? `仅剩 ${avail} 个名额` : `剩余 ${avail} 个名额`
    const statusColor = isFull ? '#8A7558' : avail <= 2 ? '#B87C4C' : '#8A7558'
    return {
      id: slot.id,
      label: slot.label,
      max: slot.max,
      booked,
      avail,
      isFull,
      isSel,
      fillPct,
      barColor,
      statusLabel,
      statusColor,
      cardBg: isSel ? '#EDE4CE' : isFull ? '#F0EBE0' : '#F5EFE0',
      cardBorder: isSel ? '#5C7A3A' : isFull ? '#D8CFC4' : '#C4B49A',
      timeColor: isFull ? '#8A7558' : '#1E3A1E',
      muted: '#8A7558',
      showShimmer: fillPct >= 70 && !isFull,
    }
  })
}

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
    showCalendar: false,
    name: '',
    phone: '',
    noticeRead: false,
    noticeShake: false,
    fieldsReady: false,
    canSubmit: false,
    successDate: '',
    pageBottom: 80,
    noticeHeading: NOTICE_HEADING,
    noticeItems: NOTICE_ITEMS,
    noticeFoot: NOTICE_FOOT,
    successNoticeLines: SUCCESS_NOTICE_LINES,
  },
  onLoad() {
    this.setData({ pageBottom: getLayoutMetrics().tabBarHeight })
    this.refreshPick()
  },
  onShow() {
    syncTabBar(this, 1, this.data.showCalendar)
    if (this.data.step === 'pick') {
      this.refreshPick()
    }
  },
  refreshPick() {
    const { selectedTs, selectedSlot } = this.data
    const today = startOfToday()
    const isQuickDate = diffDays(selectedTs, today) >= 0 && diffDays(selectedTs, today) < 14
    this.setData({
      quickDates: buildQuickDates(selectedTs),
      slots: buildSlots(selectedTs, selectedSlot),
      selectedDateText: formatFullDate(selectedTs),
      isQuickDate,
      moreDateLabel: isQuickDate ? '更多日期' : formatShortDate(selectedTs),
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
    if (!id || full === true || full === 'true') return
    const slot = STORE_HOURS.find((item) => item.id === id)
    this.setData({
      selectedSlot: id,
      selectedSlotLabel: slot ? slot.label : '',
    })
    this.refreshPick()
  },
  onNext() {
    const { selectedSlot } = this.data
    if (!selectedSlot) return
    const slot = STORE_HOURS.find((item) => item.id === selectedSlot)
    if (!slot) return
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
  onConfirm() {
    const { selectedSlot, selectedTs, name, phone, noticeRead } = this.data
    const trimmedName = name.trim()
    const trimmedPhone = phone.trim()
    if (!noticeRead) {
      this.shakeNotice()
    }
    if (!selectedSlot || !trimmedName || !trimmedPhone) {
      if (!trimmedName || !trimmedPhone) {
        wx.showToast({ title: '请填写姓名和手机号', icon: 'none' })
      }
      return
    }
    if (!noticeRead) return
    if (!/^1\d{10}$/.test(trimmedPhone)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }
    const slot = STORE_HOURS.find((item) => item.id === selectedSlot)
    if (!slot) return
    addBooking({
      id: Date.now().toString(),
      dateTs: selectedTs,
      slotId: slot.id,
      slot: slot.label,
      people: 1,
      name: trimmedName,
      phone: trimmedPhone,
      status: 'confirmed',
    })
    this.setData({
      step: 'success',
      name: trimmedName,
      phone: trimmedPhone,
      successDate: formatShortDate(selectedTs),
    })
    syncTabBar(this, 1)
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
