import { ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { isRoleSlug, roleHome } from '../../config/navigation'

export default function ForbiddenPage() {
  const { user } = useAuth()
  const home = user && isRoleSlug(user.primary_role) ? roleHome(user.primary_role) : '/'

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-4">
      <div className="max-w-md text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500">
          <ShieldAlert className="h-7 w-7" aria-hidden />
        </span>
        <h1 className="mt-4 text-xl font-semibold text-ink-900">Akses ditolak</h1>
        <p className="mt-2 text-sm text-slate-500">Role Anda tidak memiliki izin untuk membuka halaman ini.</p>
        <Link to={home} className="mt-5 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          Kembali ke dashboard
        </Link>
      </div>
    </div>
  )
}
