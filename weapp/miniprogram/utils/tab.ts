import { getUpcomingCount } from './booking'

type TabBarHost = WechatMiniprogram.Page.TrivialInstance & {
  getTabBar?: () => WechatMiniprogram.Component.TrivialInstance
}

export function syncTabBar(ctx: WechatMiniprogram.Page.TrivialInstance, selected: number, hidden = false) {
  const getter = (ctx as TabBarHost).getTabBar
  if (typeof getter !== 'function') return
  const tabBar = getter.call(ctx)
  if (!tabBar) return
  tabBar.setData({
    selected,
    badge: getUpcomingCount(),
    hidden,
  })
}
