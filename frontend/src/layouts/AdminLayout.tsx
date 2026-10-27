import { Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { AccountControls } from '../components/AccountControls'
import { BRAND_ICON, ROLE_CONFIG, itemHref } from '../config/navigation'

const config = ROLE_CONFIG.admin

export function AdminLayout() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => setOpen(false), [pathname])

  const current = config.items.find((item) => {
    const href = itemHref('admin', item)
    return item.path === '' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
  })
  const BrandIcon = BRAND_ICON

  return (
    <div className="min-h-screen lg:flex">
      {open && <div className="fixed inset-0 z-20 bg-ink-950/50 lg:hidden" onClick={() => setOpen(false)} aria-hidden />}

      <aside
        aria-label="Navigasi Admin"
        className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-ink-900 text-white transition-transform lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-400 text-ink-900">
              <BrandIcon className="h-5 w-5" aria-hidden />
            </span>
            <span className="text-lg font-semibold">LMS Capstone</span>
          </div>
          <button type="button" className="rounded p-1 text-white/70 hover:bg-white/10 lg:hidden" onClick={() => setOpen(false)} aria-label="Tutup menu">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {config.items.map((item) => (
            <NavLink
              key={item.key}
              to={itemHref('admin', item)}
              end={item.path === ''}
              className={({ isActive }) =>
                `relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute inset-y-1.5 left-0 w-1 rounded-r bg-gold-400" aria-hidden />}
                  <item.icon className="h-5 w-5 shrink-0" aria-hidden />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
          <button type="button" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Buka menu">
            <Menu className="h-5 w-5" aria-hidden />
          </button>
          <h2 className="flex-1 truncate text-lg font-semibold text-ink-900">{current?.label ?? 'Admin'}</h2>
          <AccountControls />
        </header>

        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
