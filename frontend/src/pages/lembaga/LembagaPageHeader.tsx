import { NavLink } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { Button } from '../../components/ui/Button'
import { ROLE_CONFIG, itemHref } from '../../config/navigation'

export function LembagaPageHeader({
  onReportClick,
  subtitle = 'Senang Melihatmu Kembali, Mari lanjutkan progresmu.',
}: {
  onReportClick: () => void
  subtitle?: string
}) {
  const { user } = useAuth()

  return (
    <>
      <section className="flex min-h-[102px] flex-col items-start justify-between gap-4 rounded-xl bg-gradient-to-r from-[#2848b5] to-[#153aa6] px-6 py-5 text-white shadow-sm sm:flex-row sm:items-center sm:px-6 sm:py-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Halo, {user?.name || 'Mitra Lembaga'}!
          </h1>
          <p className="mt-1 text-xs text-blue-100 sm:text-[13px]">{subtitle}</p>
        </div>
        <Button
          variant="secondary"
          className="min-h-[34px] shrink-0 self-end border-white bg-white px-4 py-1.5 text-xs font-semibold text-brand-700 hover:bg-blue-50 sm:self-auto"
          onClick={onReportClick}
        >
          Lihat Laporan
        </Button>
      </section>

      <nav aria-label="Navigasi Lembaga Bimbingan" className="-mb-2 border-b border-slate-200 bg-transparent">
        <ul className="flex gap-1 overflow-x-auto">
          {ROLE_CONFIG.lembaga.items
            .filter((item) => item.key !== 'profile')
            .map((item) => (
              <li key={item.key} className="shrink-0">
                <NavLink
                  to={itemHref('lembaga', item)}
                  end={item.path === ''}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-xs font-semibold transition-colors sm:text-sm ${
                      isActive
                        ? 'border-brand-600 text-brand-700'
                        : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'
                    }`
                  }
                >
                  <item.icon className="h-4 w-4" aria-hidden />
                  {item.key === 'overview' ? 'Ringkasan' : item.label}
                </NavLink>
              </li>
            ))}
        </ul>
      </nav>
    </>
  )
}
