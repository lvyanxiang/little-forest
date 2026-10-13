import { useEffect, useState } from 'react'
import { api } from '../api'

export function MiniProgramTextPage() {
  const [text, setText] = useState<Record<string, string>>({})
  const [labels, setLabels] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    setMessage('')
    try {
      const store = await api.getStore()
      setText(store.uiText)
      setLabels(store.uiTextLabels)
    } catch (error) { setMessage(error instanceof Error ? error.message : '加载失败') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  async function save() {
    setSaving(true)
    setMessage('')
    try {
      const store = await api.saveStore({ uiText: text })
      setText(store.uiText)
      setMessage('文案已保存，小程序下次进入页面时更新')
    } catch (error) { setMessage(error instanceof Error ? error.message : '保存失败') }
    finally { setSaving(false) }
  }

  return <div className="w-full max-w-3xl">
    <p className="mb-6 mt-0 text-sm leading-6 text-bark">编辑首页提示、登录说明、隐私告知、手机号授权和预约成功文案。隐私告知应与微信公众平台的指引和实际业务保持一致。</p>
    {loading ? <p>正在加载…</p> : <div className="grid gap-4">
      {Object.entries(labels).map(([key, label]) => <label key={key} className="grid gap-1.5">
        <span className="text-sm text-bark">{label}</span>
        <textarea className="min-h-[70px] rounded-lg border border-line bg-white px-3 py-2" maxLength={2000} value={text[key] || ''} onChange={(event) => setText((old) => ({ ...old, [key]: event.target.value }))} />
      </label>)}
    </div>}
    <div className="mt-6 flex items-center gap-3">
      <button className="rounded-lg bg-forest px-4 py-2 text-cream disabled:opacity-60" onClick={Object.keys(labels).length ? save : load} disabled={loading || saving}>{saving ? '保存中…' : Object.keys(labels).length ? '保存文案' : '重试'}</button>
      <span className="text-sm text-bark">{message}</span>
    </div>
  </div>
}
