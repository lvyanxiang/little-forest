import { useEffect, useState, type ChangeEvent } from 'react'
import { api } from '../api'

const DEFAULT_IMAGE = '/home-default.jpg'

export function HomePage() {
  const [heroText, setHeroText] = useState('')
  const [imageUrl, setImageUrl] = useState(DEFAULT_IMAGE)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    api
      .getStore()
      .then((store) => {
        setHeroText(store.homeHeroText)
        setImageUrl(store.homeHeroImageUrl || DEFAULT_IMAGE)
      })
      .catch((err: Error) => setMessage(err.message))
  }, [])

  async function onUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploading(true)
    setMessage('')
    try {
      const store = await api.uploadHomeImage(file)
      setImageUrl(`${store.homeHeroImageUrl}?v=${Date.now()}`)
      setMessage('首页图片已更新')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '上传失败')
    } finally {
      setUploading(false)
    }
  }

  async function onSave() {
    setSaving(true)
    setMessage('')
    try {
      await api.saveStore({ homeHeroText: heroText })
      setMessage('首页文案已保存')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-full max-w-4xl">
      <p className="mb-6 mt-0 text-sm leading-6 text-bark md:text-base">
        配置小程序首页的主图和右侧文字。推荐上传竖图，单张不超过 5MB；文案会按换行原样展示。
      </p>
      <div className="grid gap-6 md:grid-cols-[260px_minmax(0,1fr)]">
        <div className="grid content-start gap-3">
          <div className="aspect-[404/967] overflow-hidden rounded-2xl border border-line bg-cream">
            <img className="h-full w-full object-cover" src={imageUrl} alt="小程序首页预览" />
          </div>
          <label className="cursor-pointer rounded-[10px] bg-forest px-4 py-2 text-center text-sm text-cream">
            {uploading ? '上传中…' : '更换首页图片'}
            <input
              className="hidden"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading}
              onChange={onUpload}
            />
          </label>
        </div>
        <div className="grid content-start gap-4">
          <label className="grid gap-1.5">
            <span className="text-sm text-bark">右侧文案</span>
            <textarea
              className="min-h-[220px] w-full rounded-lg border border-line bg-white px-3 py-2 text-right leading-8"
              value={heroText}
              onChange={(event) => setHeroText(event.target.value)}
              placeholder="每行一句"
            />
          </label>
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              className="rounded-[10px] bg-forest px-4 py-2 text-cream disabled:opacity-60"
              onClick={onSave}
              disabled={saving}
            >
              {saving ? '保存中…' : '保存首页文案'}
            </button>
            <span className={message.includes('已') ? 'text-moss' : 'text-[#B87C4C]'}>{message}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
