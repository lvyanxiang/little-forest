import { ApiSlot, createBooking, fetchMyBookings, fetchSlots } from '../../utils/booking'
import { addDays, diffDays, formatFullDate, formatShortDate, formatWeekday, startOfToday, toDateKey, weekdayOf } from '../../utils/date'
import { getLayoutMetrics } from '../../utils/layout'
import { fetchStore, type StoreInfo } from '../../utils/store'
import { syncTabBar } from '../../utils/tab'
import { getSession } from '../../utils/session'
import { finishPrivacyAuthorization, openPrivacyContract } from '../../utils/privacy'
import { ensureWechatLogin, fetchWechatPhoneNumber } from '../../utils/auth'

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

function buildQuickDates(selectedTs: number, closedWeekdays: number[], quickDateDays: number): DateChip[] {
  const today = startOfToday()
  return Array.from({ length: quickDateDays }, (_, i) => {
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
      ? '#70726D'
      : fillPct >= 80
        ? '#B87C4C'
        : fillPct >= 50
          ? '#C4A44C'
          : '#70726D'
    const statusLabel = closed
      ? '该日闭馆'
      : isPast
        ? '已过时'
        : slot.isFull
          ? '已约满'
          : avail <= 2
            ? `仅剩 ${avail} 个名额`
            : `剩余 ${avail} 个名额`
    const statusColor = isFull || closed ? '#70726D' : avail <= 2 ? '#B87C4C' : '#70726D'
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
      cardBg: isSel ? '#EFEFEC' : isFull ? '#F1F1EF' : '#F7F7F5',
      cardBorder: isSel ? '#646660' : isFull ? '#E5E6E2' : '#C9CBC6',
      timeColor: isFull ? '#70726D' : '#242522',
      muted: '#70726D',
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
    closedWeekdays: [] as number[],
    showCalendar: false,
    showLoginConsent: false,
    showPhonePrompt: false,
    showPrivacy: false,
    gettingPhone: false,
    phoneRequestId: 0,
    phoneError: '',
    name: '',
    phone: '',
    noticeRead: false,
    privacyAgreed: false,
    noticeShake: false,
    fieldsReady: false,
    canSubmit: false,
    submitting: false,
    enteringForm: false,
    formUserId: '',
    successDate: '',
    pageBottom: 80,
    noticeHeading: '',
    noticeItems: [] as string[],
    noticeFoot: '',
    successNoticeLines: [] as string[],
    storeAddress: '',
    brandLogoUrl: '',
    uiText: {} as Record<string, string>,
    quickDateDays: 0, bookingAdvanceDays: 0,
    storeReady: false, storeLoading: true, storeError: '',
  },
  onLoad() {
    this.setData({ pageBottom: getLayoutMetrics().tabBarHeight })
  },
  onShow() {
    this.bootstrap()
    if (this.data.formUserId && this.data.formUserId !== getSession()?.user.id) {
      this.setData({ name: '', phone: '', noticeRead: false, privacyAgreed: false, fieldsReady: false, canSubmit: false, formUserId: '', step: 'pick', showPhonePrompt: false, gettingPhone: false, phoneError: '', phoneRequestId: this.data.phoneRequestId + 1 })
    }
    this.syncTabs()
    fetchMyBookings()
      .then(() => this.syncTabs())
      .catch(() => {})
  },
  syncTabs() {
    syncTabBar(this, 1, this.data.showCalendar || this.data.showLoginConsent || this.data.showPhonePrompt || this.data.showPrivacy)
  },
  onLoginConsentVisibility(event: WechatMiniprogram.CustomEvent<{ show: boolean }>) {
    this.setData({ showLoginConsent: event.detail.show })
    this.syncTabs()
  },
  async bootstrap() {
    this.setData({ storeLoading: true, storeError: '' })
    try {
      const store = await fetchStore()
      this.applyStore(store)
      if (this.data.step === 'pick') await this.refreshPick()
    } catch {
      this.setData({ storeError: '预约配置加载失败，请重试' })
    } finally { this.setData({ storeLoading: false }) }
  },
  applyStore(store: StoreInfo) {
    if (diffDays(this.data.selectedTs, startOfToday()) > store.bookingAdvanceDays) {
      this.setData({ selectedTs: startOfToday(), selectedSlot: null, selectedSlotLabel: '' })
    }
    const noticeChanged = this.data.noticeHeading !== store.noticeHeading || JSON.stringify(this.data.noticeItems) !== JSON.stringify(store.noticeItems) || this.data.noticeFoot !== store.noticeFoot
    const privacyChanged = this.data.uiText.bookingPurposeText !== store.uiText.bookingPurposeText || this.data.uiText.bookingConsentSuffix !== store.uiText.bookingConsentSuffix
    const noticeRead = !noticeChanged && this.data.noticeRead
    const privacyAgreed = !privacyChanged && this.data.privacyAgreed
    this.setData({
      closedWeekdays: store.closedWeekdays,
      noticeHeading: store.noticeHeading,
      noticeItems: store.noticeItems,
      noticeFoot: store.noticeFoot,
      successNoticeLines: store.successNoticeLines,
      storeAddress: store.address, brandLogoUrl: store.brandLogoUrl, uiText: store.uiText,
      quickDateDays: store.quickDateDays, bookingAdvanceDays: store.bookingAdvanceDays, storeReady: true,
      noticeRead, privacyAgreed,
      canSubmit: this.isFormReady(this.data.name, this.data.phone, noticeRead, privacyAgreed),
    })
  },
  async refreshPick() {
    if (!this.data.storeReady) return
    const { selectedTs, selectedSlot, closedWeekdays, quickDateDays, bookingAdvanceDays } = this.data
    const today = startOfToday()
    const isQuickDate = diffDays(selectedTs, today) >= 0 && diffDays(selectedTs, today) < quickDateDays
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
      quickDates: buildQuickDates(selectedTs, closedWeekdays, Math.min(quickDateDays, bookingAdvanceDays + 1)),
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
  async onNext() {
    const { selectedSlot, selectedTs, dayClosed, rawSlots } = this.data
    if (!this.data.storeReady || this.data.storeLoading || this.data.storeError || !selectedSlot || dayClosed || this.data.enteringForm) return
    const slot = rawSlots.find((item) => item.id === selectedSlot)
    if (!slot || slot.isFull || slot.isPast) return
    this.setData({ enteringForm: true })
    try {
      const session = await ensureWechatLogin(true)
      if (this.data.selectedSlot !== selectedSlot || this.data.selectedTs !== selectedTs || this.data.step !== 'pick') return
      const sameUser = this.data.formUserId === session.user.id
      const nickname = session.user.nickname
      const name = (sameUser ? this.data.name : '') || (nickname && !session.user.isDefaultNickname ? nickname : '')
      const phone = sameUser ? this.data.phone : ''
      const noticeRead = sameUser && this.data.noticeRead
      const privacyAgreed = sameUser && this.data.privacyAgreed
      this.setData({
        step: 'form', formUserId: session.user.id, name, phone, noticeRead, privacyAgreed,
        showPhonePrompt: !phone, phoneError: '',
        fieldsReady: this.isFieldsReady(name, phone),
        canSubmit: this.isFormReady(name, phone, noticeRead, privacyAgreed),
      })
      this.syncTabs()
    } catch (error) {
      wx.showToast({ title: error instanceof Error ? error.message : '微信登录失败', icon: 'none' })
    } finally { this.setData({ enteringForm: false }) }
  },
  onBackPick() {
    this.setData({ step: 'pick', showPhonePrompt: false, gettingPhone: false, phoneRequestId: this.data.phoneRequestId + 1 })
    this.syncTabs()
    this.refreshPick()
  },
  onOpenPrivacy() { openPrivacyContract() },
  onAgreePrivacy() {
    finishPrivacyAuthorization(true, 'agree-reserve-privacy')
    this.setData({ showPrivacy: false })
    this.syncTabs()
  },
  onRejectPrivacy() {
    finishPrivacyAuthorization(false)
    this.setData({ showPrivacy: false, showPhonePrompt: false })
    this.syncTabs()
  },
  onClosePhonePrompt() {
    if (this.data.gettingPhone) return
    this.setData({ showPhonePrompt: false })
    this.syncTabs()
  },
  async onGetPhoneNumber(event: WechatMiniprogram.CustomEvent<{ code?: string; errMsg?: string }>) {
    if (this.data.gettingPhone || this.data.step !== 'form') return
    if (!event.detail.code) {
      this.setData({ showPhonePrompt: false, phoneError: '未获取微信手机号，请手动填写。' })
      this.syncTabs()
      return
    }
    const session = getSession()
    if (!session || this.data.formUserId !== session.user.id) {
      wx.showToast({ title: '请重新登录后填写预约信息', icon: 'none' })
      return
    }
    const requestId = this.data.phoneRequestId + 1
    const phoneAtStart = this.data.phone
    this.setData({ gettingPhone: true, phoneError: '', phoneRequestId: requestId })
    try {
      const phone = await fetchWechatPhoneNumber(event.detail.code)
      if (this.data.phoneRequestId !== requestId || this.data.step !== 'form' || this.data.formUserId !== session.user.id || this.data.phone !== phoneAtStart) return
      this.setData({
        phone, showPhonePrompt: false,
        fieldsReady: this.isFieldsReady(this.data.name, phone),
        canSubmit: this.isFormReady(this.data.name, phone, this.data.noticeRead, this.data.privacyAgreed),
      })
    } catch (error) {
      if (this.data.phoneRequestId === requestId && this.data.formUserId === session.user.id) {
        this.setData({ showPhonePrompt: false, phoneError: error instanceof Error ? error.message : '微信手机号暂不可用，请手动填写。' })
      }
    } finally {
      if (this.data.phoneRequestId === requestId) this.setData({ gettingPhone: false })
      this.syncTabs()
    }
  },
  isFieldsReady(name: string, phone: string) {
    return Boolean(name.trim() && /^1\d{10}$/.test(phone.trim()))
  },
  isFormReady(name: string, phone: string, noticeRead: boolean, privacyAgreed: boolean) {
    return this.isFieldsReady(name, phone) && noticeRead && privacyAgreed
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
      canSubmit: this.isFormReady(name, this.data.phone, this.data.noticeRead, this.data.privacyAgreed),
    })
  },
  onPhoneInput(e: WechatMiniprogram.Input) {
    const phone = e.detail.value
    this.setData({
      phone,
      phoneError: '',
      fieldsReady: this.isFieldsReady(this.data.name, phone),
      canSubmit: this.isFormReady(this.data.name, phone, this.data.noticeRead, this.data.privacyAgreed),
    })
  },
  onToggleNotice() {
    const noticeRead = !this.data.noticeRead
    this.setData({
      noticeRead,
      noticeShake: false,
      canSubmit: this.isFormReady(this.data.name, this.data.phone, noticeRead, this.data.privacyAgreed),
    })
  },
  onTogglePrivacy() {
    const privacyAgreed = !this.data.privacyAgreed
    this.setData({
      privacyAgreed,
      canSubmit: this.isFormReady(this.data.name, this.data.phone, this.data.noticeRead, privacyAgreed),
    })
  },
  async onConfirm() {
    if (!this.data.storeReady || this.data.storeLoading || this.data.storeError) {
      wx.showToast({ title: '请先加载最新预约配置', icon: 'none' })
      return
    }
    const { selectedSlot, selectedTs, name, phone, noticeRead, privacyAgreed, submitting, dayClosed } = this.data
    const trimmedName = name.trim()
    const trimmedPhone = phone.trim()
    if (submitting) return
    if (this.data.formUserId !== getSession()?.user.id) {
      this.setData({ step: 'pick', name: '', phone: '', noticeRead: false, privacyAgreed: false, fieldsReady: false, canSubmit: false, formUserId: '' })
      wx.showToast({ title: '请重新登录后填写预约信息', icon: 'none' })
      return
    }
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
    if (!privacyAgreed) {
      wx.showToast({ title: '请阅读并同意隐私指引', icon: 'none' })
      wx.pageScrollTo({ selector: '#privacy-check', offsetTop: -80, duration: 240 })
      return
    }
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
      privacyAgreed: false,
      noticeShake: false,
      fieldsReady: false,
      canSubmit: false,
      submitting: false,
      formUserId: '',
      showPhonePrompt: false,
      gettingPhone: false,
      phoneError: '',
      phoneRequestId: this.data.phoneRequestId + 1,
    })
    this.syncTabs()
    this.refreshPick()
  },
  onUnload() {
    this.selectComponent('#login-consent')?.cancel()
    if (this.data.showPrivacy) finishPrivacyAuthorization(false)
    this.setData({ phoneRequestId: this.data.phoneRequestId + 1 })
    if (noticeShakeTimer) {
      clearTimeout(noticeShakeTimer)
      noticeShakeTimer = null
    }
  },
  noop() {},
})
