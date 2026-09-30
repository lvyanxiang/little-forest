import { getHomeHeroHeight, getLayoutMetrics } from '../../utils/layout'
import { HOME_NOTICE_TEXT } from '../../utils/notice'
import { STORE, openStoreMap } from '../../utils/store'
import { syncTabBar } from '../../utils/tab'

Page({
  data: {
    heroHeight: 260,
    pageBottom: 80,
    homeNoticeText: HOME_NOTICE_TEXT,
    store: STORE,
    features: [
      { icon: '🌿', title: '自然光阅读区', desc: '大面积落地窗，让阳光与书页同行' },
      { icon: '☕', title: '手冲咖啡吧台', desc: '精选单品咖啡，阅读伴侣' },
      { icon: '📚', title: '策展式陈列', desc: '每月主题书单，由书店主理人精选' },
      { icon: '🎋', title: '竹林包厢', desc: '独立小空间，适合沉浸阅读' },
    ],
    books: [
      { title: '瓦尔登湖', author: '梭罗', color: '#3D5C2D' },
      { title: '小王子', author: '圣埃克苏佩里', color: '#5C3D2D' },
      { title: '挪威的森林', author: '村上春树', color: '#2D3D5C' },
      { title: '百年孤独', author: '马尔克斯', color: '#5C4D2D' },
    ],
    events: [
      { month: '10月', day: '12', weekday: '周六', title: '秋日读书会', desc: '围炉共读《瓦尔登湖》，主理人带读', tag: '读书会' },
      { month: '10月', day: '19', weekday: '周六', title: '作者签售 · 林清玄', desc: '散文新作《山中静默》首发签售', tag: '签售' },
      { month: '10月', day: '26', weekday: '周六', title: '手作书签工作坊', desc: '压花·烫金·手绑装帧，限20人', tag: '工作坊' },
    ],
  },
  onLoad() {
    const metrics = getLayoutMetrics()
    this.setData({
      heroHeight: getHomeHeroHeight(metrics),
      pageBottom: metrics.tabBarHeight + 16,
    })
  },
  onShow() {
    syncTabBar(this, 0)
  },
  onReserve() {
    wx.switchTab({ url: '/pages/reserve/reserve' })
  },
  onCall() {
    wx.makePhoneCall({ phoneNumber: STORE.phone })
  },
  onOpenMap() {
    openStoreMap()
  },
})
