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
  },
  data: {
    items: NOTICE_ITEMS,
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
