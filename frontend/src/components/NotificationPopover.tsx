import {
  Bell,
  BookOpen,
  CalendarClock,
  ClipboardCheck,
  FileText,
  MessageSquare,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  clearNotifications,
  formatNotificationDate,
  markNotificationRead,
  useNotifications,
  type AppNotification,
  type NotificationCategory,
} from '../lib/notifications'

/** Ikon dan warna per kategori; kategori tak dikenal memakai ikon lonceng netral. */
const CATEGORY_STYLE: Record<NotificationCategory, { Icon: LucideIcon; color: string }> = {
  assessment: { Icon: ClipboardCheck, color: 'bg-amber-50 text-amber-600' },
  schedule: { Icon: CalendarClock, color: 'bg-purple-50 text-purple-600' },
  achievement: { Icon: Trophy, color: 'bg-yellow-50 text-yellow-600' },
  system: { Icon: Bell, color: 'bg-blue-50 text-blue-600' },
  submission: { Icon: FileText, color: 'bg-blue-50 text-blue-600' },
  roster: { Icon: Users, color: 'bg-emerald-50 text-emerald-600' },
  discussion: { Icon: MessageSquare, color: 'bg-violet-50 text-violet-600' },
}

export function notificationStyle(category: string) {
  return CATEGORY_STYLE[category as NotificationCategory] ?? CATEGORY_STYLE.system
}

interface NotificationPopoverProps {
  userId: number | null
  /** Keterangan singkat isi notifikasi untuk peran ini. */
  subtitle: string
  /** Halaman daftar lengkap notifikasi peran ini. */
  allHref: string
  onClose: () => void
}

/**
 * Popover lonceng untuk semua peran yang punya notifikasi (Siswa, Mentor, Admin).
 * Memakai store API yang sama dengan halaman Notifikasi; isinya otomatis milik akun yang login.
 */
export function NotificationPopover({ userId, subtitle, allHref, onClose }: NotificationPopoverProps) {
  const state = useNotifications(userId)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const navigate = useNavigate()
  const unread = state.items.filter((item) => !item.is_read).length
  const visible = state.items.filter((item) => filter === 'all' || !item.is_read).slice(0, 3)

  function openNotification(notification: AppNotification) {
    void markNotificationRead(notification.id)
    onClose()
    if (notification.href) navigate(notification.href)
  }

  return (
    <div className="absolute right-0 z-40 mt-2 w-[min(90vw,24rem)] overflow-hidden rounded-xl border border-slate-200 bg-white text-sm shadow-xl">
      <header className="bg-slate-50 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-slate-900">Notifikasi</p>
          <span className="rounded-full bg-brand-50 px-2 py-1 text-[10px] font-medium text-brand-700">{unread} belum dibaca</span>
        </div>
        <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      </header>

      <div className="grid grid-cols-2 border-b border-slate-200">
        {([
          { value: 'all', label: 'Semua' },
          { value: 'unread', label: 'Belum dibaca' },
        ] as const).map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setFilter(tab.value)}
            aria-pressed={filter === tab.value}
            className={`border-b-2 px-3 py-2.5 text-xs font-semibold ${filter === tab.value ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="max-h-80 overflow-y-auto">
        {state.loading && state.items.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-slate-500">Memuat notifikasi…</p>
        ) : state.error ? (
          <p className="px-4 py-8 text-center text-xs text-rose-600">{state.error.message}</p>
        ) : visible.length ? (
          visible.map((notification) => {
            const { Icon, color } = notificationStyle(notification.category)
            return (
              <article key={notification.id} className={`border-b border-slate-100 px-4 py-3 last:border-b-0 ${notification.is_read ? '' : 'bg-white'}`}>
                <div className="flex gap-3">
                  <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${color}`}>
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => openNotification(notification)} className="block text-left text-xs font-semibold text-slate-900 hover:text-brand-700">
                      {notification.title}
                    </button>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">{notification.message}</p>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-400">{formatNotificationDate(notification.created_at)}</span>
                      {notification.href && (
                        <Link
                          to={notification.href}
                          onClick={() => {
                            void markNotificationRead(notification.id)
                            onClose()
                          }}
                          className="inline-flex items-center gap-1 rounded bg-brand-50 px-2 py-1 text-[10px] font-semibold text-brand-700 hover:bg-brand-100"
                        >
                          {notification.action_label ?? 'Buka'}<BookOpen className="h-3 w-3" aria-hidden />
                        </Link>
                      )}
                    </div>
                  </div>
                  {!notification.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-label="Belum dibaca" />}
                </div>
              </article>
            )
          })
        ) : (
          <p className="px-4 py-8 text-center text-xs text-slate-500">Tidak ada notifikasi untuk ditampilkan.</p>
        )}
      </div>

      <footer className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
        <button
          type="button"
          onClick={() => void clearNotifications().then(onClose)}
          disabled={state.items.length === 0}
          className="text-xs font-medium text-rose-600 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Bersihkan
        </button>
        <Link to={allHref} onClick={onClose} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800">
          Lihat semua <span aria-hidden>→</span>
        </Link>
      </footer>
    </div>
  )
}
