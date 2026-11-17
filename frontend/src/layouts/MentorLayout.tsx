import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { AccountControls } from '../components/AccountControls'
import { useAuth } from '../auth/AuthContext'
import { BRAND_ICON, ROLE_CONFIG, itemHref } from '../config/navigation'

const config = ROLE_CONFIG.mentor

/** Layout Mentor untuk navigasi utama dan halaman role. */
export function MentorLayout() {
  const BrandIcon = BRAND_ICON
  const { user } = useAuth()
  const { pathname } = useLocation()
  const isNestedDetail = /^\/mentor\/(courses\/[^/]+|users\/[^/]+)\/?$/.test(pathname)

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white text-slate-900 shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link to="/mentor" className="flex items-center gap-3" aria-label="Kembali ke dashboard">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-white">
              <BrandIcon className="h-5 w-5" aria-hidden />
            </span>
            <span className="hidden text-lg font-semibold sm:inline">Learnify LMS</span>
          </Link>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{config.label}</span>
          <div className="flex-1" />
          <AccountControls />
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">
        {!isNestedDetail && (
          <>
            <section className="mb-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Selamat datang, {user?.name ?? ''}! 👋</h1>
              <p className="mt-1 max-w-xl text-sm text-slate-600">Kelola jadwal bimbingan, kelas dan berinteraksilah dengan siswa Anda.</p>
            </section>
            <nav
              aria-label={`Navigasi ${config.label}`}
              className="sticky top-0 z-30 mb-5 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 shadow-md"
            >
              <ul className="flex min-w-max gap-1">
                {config.items.map((item) => (
                  <li key={item.key}>
                    <NavLink
                      to={itemHref('mentor', item)}
                      end={item.path === ''}
                      className={({ isActive }) =>
                        `flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                          isActive ? 'bg-brand-500 text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`
                      }
                    >
                      <item.icon className="h-4 w-4" aria-hidden />
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
          </>
        )}
        <Outlet />
      </main>
    </div>
  )
}
