import { useEffect, useState } from 'react'
import { api, type BookingPayload } from '../api'

export function BookingsPage() {
  const [date, setDate] = useState('')
  const [rows, setRows] = useState<BookingPayload[]>([])
  const [message, setMessage] = useState('')

  async function reload(nextDate = date) {
    const list = await api.listBookings(nextDate || undefined)
    setRows(list)
  }

  useEffect(() => {
    reload().catch((err: Error) => setMessage(err.message))
  }, [])

  return (
    <div className="w-full max-w-5xl">
      <p className="mb-6 mt-0 text-sm leading-6 text-bark md:text-base">
        列表里的时段是预约当时的快照。后台后来改时间，这里和用户「我的预约」仍显示原来的点。
      </p>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <input
          type="date"
          className="w-full rounded-lg border border-line bg-white px-3 py-2 sm:w-auto"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-[10px] bg-forest px-3.5 py-2 text-cream"
            onClick={() => reload().catch((err: Error) => setMessage(err.message))}
          >
            筛选
          </button>
          <button
            type="button"
            className="rounded-[10px] bg-cream px-3.5 py-2 text-forest"
            onClick={() => {
              setDate('')
              reload('').catch((err: Error) => setMessage(err.message))
            }}
          >
            查看全部
          </button>
        </div>
        <span className="text-[#B87C4C]">{message}</span>
      </div>
      <div className="grid gap-3 md:hidden">
        {rows.length === 0 ? (
          <p className="rounded-xl border border-line bg-white px-4 py-8 text-center text-bark">暂无预约</p>
        ) : (
          rows.map((row) => (
            <article key={row.id} className="rounded-xl border border-line bg-white p-4 text-sm">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-medium">{row.date}</span>
                <span>{row.status === 'cancelled' ? '已取消' : '已确认'}</span>
              </div>
              <p className="m-0 text-bark">{row.slotLabel}</p>
              <p className="mt-2 mb-0">
                {row.name} · {row.phone} · {row.people} 人
              </p>
            </article>
          ))
        )}
      </div>
      <div className="hidden overflow-x-auto rounded-xl border border-line bg-white md:block">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead className="bg-cream text-bark">
            <tr>
              <th className="px-4 py-3 font-medium">日期</th>
              <th className="px-4 py-3 font-medium">时段快照</th>
              <th className="px-4 py-3 font-medium">姓名</th>
              <th className="px-4 py-3 font-medium">手机</th>
              <th className="px-4 py-3 font-medium">人数</th>
              <th className="px-4 py-3 font-medium">状态</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="px-4 py-3">{row.date}</td>
                <td className="px-4 py-3">{row.slotLabel}</td>
                <td className="px-4 py-3">{row.name}</td>
                <td className="px-4 py-3">{row.phone}</td>
                <td className="px-4 py-3">{row.people}</td>
                <td className="px-4 py-3">{row.status === 'cancelled' ? '已取消' : '已确认'}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-bark" colSpan={6}>
                  暂无预约
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
