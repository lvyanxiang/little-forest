Component({
  properties: {
    title: {
      type: String,
      value: '',
    },
  },
  data: {
    statusBarHeight: 20,
  },
  lifetimes: {
    attached() {
      const info = wx.getWindowInfo()
      this.setData({
        statusBarHeight: info.statusBarHeight || 20,
      })
    },
  },
})
