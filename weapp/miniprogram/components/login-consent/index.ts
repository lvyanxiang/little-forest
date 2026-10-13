import { openPrivacyContract } from '../../utils/privacy'

// Keep the consent within this login attempt; a new attempt starts unchecked.
const pending = new WeakMap<object, { promise: Promise<boolean>; resolve: (agreed: boolean) => void }>()
const feedbackTimers = new WeakMap<object, ReturnType<typeof setTimeout>>()

function clearFeedbackTimer(owner: object) {
  const timer = feedbackTimers.get(owner)
  if (timer) clearTimeout(timer)
  feedbackTimers.delete(owner)
}

Component({
  properties: { uiText: { type: Object, value: {} } },
  data: { show: false, checked: false, viewingPolicy: false, consentShake: false, errorText: '' },
  lifetimes: {
    detached() {
      clearFeedbackTimer(this)
      const attempt = pending.get(this)
      pending.delete(this)
      attempt?.resolve(false)
    },
  },
  pageLifetimes: {
    hide() { if (!this.data.viewingPolicy) this.cancel() },
    show() { this.setData({ viewingPolicy: false }) },
  },
  methods: {
    requestConsent(): Promise<boolean> {
      const current = pending.get(this)
      if (current) return current.promise
      let finish!: (agreed: boolean) => void
      const promise = new Promise<boolean>((resolve) => { finish = resolve })
      pending.set(this, { promise, resolve: finish })
      this.clearFeedback()
      this.setData({ show: true, checked: false, viewingPolicy: false })
      this.triggerEvent('visibilitychange', { show: true })
      return promise
    },
    async onOpenPrivacy() {
      const attempt = pending.get(this)
      this.setData({ viewingPolicy: true })
      const opened = await openPrivacyContract()
      if (attempt && pending.get(this) === attempt) {
        if (opened) {
          this.clearFeedback()
        } else {
          this.setData({ viewingPolicy: false })
        }
      }
    },
    onToggle() {
      this.clearFeedback()
      this.setData({ checked: !this.data.checked })
    },
    onAgree() {
      if (!pending.has(this)) return
      if (!this.data.checked) { this.shakeRequired(); return }
      this.finish(true)
    },
    clearFeedback() {
      clearFeedbackTimer(this)
      this.setData({ consentShake: false, errorText: '' })
    },
    shakeRequired() {
      this.clearFeedback()
      const attempt = pending.get(this)
      this.setData({ errorText: this.properties.uiText.loginCheckRequired })
      wx.nextTick(() => {
        if (!attempt || pending.get(this) !== attempt) return
        if (this.data.checked) return
        this.setData({ consentShake: true })
        wx.vibrateShort({ type: 'medium' })
        clearFeedbackTimer(this)
        feedbackTimers.set(this, setTimeout(() => {
          feedbackTimers.delete(this)
          if (pending.get(this) === attempt) this.setData({ consentShake: false })
        }, 520))
      })
    },
    cancel() { this.finish(false) },
    finish(agreed: boolean) {
      const attempt = pending.get(this)
      if (!attempt) return
      this.clearFeedback()
      pending.delete(this)
      this.setData({ show: false, checked: false, viewingPolicy: false })
      this.triggerEvent('visibilitychange', { show: false })
      attempt.resolve(agreed)
    },
    noop() {},
  },
})
