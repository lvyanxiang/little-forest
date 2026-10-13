import { fetchMyBookings } from '../../utils/booking'
import { createEmptyStore, fetchStore } from '../../utils/store'
import type { StoreInfo } from '../../utils/store'
import { syncTabBar } from '../../utils/tab'

Page({
  data: {
    heroImage: '',
    uiText: {} as Record<string, string>,
    storeReady: false, storeLoading: true, storeError: '',
    heroLines: [] as string[],
    store: createEmptyStore(),
    showEntryNotice: false,
  },
  onShow() {
    this.loadStore()
    syncTabBar(this, 0, false)
    fetchMyBookings()
      .then(() => syncTabBar(this, 0, false))
      .catch(() => {})
  },
  async loadStore() {
    this.setData({ storeLoading: true, storeError: '' })
    try {
      this.applyStore(await fetchStore())
    } catch {
      this.setData({ storeError: '门店信息加载失败，请重试' })
    } finally { this.setData({ storeLoading: false }) }
  },
  applyStore(store: StoreInfo) {
    wx.setNavigationBarTitle({ title: store.name })
    this.setData({
      store,
      heroImage: store.homeHeroImageUrl,
      uiText: store.uiText, storeReady: true,
      showEntryNotice: !this.data.storeReady,
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
