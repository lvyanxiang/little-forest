import { NOTICE_ITEMS } from '../../utils/notice'

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
    title: { type: String, value: '预约须知' },
    intro: { type: String, value: '请阅读以下内容。点击「同意并继续」即表示同意全部条款。' },
    heading: { type: String, value: '' },
    items: { type: Array, value: [] },
    foot: { type: String, value: '' },
    confirmText: { type: String, value: '同意并继续' },
    showRemember: { type: Boolean, value: true },
    showCancel: { type: Boolean, value: true },
  },
  data: { fallbackItems: NOTICE_ITEMS },
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
