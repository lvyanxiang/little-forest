export interface LayoutMetrics {
  statusBarHeight: number
  navBarHeight: number
  headerHeight: number
  menuRight: number
  menuHeight: number
  safeBottom: number
  windowWidth: number
  windowHeight: number
  tabBarHeight: number
}

export function getLayoutMetrics(): LayoutMetrics {
  const win = wx.getWindowInfo()
  const menu = wx.getMenuButtonBoundingClientRect()
  const windowWidth = win.windowWidth || 375
  const windowHeight = win.windowHeight || 667
  const statusBarHeight = win.statusBarHeight || 20
  const menuTop = menu.top > 0 ? menu.top : statusBarHeight + 4
  const menuHeight = menu.height > 0 ? menu.height : 32
  const navBarHeight = Math.max((menuTop - statusBarHeight) * 2 + menuHeight, menuHeight + 8)
  const headerHeight = statusBarHeight + navBarHeight
  const safeBottom = win.safeArea ? Math.max(0, windowHeight - win.safeArea.bottom) : 0
  const tabBarInner = 56
  const tabBarHeight = tabBarInner + Math.max(safeBottom, 8)

  return {
    statusBarHeight,
    navBarHeight,
    headerHeight,
    menuRight: menu.left > 0 ? Math.max(12, windowWidth - menu.left + 8) : 96,
    menuHeight,
    safeBottom,
    windowWidth,
    windowHeight,
    tabBarHeight,
  }
}

export function getHomeHeroHeight(metrics: LayoutMetrics): number {
  const copyBlock = Math.round(metrics.windowWidth * 0.42)
  return metrics.headerHeight + Math.max(copyBlock, 140)
}
