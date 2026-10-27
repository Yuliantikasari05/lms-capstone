import { type FormEvent, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { Button } from '../components/ui/Button'
import { BRAND_ICON, isRoleSlug, roleHome } from '../config/navigation'
import { type ApiError, toApiError } from '../lib/api'

export default function LoginPage() {
  const { user, login, notice, clearNotice } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const BrandIcon = BRAND_ICON

  if (user && isRoleSlug(user.primary_role)) return <Navigate to={roleHome(user.primary_role)} replace />

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    clearNotice()

    try {
      const loggedIn = await login(email.trim(), password)
      navigate(isRoleSlug(loggedIn.primary_role) ? roleHome(loggedIn.primary_role) : '/', { replace: true })
    } catch (err) {
      setError(toApiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const fieldError = (name: string) => error?.fieldErrors[name]?.[0]
  const generalError = error && !error.fieldErrors.email && !error.fieldErrors.password ? error.message : null
  const message = generalError ?? fieldError('email') ?? fieldError('password')

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-900 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-ink-900 text-gold-400">
            <BrandIcon className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-ink-900">LMS Capstone</h1>
            <p className="text-sm text-slate-500">Masuk untuk melanjutkan</p>
          </div>
        </div>

        {notice && (
          <p role="status" className="mt-5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {notice}
          </p>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Kata sandi
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>

          {message && (
            <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {message}
            </p>
          )}

          <Button type="submit" loading={submitting} className="w-full">
            Login
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">Akun dibuat dan dikelola oleh Admin.</p>
      </div>
    </div>
  )
}
