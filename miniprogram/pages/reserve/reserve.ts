import { STORE_HOURS, addBooking, getSlotAvailability } from '../../utils/booking'
import { addDays, diffDays, formatFullDate, formatShortDate, formatWeekday, startOfToday } from '../../utils/date'
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

function buildSlots(selectedTs: number, selectedSlot: number | null): SlotView[] {
  return STORE_HOURS.map((slot) => {
    const { booked, avail, isFull, fillPct } = getSlotAvailability(selectedTs, slot.id, slot.max)
    const isSel = selectedSlot === slot.id
    const barColor = isSel
      ? '#8FAF6B'
      : isFull
        ? '#8A7558'
        : fillPct >= 80
          ? '#B87C4C'
          : fillPct >= 50
            ? '#C4A44C'
            : '#5C7A3A'
    const statusLabel = isFull ? '已约满' : avail <= 2 ? `仅剩 ${avail} 个名额` : `剩余 ${avail} 个名额`
    const statusColor = isSel ? '#8FAF6B' : isFull ? '#8A7558' : avail <= 2 ? '#B87C4C' : '#8A7558'
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
      cardBg: isSel ? '#1E3A1E' : isFull ? '#F0EBE0' : '#F5EFE0',
      cardBorder: isSel ? 'transparent' : isFull ? '#D8CFC4' : '#C4B49A',
      timeColor: isSel ? '#F5EFE0' : isFull ? '#8A7558' : '#1E3A1E',
      muted: isSel ? '#8FAF6B' : '#8A7558',
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
    people: 1,
    maxPeople: 1,
    name: '',
    phone: '',
    canSubmit: false,
    successPeople: '',
    successDate: '',
  },
  onLoad() {
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
    const { selectedSlot, selectedTs } = this.data
    if (!selectedSlot) return
    const slot = STORE_HOURS.find((item) => item.id === selectedSlot)
    if (!slot) return
    const { avail } = getSlotAvailability(selectedTs, slot.id, slot.max)
    this.setData({
      step: 'form',
      people: 1,
      maxPeople: Math.max(1, avail),
      canSubmit: Boolean(this.data.name && this.data.phone),
    })
  },
  onBackPick() {
    this.setData({ step: 'pick' })
    this.refreshPick()
  },
  onMinus() {
    const people = Math.max(1, this.data.people - 1)
    this.setData({ people })
  },
  onPlus() {
    const people = Math.min(this.data.maxPeople, this.data.people + 1)
    this.setData({ people })
  },
  onNameInput(e: WechatMiniprogram.Input) {
    const name = e.detail.value
    this.setData({
      name,
      canSubmit: Boolean(name.trim() && this.data.phone.trim()),
    })
  },
  onPhoneInput(e: WechatMiniprogram.Input) {
    const phone = e.detail.value
    this.setData({
      phone,
      canSubmit: Boolean(this.data.name.trim() && phone.trim()),
    })
  },
  onConfirm() {
    const { selectedSlot, selectedTs, name, phone, people } = this.data
    const trimmedName = name.trim()
    const trimmedPhone = phone.trim()
    if (!selectedSlot || !trimmedName || !trimmedPhone) return
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
      people,
      name: trimmedName,
      phone: trimmedPhone,
      status: 'confirmed',
    })
    this.setData({
      step: 'success',
      name: trimmedName,
      phone: trimmedPhone,
      successPeople: `${people} 人`,
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
      people: 1,
      canSubmit: false,
    })
    this.refreshPick()
  },
})
