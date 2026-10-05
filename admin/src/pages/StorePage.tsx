import { useEffect, useRef, useState } from 'react'
import { api, type StorePayload } from '../api'
import {
  formatHistoryTime,
  loadLocationHistory,
  rememberLocation,
  removeLocationHistory,
  type LocationHistoryItem,
} from '../locationHistory'
import { LocationMap } from './LocationMap'

const WEEKDAYS = [
  { value: 0, label: '周日' },
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
]

const EMPTY: StorePayload = {
  id: 1,
  name: '',
  address: '',
  latitude: 31.22048,
  longitude: 121.42516,
  phone: '',
  phoneDisplay: '',
  hours: '',
  closedWeekdays: [],
  noticeHeading: '',
  noticeItems: [],
  noticeFoot: '',
  homeNoticeText: '',
  successNoticeLines: [],
}

const ADDRESS_WAIT = 800
const COORDS_WAIT = 600

export function StorePage() {
  const [form, setForm] = useState<StorePayload>(EMPTY)
  const [message, setMessage] = useState('')
  const [geoHint, setGeoHint] = useState('')
  const [saving, setSaving] = useState(false)
  const [locating, setLocating] = useState(false)
  const [quotaBlocked, setQuotaBlocked] = useState(false)
  const [history, setHistory] = useState<LocationHistoryItem[]>([])

  const loadedRef = useRef(false)
  const skipAddressRef = useRef(false)
  const skipCoordsRef = useRef(false)
  const quotaBlockedRef = useRef(false)
  const geoGenRef = useRef(0)

  useEffect(() => {
    quotaBlockedRef.current = quotaBlocked
  }, [quotaBlocked])

  useEffect(() => {
    setHistory(loadLocationHistory())
    api
      .getStore()
      .then((store) => {
        skipAddressRef.current = true
        skipCoordsRef.current = true
        setForm(store)
        loadedRef.current = true
        setHistory((prev) => {
          if (prev.length > 0) return prev
          return rememberLocation({
            address: store.address,
            latitude: store.latitude,
            longitude: store.longitude,
          })
        })
      })
      .catch((err: Error) => setMessage(err.message))
  }, [])

  function patch<K extends keyof StorePayload>(key: K, value: StorePayload[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function markQuota(text: string) {
    if (text.includes('用完') || text.includes('上限') || text.includes('配额')) {
      setQuotaBlocked(true)
    }
    setGeoHint(text)
  }

  function applyLocation(item: Pick<LocationHistoryItem, 'address' | 'latitude' | 'longitude'>) {
    setForm((prev) => ({
      ...prev,
      address: item.address,
      latitude: item.latitude,
      longitude: item.longitude,
    }))
  }

  function applyHistory(item: LocationHistoryItem) {
    geoGenRef.current += 1
    skipAddressRef.current = true
    skipCoordsRef.current = true
    applyLocation(item)
    setGeoHint('已套用历史定位，保存后才会更新小程序导航')
  }

  async function locateByAddress(address: string) {
    const text = address.trim()
    if (!text) {
      setGeoHint('请先填写地址')
      return
    }
    if (quotaBlockedRef.current) {
      setGeoHint('今日配额已用完，请从历史记录里选，或手改坐标后保存')
      return
    }
    const gen = ++geoGenRef.current
    setLocating(true)
    setGeoHint('正在根据地址定位…')
    try {
      const point = await api.geocodeAddress(text)
      if (gen !== geoGenRef.current) return
      skipCoordsRef.current = true
      applyLocation({ address: text, latitude: point.latitude, longitude: point.longitude })
      setHistory(rememberLocation({ address: text, latitude: point.latitude, longitude: point.longitude }))
      setGeoHint('已根据地址更新地图。保存后才会更新小程序导航')
    } catch (err) {
      if (gen !== geoGenRef.current) return
      markQuota(err instanceof Error ? err.message : '定位失败')
    } finally {
      if (gen === geoGenRef.current) setLocating(false)
    }
  }

  async function locateByMap(latitude: number, longitude: number) {
    if (quotaBlockedRef.current) {
      setGeoHint('今日配额已用完，地址请手改，或从历史记录里选')
      return
    }
    const gen = ++geoGenRef.current
    setLocating(true)
    setGeoHint('正在根据地图更新地址…')
    try {
      const result = await api.reverseGeocode(latitude, longitude)
      if (gen !== geoGenRef.current) return
      skipAddressRef.current = true
      applyLocation({ address: result.address, latitude, longitude })
      setHistory(rememberLocation({ address: result.address, latitude, longitude }))
      setGeoHint('已根据地图更新地址。保存后才会更新小程序导航')
    } catch (err) {
      if (gen !== geoGenRef.current) return
      markQuota(err instanceof Error ? err.message : '反查失败，可手改地址')
    } finally {
      if (gen === geoGenRef.current) setLocating(false)
    }
  }

  useEffect(() => {
    if (!loadedRef.current) return
    if (skipAddressRef.current) {
      skipAddressRef.current = false
      return
    }
    const address = form.address.trim()
    if (!address) return
    const timer = window.setTimeout(() => {
      void locateByAddress(address)
    }, ADDRESS_WAIT)
    return () => window.clearTimeout(timer)
  }, [form.address])

  useEffect(() => {
    if (!loadedRef.current) return
    if (skipCoordsRef.current) {
      skipCoordsRef.current = false
      return
    }
    const latitude = Number(form.latitude)
    const longitude = Number(form.longitude)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return
    const timer = window.setTimeout(() => {
      void locateByMap(latitude, longitude)
    }, COORDS_WAIT)
    return () => window.clearTimeout(timer)
  }, [form.latitude, form.longitude])

  function toggleClosed(day: number) {
    const next = form.closedWeekdays.includes(day)
      ? form.closedWeekdays.filter((item) => item !== day)
      : [...form.closedWeekdays, day]
    patch('closedWeekdays', next)
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
      skipAddressRef.current = true
      skipCoordsRef.current = true
      setForm(saved)
      setHistory(
        rememberLocation({
          address: saved.address,
          latitude: saved.latitude,
          longitude: saved.longitude,
        }),
      )
      setMessage('门店信息已保存')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-full max-w-4xl">
      <p className="mb-6 mt-0 text-sm leading-6 text-bark md:text-base">
        地址输入完会自动对准地图，拖动或点击图钉会自动改地址。点保存后小程序导航才会更新。额度用完时可选手动坐标或历史记录。
      </p>
      <div className="grid gap-4">
        <label className="grid gap-1.5">
          <span className="text-sm text-bark">店名</span>
          <input
            className="w-full rounded-lg border border-line bg-white px-3 py-2"
            value={form.name}
            onChange={(e) => patch('name', e.target.value)}
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm text-bark">地址</span>
          <textarea
            className="min-h-[80px] w-full rounded-lg border border-line bg-white px-3 py-2"
            value={form.address}
            onChange={(e) => patch('address', e.target.value)}
          />
        </label>
        <div className="grid gap-2">
          <span className="text-sm text-bark">店铺位置</span>
          <div className="overflow-hidden rounded-xl border border-line">
            <LocationMap
              latitude={Number(form.latitude) || 31.22048}
              longitude={Number(form.longitude) || 121.42516}
              onPick={(latitude, longitude) => {
                skipCoordsRef.current = true
                setForm((prev) => ({ ...prev, latitude, longitude }))
                void locateByMap(latitude, longitude)
              }}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-sm text-bark">纬度</span>
              <input
                className="w-full rounded-lg border border-line bg-white px-3 py-2"
                value={form.latitude}
                onChange={(e) => patch('latitude', Number(e.target.value))}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm text-bark">经度</span>
              <input
                className="w-full rounded-lg border border-line bg-white px-3 py-2"
                value={form.longitude}
                onChange={(e) => patch('longitude', Number(e.target.value))}
              />
            </label>
          </div>
          {locating || geoHint ? (
            <p className={`m-0 text-sm ${locating ? 'text-bark' : 'text-moss'}`}>
              {locating ? '正在定位…' : geoHint}
            </p>
          ) : null}
        </div>
        {history.length > 0 ? (
          <div className="grid gap-2">
            <span className="text-sm text-bark">历史定位</span>
            <p className="m-0 text-sm text-bark">只存在这台电脑的浏览器里，不会写入数据库。点一条即可回填。</p>
            <div className="grid gap-2">
              {history.map((item) => (
                <div
                  key={`${item.at}-${item.latitude}`}
                  className="flex items-stretch gap-2 rounded-xl border border-line bg-white"
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 px-3 py-2.5 text-left"
                    onClick={() => applyHistory(item)}
                  >
                    <span className="block text-sm">{item.address}</span>
                    <span className="mt-1 block text-xs text-bark">
                      {formatHistoryTime(item.at)} · {item.latitude}, {item.longitude}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="shrink-0 px-3 text-sm text-[#B87C4C]"
                    onClick={() => setHistory(removeLocationHistory(item.at))}
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <label className="grid gap-1.5">
          <span className="text-sm text-bark">电话</span>
          <input
            className="w-full rounded-lg border border-line bg-white px-3 py-2"
            value={form.phone}
            onChange={(e) => patch('phone', e.target.value)}
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm text-bark">营业时间文案</span>
          <input
            className="w-full rounded-lg border border-line bg-white px-3 py-2"
            value={form.hours}
            onChange={(e) => patch('hours', e.target.value)}
          />
        </label>
        <div className="grid gap-2">
          <span className="text-sm text-bark">闭馆星期</span>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((day) => (
              <button
                key={day.value}
                type="button"
                className={`rounded-full px-3 py-1.5 text-sm ${
                  form.closedWeekdays.includes(day.value)
                    ? 'bg-forest text-cream'
                    : 'bg-cream text-bark'
                }`}
                onClick={() => toggleClosed(day.value)}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          className="rounded-[10px] bg-forest px-4 py-2 text-cream disabled:opacity-60"
          onClick={onSave}
          disabled={saving}
        >
          {saving ? '保存中…' : '保存门店信息'}
        </button>
        <span className={message.includes('已保存') ? 'text-moss' : 'text-[#B87C4C]'}>{message}</span>
      </div>
    </div>
  )
}
