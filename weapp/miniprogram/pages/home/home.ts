import { getHomeHeroHeight, getLayoutMetrics } from '../../utils/layout'
import { fetchStore, FALLBACK_STORE, openStoreMap, type StoreInfo } from '../../utils/store'
import { fetchMyBookings } from '../../utils/booking'
import { syncTabBar } from '../../utils/tab'

Page({
  data: {
    heroHeight: 260,
    pageBottom: 80,
    homeNoticeText: FALLBACK_STORE.homeNoticeText,
    store: FALLBACK_STORE,
    features: [
      { icon: '📚', title: '开放书架', desc: '自由取阅，慢慢翻到想看的那一本' },
      { icon: '🪑', title: '独立座位', desc: '安静角落，适合一个人坐下来读' },
      { icon: '🖼', title: '店内陈列', desc: '画作与物件和书放在一起' },
      { icon: '🌿', title: '小空间', desc: '灯光偏暗，待一会儿就静下来' },
    ],
    scenes: [
      { src: '/assets/gallery/neon.jpg', label: '小森林' },
      { src: '/assets/gallery/shelf.jpg', label: '书架' },
      { src: '/assets/gallery/light.jpg', label: '一格书' },
      { src: '/assets/gallery/desk.jpg', label: '阅读位' },
      { src: '/assets/gallery/nook.jpg', label: '陈列' },
      { src: '/assets/gallery/orchid.jpg', label: '角落' },
      { src: '/assets/gallery/art.jpg', label: '墙面' },
    ],
  },
  onLoad() {
    const metrics = getLayoutMetrics()
    this.setData({
      heroHeight: getHomeHeroHeight(metrics),
      pageBottom: metrics.tabBarHeight + 16,
    })
    this.loadStore()
  },
  onShow() {
    syncTabBar(this, 0)
    fetchMyBookings()
      .then(() => syncTabBar(this, 0))
      .catch(() => {})
  },
  async loadStore() {
    try {
      const store = await fetchStore()
      this.applyStore(store)
    } catch {
      this.applyStore(FALLBACK_STORE)
    }
  },
  applyStore(store: StoreInfo) {
    this.setData({
      store,
      homeNoticeText: store.homeNoticeText,
    })
  },
  onReserve() {
    wx.switchTab({ url: '/pages/reserve/reserve' })
  },
  onCall() {
    wx.makePhoneCall({ phoneNumber: this.data.store.phone })
  },
  onOpenMap() {
    openStoreMap(this.data.store)
  },
  onPreviewScene(e: WechatMiniprogram.TouchEvent) {
    const current = String(e.currentTarget.dataset.src || '')
    wx.previewImage({
      current,
      urls: this.data.scenes.map((item) => item.src),
    })
  },
})
