Component({
  data: {
    selected: 0,
    badge: 0,
    hidden: false,
    list: [
      {
        pagePath: '/pages/home/home',
        text: '首页',
        icon: '/assets/icon-home.svg',
        iconActive: '/assets/icon-home-active.svg',
      },
      {
        pagePath: '/pages/reserve/reserve',
        text: '预约',
        icon: '/assets/icon-reserve.svg',
        iconActive: '/assets/icon-reserve-active.svg',
      },
      {
        pagePath: '/pages/profile/profile',
        text: '我的',
        icon: '/assets/icon-profile.svg',
        iconActive: '/assets/icon-profile-active.svg',
      },
    ],
  },
  methods: {
    onSwitch(e: WechatMiniprogram.TouchEvent) {
      const path = String(e.currentTarget.dataset.path || '')
      if (!path) return
      wx.switchTab({ url: path })
    },
  },
})
