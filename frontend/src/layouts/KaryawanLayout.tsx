import { Link, Outlet } from 'react-router-dom'
import { AccountControls } from '../components/AccountControls'
import { BRAND_ICON, ROLE_CONFIG } from '../config/navigation'

const config = ROLE_CONFIG.karyawan

/** Layout Karyawan: header tanpa menu; navigasi lewat kartu di dashboard, logo kembali ke dashboard. */
export function KaryawanLayout() {
  const BrandIcon = BRAND_ICON

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-ink-900 text-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link to="/karyawan" className="flex items-center gap-3" aria-label="Kembali ke dashboard">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-400 text-ink-900">
              <BrandIcon className="h-5 w-5" aria-hidden />
            </span>
            <span className="hidden text-lg font-semibold sm:inline">LMS Capstone</span>
          </Link>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90">{config.label}</span>
          <div className="flex-1" />
          <AccountControls tone="dark" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">
        <Outlet />
      </main>
    </div>
  )
}
