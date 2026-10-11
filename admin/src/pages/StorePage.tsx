import { useEffect, useState } from 'react'
import { api, type StorePayload } from '../api'

const WEEKDAYS = [
  { value: 0, label: '周日' }, { value: 1, label: '周一' },
  { value: 2, label: '周二' }, { value: 3, label: '周三' },
  { value: 4, label: '周四' }, { value: 5, label: '周五' },
  { value: 6, label: '周六' },
]

const EMPTY: StorePayload = {
  id: 1, address: '', closedWeekdays: [], noticeHeading: '',
  noticeItems: [], noticeFoot: '', homeHeroText: '',
  homeHeroImageUrl: '', successNoticeLines: [],
}

export function StorePage() {
  const [form, setForm] = useState<StorePayload>(EMPTY)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.getStore().then(setForm).catch((err: Error) => setMessage(err.message))
  }, [])

  function patch<K extends keyof StorePayload>(key: K, value: StorePayload[K]) {
    setForm((previous) => ({ ...previous, [key]: value }))
  }

  function toggleClosed(day: number) {
    patch('closedWeekdays', form.closedWeekdays.includes(day)
      ? form.closedWeekdays.filter((item) => item !== day)
      : [...form.closedWeekdays, day])
  }

  async function onSave() {
    setSaving(true)
    setMessage('')
    try {
      const saved = await api.saveStore({
        address: form.address,
        closedWeekdays: form.closedWeekdays,
      })
      setForm(saved)
      setMessage('预约设置已保存')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-full max-w-3xl">
      <p className="mb-6 mt-0 text-sm leading-6 text-bark">地址显示在预约成功页；闭馆星期用于预约页的日期选择。</p>
      <div className="grid gap-4">
        <label className="grid gap-1.5">
          <span className="text-sm text-bark">到店地址</span>
          <textarea className="min-h-[90px] rounded-lg border border-line bg-white px-3 py-2" value={form.address} onChange={(event) => patch('address', event.target.value)} />
        </label>
        <div className="grid gap-2">
          <span className="text-sm text-bark">闭馆星期</span>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((day) => (
              <button key={day.value} type="button" className={`rounded-full px-3 py-1.5 text-sm ${form.closedWeekdays.includes(day.value) ? 'bg-forest text-cream' : 'bg-cream text-bark'}`} onClick={() => toggleClosed(day.value)}>
                {day.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <button type="button" className="rounded-[10px] bg-forest px-4 py-2 text-cream disabled:opacity-60" onClick={onSave} disabled={saving}>
          {saving ? '保存中…' : '保存预约设置'}
        </button>
        <span className={message.includes('已保存') ? 'text-moss' : 'text-[#B87C4C]'}>{message}</span>
      </div>
    </div>
  )
}
