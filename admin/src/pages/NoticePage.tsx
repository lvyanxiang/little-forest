import { useEffect, useState } from 'react'
import { api } from '../api'

export function NoticePage() {
  const [noticeHeading, setNoticeHeading] = useState('')
  const [noticeItems, setNoticeItems] = useState('')
  const [noticeFoot, setNoticeFoot] = useState('')
  const [homeNoticeText, setHomeNoticeText] = useState('')
  const [successNoticeLines, setSuccessNoticeLines] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api
      .getStore()
      .then((store) => {
        setNoticeHeading(store.noticeHeading)
        setNoticeItems(store.noticeItems.join('\n'))
        setNoticeFoot(store.noticeFoot)
        setHomeNoticeText(store.homeNoticeText)
        setSuccessNoticeLines(store.successNoticeLines.join('\n'))
      })
      .catch((err: Error) => setMessage(err.message))
  }, [])

  async function onSave() {
    setSaving(true)
    setMessage('')
    try {
      await api.saveStore({
        noticeHeading,
        noticeItems: noticeItems.split('\n').map((item) => item.trim()).filter(Boolean),
        noticeFoot,
        homeNoticeText,
        successNoticeLines: successNoticeLines
          .split('\n')
          .map((item) => item.trim())
          .filter(Boolean),
      })
      setMessage('须知已保存，小程序下次打开会更新')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-full max-w-3xl">
      <p className="mb-6 mt-0 text-sm leading-6 text-bark md:text-base">
        首页到店说明、预约页须知和预约成功提示都从这里读。每行一条。
      </p>
      <div className="grid gap-4">
        <label className="grid gap-1.5">
          <span className="text-sm text-bark">首页到店说明</span>
          <textarea
            className="min-h-[88px] w-full rounded-lg border border-line bg-white px-3 py-2"
            value={homeNoticeText}
            onChange={(e) => setHomeNoticeText(e.target.value)}
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm text-bark">预约页标题</span>
          <input
            className="w-full rounded-lg border border-line bg-white px-3 py-2"
            value={noticeHeading}
            onChange={(e) => setNoticeHeading(e.target.value)}
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm text-bark">预约页须知（一行一条）</span>
          <textarea
            className="min-h-[180px] w-full rounded-lg border border-line bg-white px-3 py-2 md:min-h-[220px]"
            value={noticeItems}
            onChange={(e) => setNoticeItems(e.target.value)}
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm text-bark">须知结尾</span>
          <input
            className="w-full rounded-lg border border-line bg-white px-3 py-2"
            value={noticeFoot}
            onChange={(e) => setNoticeFoot(e.target.value)}
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm text-bark">预约成功提示（一行一条）</span>
          <textarea
            className="min-h-[120px] w-full rounded-lg border border-line bg-white px-3 py-2"
            value={successNoticeLines}
            onChange={(e) => setSuccessNoticeLines(e.target.value)}
          />
        </label>
      </div>
      <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          className="rounded-[10px] bg-forest px-4 py-2 text-cream disabled:opacity-60"
          onClick={onSave}
          disabled={saving}
        >
          {saving ? '保存中…' : '保存须知'}
        </button>
        <span className={message.includes('已保存') ? 'text-moss' : 'text-[#B87C4C]'}>{message}</span>
      </div>
    </div>
  )
}
