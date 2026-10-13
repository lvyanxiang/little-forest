Component({
  properties: {
    show: {
      type: Boolean,
      value: false,
    },
    remember: {
      type: Boolean,
      value: true,
    },
    title: { type: String, value: '' },
    intro: { type: String, value: '' },
    heading: { type: String, value: '' },
    items: { type: Array, value: [] },
    foot: { type: String, value: '' },
    confirmText: { type: String, value: '' },
    showRemember: { type: Boolean, value: true },
    showCancel: { type: Boolean, value: true },
  },

  methods: {
    onToggleRemember() {
      this.triggerEvent('rememberchange', { remember: !this.properties.remember })
    },
    onAgree() {
      this.triggerEvent('agree', { remember: this.properties.remember })
    },
    onClose() {
      this.triggerEvent('close')
    },
    noop() {},
  },
})
