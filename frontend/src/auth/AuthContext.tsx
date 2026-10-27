import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, type ApiError, AUTH_EVENT, ensureCsrfCookie, toApiError } from '../lib/api'
import type { User } from '../types'

interface AuthContextValue {
  user: User | null
  booting: boolean
  bootError: ApiError | null
  notice: string | null
  login: (email: string, password: string) => Promise<User>
  logout: () => Promise<void>
  retryBoot: () => void
  clearNotice: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [booting, setBooting] = useState(true)
  const [bootError, setBootError] = useState<ApiError | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  // Periksa sesi ke backend (GET /auth/me). Role selalu berasal dari backend.
  useEffect(() => {
    let cancelled = false
    setBooting(true)
    setBootError(null)

    api
      .get<{ data: User }>('/auth/me')
      .then((res) => {
        if (!cancelled) setUser(res.data.data)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        const apiError = toApiError(error)
        if (apiError.kind === 'unauthenticated') {
          setUser(null)
        } else if (apiError.kind === 'forbidden' && apiError.code === 'account_inactive') {
          setUser(null)
          setNotice(apiError.message)
        } else {
          setBootError(apiError)
        }
      })
      .finally(() => {
        if (!cancelled) setBooting(false)
      })

    return () => {
      cancelled = true
    }
  }, [attempt])

  // Sesi berakhir di tengah penggunaan (401 dari endpoint mana pun).
  useEffect(() => {
    const onUnauthenticated = (event: Event) => {
      const reason = (event as CustomEvent<{ reason: 'expired' | 'inactive' }>).detail?.reason
      setUser(null)
      setNotice(
        reason === 'inactive'
          ? 'Akun Anda tidak aktif. Hubungi Admin.'
          : 'Sesi Anda telah berakhir. Silakan login kembali.',
      )
    }
    window.addEventListener(AUTH_EVENT, onUnauthenticated)
    return () => window.removeEventListener(AUTH_EVENT, onUnauthenticated)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    await ensureCsrfCookie()
    const res = await api.post<{ data: User }>('/auth/login', { email, password })
    setNotice(null)
    setUser(res.data.data)
    return res.data.data
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      // Jika sesi sudah berakhir atau jaringan bermasalah, tetap bersihkan state lokal.
    } finally {
      setUser(null)
      setNotice(null)
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      booting,
      bootError,
      notice,
      login,
      logout,
      retryBoot: () => setAttempt((n) => n + 1),
      clearNotice: () => setNotice(null),
    }),
    [user, booting, bootError, notice, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth harus dipakai di dalam <AuthProvider>.')
  return ctx
}
