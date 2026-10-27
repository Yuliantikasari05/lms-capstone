import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { FullScreenLoading, ErrorState } from '../components/ui/States'
import { Button } from '../components/ui/Button'
import { isRoleSlug, roleHome } from '../config/navigation'
import type { RoleSlug } from '../types'
import ForbiddenPage from '../pages/shared/ForbiddenPage'
import { useAuth } from './AuthContext'

/** Hanya untuk UX. Backend tetap memeriksa autentikasi dan permission pada setiap request. */
export function RequireAuth() {
  const { user, booting, bootError, retryBoot } = useAuth()
  const location = useLocation()

  if (booting) return <FullScreenLoading />

  if (bootError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface p-4">
        <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-sm">
          <ErrorState error={bootError} onRetry={retryBoot} />
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  return <Outlet />
}

export function RequireRole({ role }: { role: RoleSlug }) {
  const { user } = useAuth()

  if (user?.primary_role !== role) return <ForbiddenPage />

  return <Outlet />
}

/** Arahkan pengguna ke dashboard sesuai role dari backend. */
export function HomeRedirect() {
  const { user, logout } = useAuth()

  if (!user) return <Navigate to="/login" replace />

  if (!isRoleSlug(user.primary_role)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface p-4">
        <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-ink-900">Akun belum memiliki role</h1>
          <p className="mt-2 text-sm text-slate-500">Hubungi Admin untuk menetapkan role pada akun Anda.</p>
          <Button className="mt-4" variant="secondary" onClick={() => void logout()}>
            Logout
          </Button>
        </div>
      </div>
    )
  }

  return <Navigate to={roleHome(user.primary_role)} replace />
}
