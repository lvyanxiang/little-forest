import { getLayoutMetrics } from '../../utils/layout'

Component({
  properties: {
    title: {
      type: String,
      value: '',
    },
    overlay: {
      type: Boolean,
      value: false,
    },
  },
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    menuRight: 96,
    menuHeight: 32,
  },
  lifetimes: {
    attached() {
      const info = getLayoutMetrics()
      this.setData({
        statusBarHeight: info.statusBarHeight,
        navBarHeight: info.navBarHeight,
        menuRight: info.menuRight,
        menuHeight: info.menuHeight,
      })
    },
  },
})
