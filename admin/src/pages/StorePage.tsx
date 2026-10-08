import { useEffect, useState } from 'react'
import { api, type StorePayload } from '../api'

const WEEKDAYS = [
  { value: 0, label: '周日' }, { value: 1, label: '周一' },
  { value: 2, label: '周二' }, { value: 3, label: '周三' },
  { value: 4, label: '周四' }, { value: 5, label: '周五' },
  { value: 6, label: '周六' },
]

const EMPTY: StorePayload = {
  id: 1, name: '', address: '', latitude: 31.22048, longitude: 121.42516,
  phone: '', phoneDisplay: '', hours: '', closedWeekdays: [], noticeHeading: '',
  noticeItems: [], noticeFoot: '', homeNoticeText: '', homeHeroText: '',
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
        name: form.name,
        address: form.address,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        phone: form.phone,
        hours: form.hours,
        closedWeekdays: form.closedWeekdays,
      })
      setForm(saved)
      setMessage('门店信息已保存')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-full max-w-3xl">
      <div className="grid gap-4">
        <label className="grid gap-1.5">
          <span className="text-sm text-bark">店名</span>
          <input className="rounded-lg border border-line bg-white px-3 py-2" value={form.name} onChange={(event) => patch('name', event.target.value)} />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm text-bark">电话</span>
          <input className="rounded-lg border border-line bg-white px-3 py-2" value={form.phone} onChange={(event) => patch('phone', event.target.value)} />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm text-bark">营业时间文案</span>
          <input className="rounded-lg border border-line bg-white px-3 py-2" value={form.hours} onChange={(event) => patch('hours', event.target.value)} />
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
          {saving ? '保存中…' : '保存门店信息'}
        </button>
        <span className={message.includes('已保存') ? 'text-moss' : 'text-[#B87C4C]'}>{message}</span>
      </div>
    </div>
  )
}
