import { useState } from 'react'
import { BookingsPage } from './pages/BookingsPage'
import { NoticePage } from './pages/NoticePage'
import { SlotsPage } from './pages/SlotsPage'
import { StorePage } from './pages/StorePage'
import { HomePage } from './pages/HomePage'

const MENUS = [
  { id: 'home', label: '首页设置' },
  { id: 'store', label: '门店信息' },
  { id: 'slots', label: '时段与名额' },
  { id: 'notice', label: '预约须知' },
  { id: 'bookings', label: '预约记录' },
] as const

type MenuId = (typeof MENUS)[number]['id']

function App() {
  const [menu, setMenu] = useState<MenuId>('home')

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
