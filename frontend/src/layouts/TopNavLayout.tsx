import { Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { AccountControls } from '../components/AccountControls'
import { BRAND_ICON, ROLE_CONFIG, itemHref } from '../config/navigation'
import type { RoleSlug } from '../types'

export function TopNavLayout({ role }: { role: Exclude<RoleSlug, 'admin'> }) {
  const config = ROLE_CONFIG[role]
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const BrandIcon = BRAND_ICON

  useEffect(() => setOpen(false), [pathname])

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-ink-900 text-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-400 text-ink-900">
            <BrandIcon className="h-5 w-5" aria-hidden />
          </span>
          <span className="hidden text-lg font-semibold sm:inline">LMS Capstone</span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90">{config.label}</span>
          <div className="flex-1" />
          <AccountControls tone="dark" />
          <button
            type="button"
            className="rounded-lg p-2 text-white/80 hover:bg-white/10 md:hidden"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label={open ? 'Tutup menu' : 'Buka menu'}
          >
            {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          </button>
        </div>
      </header>

      <nav aria-label={`Navigasi ${config.label}`} className="border-b border-slate-200 bg-white">
        <ul
          className={`mx-auto max-w-7xl px-2 sm:px-4 md:flex md:overflow-x-auto ${open ? 'flex flex-col py-2' : 'hidden'}`}
        >
          {config.items.map((item) => (
            <li key={item.key} className="md:shrink-0">
              <NavLink
                to={itemHref(role, item)}
                end={item.path === ''}
                className={({ isActive }) =>
                  `flex items-center gap-2 whitespace-nowrap px-3 py-3 text-sm font-medium transition-colors md:border-b-2 ${
                    isActive
                      ? 'text-brand-700 md:border-gold-500'
                      : 'text-slate-600 hover:text-ink-900 md:border-transparent'
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

      <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">
        <Outlet />
      </main>
    </div>
  )
}
