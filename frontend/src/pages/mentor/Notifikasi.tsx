import { Bell, BookOpen, ClipboardCheck, FileText, MessageSquare, Search, Star, Trash2, Users, type LucideIcon } from 'lucide-react'
import { useMemo, useSyncExternalStore } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { EmptyState } from '../../components/ui/States'
import {
  clearMentorNotifications,
  deleteMentorNotification,
  formatNotificationDate,
  getMentorNotifications,
  markMentorNotificationRead,
  subscribeMentorNotifications,
  type MentorNotification,
  type MentorNotificationCategory,
} from './notificationData'

type ReadFilter = 'all' | 'unread' | 'read'

const CATEGORY_STYLE: Record<MentorNotificationCategory, { Icon: LucideIcon; color: string }> = {
  assessment: { Icon: ClipboardCheck, color: 'bg-amber-50 text-amber-600' },
  review: { Icon: Star, color: 'bg-yellow-50 text-yellow-600' },
  discussion: { Icon: MessageSquare, color: 'bg-violet-50 text-violet-600' },
  submission: { Icon: FileText, color: 'bg-blue-50 text-blue-600' },
  roster: { Icon: Users, color: 'bg-emerald-50 text-emerald-600' },
}

export default function MentorNotifikasi() {
  const notifications = useSyncExternalStore(subscribeMentorNotifications, getMentorNotifications)
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''
  const readFilter = (searchParams.get('filter') as ReadFilter | null) ?? 'all'
  const selectedId = searchParams.get('id')

  const visibleNotifications = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('id-ID')
    return notifications.filter((notification) => {
      const matchesRead = readFilter === 'all'
        || (readFilter === 'unread' && !notification.isRead)
        || (readFilter === 'read' && notification.isRead)
      const matchesQuery = !normalizedQuery
        || `${notification.title} ${notification.message} ${notification.actorName} ${notification.actorRole}`
          .toLocaleLowerCase('id-ID')
          .includes(normalizedQuery)
      return matchesRead && matchesQuery
    })
  }, [notifications, query, readFilter])

  const selectedNotification = visibleNotifications.find((notification) => notification.id === selectedId)
    ?? visibleNotifications[0]

  function updateSearch(nextQuery: string) {
    const next = new URLSearchParams(searchParams)
    if (nextQuery) next.set('q', nextQuery)
    else next.delete('q')
    setSearchParams(next, { replace: true })
  }

  function updateFilter(nextFilter: ReadFilter) {
    const next = new URLSearchParams(searchParams)
    next.set('filter', nextFilter)
    next.delete('id')
    setSearchParams(next, { replace: true })
  }

  function selectNotification(notification: MentorNotification) {
    markMentorNotificationRead(notification.id)
    const next = new URLSearchParams(searchParams)
    next.set('id', notification.id)
    setSearchParams(next, { replace: true })
  }

  function deleteSelectedNotification() {
    if (!selectedNotification) return
    const next = visibleNotifications.find((notification) => notification.id !== selectedNotification.id)
    deleteMentorNotification(selectedNotification.id)
    const params = new URLSearchParams(searchParams)
    if (next) params.set('id', next.id)
    else params.delete('id')
    setSearchParams(params, { replace: true })
  }

  function clearNotifications() {
    clearMentorNotifications()
    const next = new URLSearchParams(searchParams)
    next.delete('id')
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-slate-600" aria-hidden />
          <h1 className="text-xl font-semibold text-slate-900">Notifikasi</h1>
        </div>
        <button type="button" onClick={clearNotifications} disabled={notifications.length === 0} className="text-sm font-semibold text-rose-600 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-40">
          Hapus semua
        </button>
      </header>

      <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(19rem,0.9fr)_minmax(0,1.1fr)]">
        <section aria-label="Daftar notifikasi" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-4">
            <label className="relative block">
              <span className="sr-only">Cari notifikasi</span>
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(event) => updateSearch(event.target.value)}
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
                  onClick={() => updateFilter(filter.value)}
                  aria-pressed={readFilter === filter.value}
                  className={`rounded-lg px-2 py-2 text-[10px] font-semibold transition-colors ${readFilter === filter.value ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[34rem] overflow-y-auto">
            {visibleNotifications.length ? visibleNotifications.map((notification) => {
              const { Icon, color } = CATEGORY_STYLE[notification.category]
              const isSelected = selectedNotification?.id === notification.id
              return (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => selectNotification(notification)}
                  aria-current={isSelected ? 'true' : undefined}
                  className={`flex w-full gap-3 border-b border-slate-100 px-4 py-4 text-left last:border-b-0 hover:bg-slate-50 ${isSelected ? 'bg-brand-50/60' : ''}`}
                >
                  <span className="flex w-4 shrink-0 items-start justify-center pt-1.5">
                    <span className={`h-2.5 w-2.5 rounded-full ${notification.isRead ? 'bg-slate-300' : 'bg-brand-600'}`} />
                  </span>
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${color}`}>
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-slate-900">{notification.title}</span>
                    <span className="mt-1 block line-clamp-2 text-[11px] leading-4 text-slate-500">{notification.message}</span>
                    <span className="mt-2 block text-[10px] text-slate-400">{formatNotificationDate(notification.createdAt)}</span>
                  </span>
                </button>
              )
            }) : (
              <p className="px-4 py-8 text-center text-xs text-slate-500">Tidak ada notifikasi yang cocok.</p>
            )}
          </div>
        </section>

        <section aria-label="Detail notifikasi" className="min-h-80 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {selectedNotification ? (
            <NotificationDetails
              notification={selectedNotification}
              onDelete={deleteSelectedNotification}
            />
          ) : (
            <div className="flex min-h-80 items-center justify-center p-6">
              <EmptyState title="Pilih notifikasi" description="Pilih notifikasi dari daftar untuk melihat detailnya." />
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function NotificationDetails({
  notification,
  onDelete,
}: {
  notification: MentorNotification
  onDelete: () => void
}) {
  const { Icon, color } = CATEGORY_STYLE[notification.category]
  return (
    <div className="h-full p-5 sm:p-7">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${color}`}>
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900">{notification.title}</h2>
            <p className="mt-1 text-[11px] text-slate-500">{notification.actorRole} · {notification.actorName}</p>
            <p className="mt-1 text-[10px] text-slate-400">{formatNotificationDate(notification.createdAt)}</p>
          </div>
        </div>
        <button type="button" onClick={onDelete} aria-label="Hapus notifikasi ini" title="Hapus notifikasi" className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      </header>

      <p className="mt-7 rounded-xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">
        {notification.message}
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <span className="text-xs text-slate-500">Dikirim oleh {notification.actorName} · {notification.actorRole}</span>
        <Link to={notification.href} className="inline-flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-100">
          <BookOpen className="h-4 w-4" aria-hidden />{notification.actionLabel}
        </Link>
      </div>
    </div>
  )
}
