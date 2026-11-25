import { type FormEvent, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { AlertTriangle, Loader2 } from 'lucide-react'
import loginIllustration from '../assets/login-illustration.png'
import { useAuth } from '../auth/AuthContext'
import { TermsCheckbox } from '../components/Terms'
import { isRoleSlug, roleHome } from '../config/navigation'
import { type ApiError, toApiError } from '../lib/api'

/* Ukuran mengikuti tinggi layar (patokan desain 1440x1024) agar tombol Login tetap terlihat di layar pendek. */
const TEXT = 'text-[clamp(1rem,2.35vh,1.5rem)]'
const CONTROL = `h-[clamp(3rem,7vh,4.5rem)] w-full rounded-[14px] ${TEXT}`
const LABEL = `block leading-snug text-black ${TEXT}`
const INPUT = `${CONTROL} border border-neutral-400 bg-white pl-[4.5rem] text-neutral-600 placeholder:text-neutral-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 sm:pl-[5.75rem]`
const FIELD_ICON = 'pointer-events-none absolute left-5 top-1/2 h-[clamp(1.5rem,4vh,2.5rem)] w-[clamp(1.5rem,4vh,2.5rem)] -translate-y-1/2 text-[#CFCFCF]'

export default function LoginPage() {
  const { user, login, notice, clearNotice } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  // Sengaja tidak disimpan: S&K wajib dicentang pada setiap login.
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  if (user && isRoleSlug(user.primary_role)) return <Navigate to={roleHome(user.primary_role)} replace />

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!agreed) return
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
    <div className="flex min-h-screen font-poppins">
      <div className="hidden w-1/2 items-center justify-center bg-[#E9F0FF] p-8 lg:flex">
        <img src={loginIllustration} alt="" width={620} height={392} className="h-auto w-full max-w-[620px]" />
      </div>

      <main className="flex w-full items-center justify-center bg-white px-6 py-8 lg:w-1/2 lg:px-12">
        <div className="w-full max-w-[572px]">
          <div className="text-center">
            <span
              className="mx-auto flex h-[clamp(4rem,11.7vh,7.5rem)] w-[clamp(4rem,11.7vh,7.5rem)] items-center justify-center rounded-[clamp(0.875rem,2vh,1.25rem)] bg-blue-600 text-[clamp(1.75rem,4.9vh,3.125rem)] font-bold text-white"
              aria-hidden
            >
              L
            </span>
            <h1 className="mt-[clamp(1rem,3.7vh,2.375rem)] text-[clamp(1.5rem,min(3.5vh,6.2vw),2.25rem)] font-bold leading-tight text-black">
              Selamat Datang Kembali!
            </h1>
            <p className={`mt-1 text-neutral-600 ${TEXT}`}>Login ke Learnify LMS</p>
          </div>

          {notice && (
            <p role="status" className="mt-5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {notice}
            </p>
          )}

          <form onSubmit={onSubmit} className="mt-[clamp(1.25rem,5.5vh,3.5rem)]" noValidate>
            <label htmlFor="email" className={LABEL}>
              Email
            </label>
            <div className="relative mt-1.5">
              <MailIcon />
              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Masukkan email"
                className={`${INPUT} pr-5`}
              />
            </div>

            <label htmlFor="password" className={`mt-[clamp(0.75rem,2.4vh,1.5rem)] ${LABEL}`}>
              Password
            </label>
            <div className="relative mt-1.5">
              <LockIcon />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
                className={`${INPUT} pr-16`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-neutral-400 hover:text-neutral-600"
              >
                <EyeIcon slashed={showPassword} />
              </button>
            </div>

            <div className="mt-[clamp(0.875rem,2.6vh,1.75rem)]">
              <TermsCheckbox checked={agreed} onChange={setAgreed} linked />
            </div>

            {message && (
              <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={!agreed || submitting}
              className={`mt-[clamp(0.875rem,2.6vh,1.75rem)] flex items-center justify-center gap-2 bg-blue-600 font-medium text-white shadow-[0_4px_6px_rgba(37,99,235,0.3)] transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-600/50 disabled:shadow-none ${CONTROL}`}
            >
              {submitting && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
              Login
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}

function MailIcon() {
  return (
    <svg viewBox="0 0 40 40" className={FIELD_ICON} fill="currentColor" aria-hidden>
      <path d="M0 10.5 20 23 40 10.5V33H0Z" />
      <path d="M0 7h40L20 19.5Z" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg viewBox="0 0 40 40" className={FIELD_ICON} aria-hidden>
      <rect x="4" y="16" width="32" height="23" rx="2.5" fill="currentColor" />
      <path d="M11 17v-5a9 9 0 0 1 18 0v5" fill="none" stroke="currentColor" strokeWidth="3.5" />
    </svg>
  )
}

function EyeIcon({ slashed }: { slashed: boolean }) {
  return (
    <svg viewBox="0 0 30 30" className="h-7 w-7" aria-hidden>
      <path d="M1 15C3.6 9 9 5.5 15 5.5S26.4 9 29 15c-2.6 6-8 9.5-14 9.5S3.6 21 1 15Z" fill="currentColor" />
      <circle cx="15" cy="15" r="6" fill="white" />
      <circle cx="15" cy="15" r="3.2" fill="currentColor" />
      {slashed && <path d="M4 26 26 4" stroke="white" strokeWidth="5" />}
      {slashed && <path d="M4 26 26 4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />}
    </svg>
  )
}
