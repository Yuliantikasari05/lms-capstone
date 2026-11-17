import { Bell, BookOpen, ChevronDown, ClipboardCheck, CreditCard, FileText, LogOut, MessageSquare, Star, Users, UserCircle } from 'lucide-react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ROLE_CONFIG, roleHome } from '../config/navigation'
import { ProfileAvatar } from './ProfileAvatar'
import {
  clearMentorNotifications,
  formatNotificationDate,
  getMentorNotifications,
  markMentorNotificationRead,
  subscribeMentorNotifications,
  type MentorNotification,
} from '../pages/mentor/notificationData'
import { getMentorProfile, subscribeMentorProfile } from '../pages/mentor/profileData'

/** Menutup popover saat klik di luar atau menekan Escape. */
function usePopover() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return { open, setOpen, ref }
}

export function NotificationButton({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const { user } = useAuth()
  const notifications = useSyncExternalStore(subscribeMentorNotifications, getMentorNotifications)
  const { open, setOpen, ref } = usePopover()
  const color = tone === 'dark' ? 'text-white/80 hover:bg-white/10' : 'text-slate-600 hover:bg-slate-100'
  const unreadCount = notifications.filter((notification) => !notification.isRead).length
  const isMentor = user?.primary_role === 'mentor'

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={isMentor && unreadCount ? `Notifikasi, ${unreadCount} belum dibaca` : 'Notifikasi'}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`relative rounded-lg p-2 transition-colors ${color}`}
      >
        <Bell className="h-5 w-5" aria-hidden />
        {isMentor && unreadCount > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        isMentor
          ? <MentorNotificationPopover onClose={() => setOpen(false)} />
          : (
            <div className="absolute right-0 z-40 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-lg">
              <p className="font-semibold text-slate-800">Notifikasi</p>
              <p className="mt-1 text-slate-500">Fitur belum tersedia pada tahap ini</p>
            </div>
          )
      )}
    </div>
  )
}

const NOTIFICATION_STYLE = {
  assessment: { Icon: ClipboardCheck, color: 'bg-amber-50 text-amber-600' },
  review: { Icon: Star, color: 'bg-yellow-50 text-yellow-600' },
  discussion: { Icon: MessageSquare, color: 'bg-violet-50 text-violet-600' },
  submission: { Icon: FileText, color: 'bg-blue-50 text-blue-600' },
  roster: { Icon: Users, color: 'bg-emerald-50 text-emerald-600' },
} as const

function MentorNotificationPopover({ onClose }: { onClose: () => void }) {
  const notifications = useSyncExternalStore(subscribeMentorNotifications, getMentorNotifications)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const navigate = useNavigate()
  const unreadCount = notifications.filter((notification) => !notification.isRead).length
  const visibleNotifications = notifications
    .filter((notification) => filter === 'all' || !notification.isRead)
    .slice(0, 3)

  function openNotification(notification: MentorNotification) {
    markMentorNotificationRead(notification.id)
    onClose()
    navigate(`/mentor/notifications?id=${encodeURIComponent(notification.id)}`)
  }

  return (
    <div className="absolute right-0 z-40 mt-2 w-[min(90vw,24rem)] overflow-hidden rounded-xl border border-slate-200 bg-white text-sm shadow-xl">
      <header className="bg-slate-50 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-slate-900">Notifikasi</p>
          <span className="rounded-full bg-brand-50 px-2 py-1 text-[10px] font-medium text-brand-700">{unreadCount} belum dibaca</span>
        </div>
        <p className="mt-1 text-xs text-slate-500">Pembaruan dari peserta dan admin.</p>
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
        {visibleNotifications.length ? visibleNotifications.map((notification) => {
          const { Icon, color } = NOTIFICATION_STYLE[notification.category]
          return (
            <article key={notification.id} className={`border-b border-slate-100 px-4 py-3 last:border-b-0 ${notification.isRead ? '' : 'bg-white'}`}>
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
                    <span className="text-[10px] text-slate-400">{formatNotificationDate(notification.createdAt)}</span>
                    <Link
                      to={notification.href}
                      onClick={() => { markMentorNotificationRead(notification.id); onClose() }}
                      className="inline-flex items-center gap-1 rounded bg-brand-50 px-2 py-1 text-[10px] font-semibold text-brand-700 hover:bg-brand-100"
                    >
                      {notification.actionLabel}<BookOpen className="h-3 w-3" aria-hidden />
                    </Link>
                  </div>
                </div>
                {!notification.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-label="Belum dibaca" />}
              </div>
            </article>
          )
        }) : (
          <p className="px-4 py-8 text-center text-xs text-slate-500">Tidak ada notifikasi untuk ditampilkan.</p>
        )}
      </div>

      <footer className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
        <button type="button" onClick={clearMentorNotifications} className="text-xs font-medium text-rose-600 hover:text-rose-700">
          Bersihkan
        </button>
        <Link to="/mentor/notifications" onClick={onClose} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800">
          Lihat semua <span aria-hidden>→</span>
        </Link>
      </footer>
    </div>
  )
}

export function UserMenu({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const { user, logout } = useAuth()
  const { open, setOpen, ref } = usePopover()
  const [busy, setBusy] = useState(false)
  const profile = useSyncExternalStore(
    subscribeMentorProfile,
    () => getMentorProfile(user?.id ?? -1, user?.name ?? ''),
  )

  if (!user) return null

  const role = user.primary_role
  const roleLabel = role ? ROLE_CONFIG[role].label : 'Tanpa role'
  const displayName = role === 'mentor' ? profile.name : user.name
  // Profil untuk semua role; Pembayaran hanya untuk role yang punya halamannya.
  const links = role
    ? [
        { label: 'Profil', to: `${roleHome(role)}/profile`, Icon: UserCircle },
        ...(ROLE_CONFIG[role].items.some((item) => item.key === 'payments')
          ? [{ label: 'Pembayaran', to: `${roleHome(role)}/payments`, Icon: CreditCard }]
          : []),
      ]
    : []
  const text = tone === 'dark' ? 'text-white hover:bg-white/10' : 'text-slate-700 hover:bg-slate-100'
  const sub = tone === 'dark' ? 'text-white/60' : 'text-slate-500'

  const onLogout = async () => {
    setBusy(true)
    await logout()
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition-colors ${text}`}
      >
        <ProfileAvatar name={displayName} avatar={role === 'mentor' ? profile.avatar : undefined} className="h-8 w-8 text-base" />
        <span className="hidden text-left leading-tight sm:block">
          <span className="block max-w-[10rem] truncate text-sm font-semibold">{displayName}</span>
          <span className={`block text-xs ${sub}`}>{roleLabel}</span>
        </span>
        <ChevronDown className="h-4 w-4" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 text-slate-700 shadow-lg">
          <div className="border-b border-slate-100 px-3 py-2">
            <p className="truncate text-sm font-semibold">{displayName}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
            <p className="mt-1 text-xs font-medium text-brand-700">{roleLabel}</p>
          </div>
          {links.map(({ label, to, Icon }) => (
            <Link
              key={to}
              to={to}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-50"
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </Link>
          ))}
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            onClick={onLogout}
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            {busy ? 'Keluar…' : 'Logout'}
          </button>
        </div>
      )}
    </div>
  )
}

/** Notifikasi + menu akun, dipakai konsisten oleh semua layout. */
export function AccountControls({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  return (
    <div className="flex items-center gap-1">
      <NotificationButton tone={tone} />
      <UserMenu tone={tone} />
    </div>
  )
}