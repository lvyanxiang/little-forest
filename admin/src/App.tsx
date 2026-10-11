import { useEffect, useState } from 'react'
import { BookingsPage } from './pages/BookingsPage'
import { NoticePage } from './pages/NoticePage'
import { SlotsPage } from './pages/SlotsPage'
import { StorePage } from './pages/StorePage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { api, AUTH_EXPIRED_EVENT, getAdminToken, type AdminUser } from './api'

const MENUS = [
  { id: 'home', label: '首页设置' },
  { id: 'store', label: '预约设置' },
  { id: 'slots', label: '时段与名额' },
  { id: 'notice', label: '预约须知' },
  { id: 'bookings', label: '预约记录' },
] as const

type MenuId = (typeof MENUS)[number]['id']

function App() {
  const [menu, setMenu] = useState<MenuId>('home')
  const [user, setUser] = useState<AdminUser | null>(null)
  const [checking, setChecking] = useState(() => Boolean(getAdminToken()))
  const [authMessage, setAuthMessage] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')

  useEffect(() => {
    let active = true
    function expired() {
      setUser(null)
      setMenu('home')
      setAuthMessage('登录已过期，请重新登录')
    }
    window.addEventListener(AUTH_EXPIRED_EVENT, expired)
    if (getAdminToken()) {
      api.me()
        .then((current) => { if (active) setUser(current) })
        .catch((err: Error) => { if (active) setAuthMessage(err.message) })
        .finally(() => { if (active) setChecking(false) })
    }
    return () => {
      active = false
      window.removeEventListener(AUTH_EXPIRED_EVENT, expired)
    }
  }, [])

  async function logout() {
    setLoggingOut(true)
    setLogoutError('')
    try {
      await api.logout()
      setUser(null)
      setMenu('home')
      setAuthMessage('')
    } catch (err) {
      setLogoutError(err instanceof Error ? err.message : '退出失败，请重试')
    } finally {
      setLoggingOut(false)
    }
  }

  if (checking) {
    return <main className="flex min-h-dvh items-center justify-center bg-cream text-bark" role="status">正在确认登录状态…</main>
  }

  if (!user) {
    return <LoginPage message={authMessage} onLogin={(current) => {
      setUser(current)
      setAuthMessage('')
      setLogoutError('')
    }} />
  }

  return (
    <div className="flex min-h-dvh flex-col bg-paper text-forest md:flex-row">
      <aside className="sticky top-0 z-20 bg-forest px-4 py-4 text-cream md:flex md:h-auto md:w-60 md:shrink-0 md:flex-col md:px-5 md:py-8">
        <div className="mb-3 md:mb-8">
          <p className="m-0 text-lg font-semibold md:mb-2 md:text-xl">小森林书店</p>
          <p className="mt-0 hidden text-[13px] text-sage md:mb-0 md:block">管理后台</p>
        </div>
        <nav className="-mx-1 flex gap-2 overflow-x-auto pb-1 md:mx-0 md:flex-col md:overflow-visible md:pb-0">
          {MENUS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`shrink-0 rounded-[10px] px-3 py-2 text-left text-sm text-cream md:py-2.5 md:text-base ${
                menu === item.id ? 'bg-leaf' : 'bg-transparent hover:bg-leaf'
              }`}
              onClick={() => setMenu(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="mt-4 border-t border-leaf pt-4 md:mt-auto md:pt-5">
          <p className="mb-2 mt-0 break-all text-xs text-sage">{user.email}</p>
          <button
            type="button"
            onClick={logout}
            disabled={loggingOut}
            className="rounded-lg border border-sage px-3 py-2 text-sm text-cream hover:bg-leaf disabled:opacity-60"
          >
            {loggingOut ? '退出中…' : '退出登录'}
          </button>
          {logoutError ? <p role="alert" className="mb-0 text-xs text-sage">{logoutError}</p> : null}
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-10 lg:px-12">
        <h1 className="mb-2 mt-0 text-2xl font-semibold md:text-[28px]">
          {MENUS.find((item) => item.id === menu)?.label}
        </h1>
        {menu === 'home' ? <HomePage /> : null}
        {menu === 'store' ? <StorePage /> : null}
        {menu === 'slots' ? <SlotsPage /> : null}
        {menu === 'notice' ? <NoticePage /> : null}
        {menu === 'bookings' ? <BookingsPage /> : null}
      </main>
    </div>
  )
}

export default App
