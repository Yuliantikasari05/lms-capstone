import { Bell, BookOpen, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { notificationStyle } from '../../components/NotificationPopover'
import { EmptyState, ErrorState, Spinner } from '../../components/ui/States'
import {
  clearNotifications,
  deleteNotification,
  formatNotificationDate,
  loadNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  unreadCount,
  useNotifications,
  type AppNotification,
} from '../../lib/notifications'

type ReadFilter = 'all' | 'unread' | 'read'

/**
 * Halaman Notifikasi untuk semua peran (Siswa, Mentor, Admin): daftar, detail, cari, saring,
 * tandai dibaca, dan hapus. Data selalu milik akun yang login, karena backend hanya mengirim
 * notifikasi pengguna itu dan store di-reset saat akun berganti.
 */
export default function NotificationCenter() {
  const { user } = useAuth()
  const state = useNotifications(user?.id ?? null)
  const [query, setQuery] = useState('')
  const [readFilter, setReadFilter] = useState<ReadFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const visible = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('id-ID')
    return state.items.filter((notification) => {
      const matchesRead = readFilter === 'all'
        || (readFilter === 'unread' && !notification.is_read)
        || (readFilter === 'read' && notification.is_read)
      const matchesQuery = !keyword
        || `${notification.title} ${notification.message} ${notification.actor_name} ${notification.actor_role}`
          .toLocaleLowerCase('id-ID')
          .includes(keyword)
      return matchesRead && matchesQuery
    })
  }, [state.items, query, readFilter])

  const selected = visible.find((notification) => notification.id === selectedId) ?? visible[0] ?? null
  const unread = unreadCount(state.items)

  function selectNotification(notification: AppNotification) {
    setSelectedId(notification.id)
    if (!notification.is_read) void markNotificationRead(notification.id)
  }

  function removeSelected() {
    if (!selected) return
    const next = visible.find((notification) => notification.id !== selected.id)
    void deleteNotification(selected.id)
    setSelectedId(next?.id ?? null)
  }

  function markAllRead() {
    if (unread > 0) void markAllNotificationsRead()
  }

  function clearAll() {
    if (state.items.length > 0) void clearNotifications()
    setSelectedId(null)
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-slate-600" aria-hidden />
          <h1 className="text-xl font-semibold text-slate-900">Notifikasi</h1>
          {unread > 0 && (
            <span className="rounded-full bg-brand-50 px-2 py-1 text-[10px] font-semibold text-brand-700">{unread} belum dibaca</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={markAllRead}
            disabled={unread === 0}
            className="text-sm font-semibold text-brand-700 hover:text-brand-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Tandai semua dibaca
          </button>
          <button
            type="button"
            onClick={clearAll}
            disabled={state.items.length === 0}
            className="text-sm font-semibold text-rose-600 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Hapus semua
          </button>
        </div>
      </header>

      {state.loading && state.items.length === 0 && <Spinner label="Memuat notifikasi…" />}
      {state.error && <ErrorState error={state.error} onRetry={() => void loadNotifications(user?.id ?? null, true)} />}

      {!state.error && (!state.loading || state.items.length > 0) && (
        <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(19rem,0.9fr)_minmax(0,1.1fr)]">
          <section aria-label="Daftar notifikasi" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 p-4">
              <label className="relative block">
                <span className="sr-only">Cari notifikasi</span>
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Cari pesan"
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-700 outline-none focus:border-brand-500"
                />
              </label>

              <div className="mt-3 grid grid-cols-3 gap-2">
                {([
                  { value: 'all', label: 'Semua' },
                  { value: 'unread', label: 'Belum dibaca' },
                  { value: 'read', label: 'Sudah dibaca' },
                ] as const).map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setReadFilter(filter.value)}
                    aria-pressed={readFilter === filter.value}
                    className={`rounded-lg px-2 py-2 text-[10px] font-semibold transition-colors ${readFilter === filter.value ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[34rem] overflow-y-auto">
              {visible.length ? visible.map((notification) => {
                const { Icon, color } = notificationStyle(notification.category)
                const isSelected = selected?.id === notification.id
                return (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => selectNotification(notification)}
                    aria-current={isSelected ? 'true' : undefined}
                    className={`flex w-full gap-3 border-b border-slate-100 px-4 py-4 text-left last:border-b-0 hover:bg-slate-50 ${isSelected ? 'bg-brand-50/60' : ''}`}
                  >
                    <span className="flex w-4 shrink-0 items-start justify-center pt-1.5">
                      <span className={`h-2.5 w-2.5 rounded-full ${notification.is_read ? 'bg-slate-300' : 'bg-brand-600'}`} />
                    </span>
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${color}`}>
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold text-slate-900">{notification.title}</span>
                      <span className="mt-1 block line-clamp-2 text-[11px] leading-4 text-slate-500">{notification.message}</span>
                      <span className="mt-2 block text-[10px] text-slate-400">{formatNotificationDate(notification.created_at)}</span>
                    </span>
                  </button>
                )
              }) : (
                <p className="px-4 py-8 text-center text-xs text-slate-500">Tidak ada notifikasi yang cocok.</p>
              )}
            </div>
          </section>

          <section aria-label="Detail notifikasi" className="min-h-80 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {selected ? (
              <NotificationDetails notification={selected} onDelete={removeSelected} />
            ) : (
              <div className="flex min-h-80 items-center justify-center p-6">
                <EmptyState title="Pilih notifikasi" description="Pilih notifikasi dari daftar untuk melihat detailnya." />
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

function NotificationDetails({ notification, onDelete }: { notification: AppNotification; onDelete: () => void }) {
  const { Icon, color } = notificationStyle(notification.category)
  return (
    <div className="h-full p-5 sm:p-7">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${color}`}>
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900">{notification.title}</h2>
            <p className="mt-1 text-[11px] text-slate-500">{notification.actor_role} · {notification.actor_name}</p>
            <p className="mt-1 text-[10px] text-slate-400">{formatNotificationDate(notification.created_at)}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Hapus notifikasi ini"
          title="Hapus notifikasi"
          className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      </header>

      <p className="mt-7 rounded-xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">
        {notification.message}
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <span className="text-xs text-slate-500">Dikirim oleh {notification.actor_name} · {notification.actor_role}</span>
        {notification.href && (
          <Link
            to={notification.href}
            onClick={() => void markNotificationRead(notification.id)}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-100"
          >
            <BookOpen className="h-4 w-4" aria-hidden />{notification.action_label ?? 'Buka'}
          </Link>
        )}
      </div>
    </div>
  )
}
