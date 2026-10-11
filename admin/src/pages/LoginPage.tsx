import { useState, type FormEvent } from 'react'
import { api, type AdminUser } from '../api'

type Props = {
  onLogin: (user: AdminUser) => void
  message?: string
}

export function LoginPage({ onLogin, message }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError('')
    try {
      const user = await api.login(email.trim(), password)
      setPassword('')
      onLogin(user)
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-cream px-5 py-12 text-forest">
      <section className="w-full max-w-[420px] rounded-2xl border border-line bg-white p-7 shadow-sm sm:p-10">
        <p className="mb-2 mt-0 text-sm tracking-[0.2em] text-bark">小森林书店</p>
        <h1 className="mb-3 mt-0 text-3xl font-semibold">登录管理后台</h1>
        <p className="mb-8 mt-0 text-sm leading-6 text-bark">管理首页内容、到店须知与预约。</p>
        <form onSubmit={submit} className="grid gap-5">
          <label className="grid gap-2">
            <span className="text-sm font-medium">邮箱</span>
            <input
              type="email"
              name="email"
              autoComplete="username"
              autoCapitalize="none"
              autoFocus
              required
              maxLength={254}
              disabled={submitting}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="请输入管理员邮箱"
              className="w-full rounded-lg border border-line bg-white px-3 py-3 text-base outline-none focus:border-forest focus:ring-1 focus:ring-forest"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium">密码</span>
            <div className="relative">
              <input
                type={visible ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                required
                maxLength={128}
                disabled={submitting}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="请输入密码"
                className="w-full rounded-lg border border-line bg-white px-3 py-3 pr-16 text-base outline-none focus:border-forest focus:ring-1 focus:ring-forest"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded text-sm text-bark hover:text-forest"
                aria-label={visible ? '隐藏密码' : '显示密码'}
                aria-pressed={visible}
                onClick={() => setVisible(!visible)}
              >
                {visible ? '隐藏' : '显示'}
              </button>
            </div>
          </label>
          {(error || message) ? (
            <p role="alert" className="m-0 text-sm leading-6 text-[#A24A3B]">{error || message}</p>
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            className="mt-1 rounded-lg bg-forest px-4 py-3 font-medium text-cream hover:bg-leaf disabled:cursor-wait disabled:opacity-60"
          >
            {submitting ? '登录中…' : '登录'}
          </button>
        </form>
      </section>
    </main>
  )
}
