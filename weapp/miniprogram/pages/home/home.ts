import { fetchMyBookings } from '../../utils/booking'
import { FALLBACK_STORE, fetchStore, type StoreInfo } from '../../utils/store'
import { syncTabBar } from '../../utils/tab'

Page({
  data: {
    heroImage: '/assets/home-reading.jpg',
    heroLines: FALLBACK_STORE.homeHeroText.split('\n'),
    store: FALLBACK_STORE,
    showEntryNotice: true,
  },
  onLoad() {
    this.loadStore()
  },
  onShow() {
    syncTabBar(this, 0, this.data.showEntryNotice)
    fetchMyBookings()
      .then(() => syncTabBar(this, 0, this.data.showEntryNotice))
      .catch(() => {})
  },
  async loadStore() {
    try {
      this.applyStore(await fetchStore())
    } catch {
      this.applyStore(FALLBACK_STORE)
    }
  },
  applyStore(store: StoreInfo) {
    this.setData({
      store,
      heroImage: store.homeHeroImageUrl || '/assets/home-reading.jpg',
      heroLines: store.homeHeroText.split('\n').map((line) => line.trim()).filter(Boolean),
    })
  },
  onReserve() {
    wx.switchTab({ url: '/pages/reserve/reserve' })
  },
  onDismissNotice() {
    this.setData({ showEntryNotice: false })
    syncTabBar(this, 0, false)
  },
})
