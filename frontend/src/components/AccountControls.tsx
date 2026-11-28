import { Bell, ChevronDown, CreditCard, LogOut, UserCircle } from 'lucide-react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ROLE_CONFIG, roleHome } from '../config/navigation'
import { useNotifications } from '../lib/notifications'
import type { RoleSlug } from '../types'
import { NotificationPopover } from './NotificationPopover'
import { ProfileAvatar } from './ProfileAvatar'
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

/** Peran yang sudah punya notifikasi: keterangan isi dan halaman daftar lengkapnya. */
const NOTIFICATION_VIEWS: Partial<Record<RoleSlug, { subtitle: string; allHref: string }>> = {
  siswa: { subtitle: 'Nilai tugas, jadwal, dan pencapaian belajarmu.', allHref: '/siswa/notifications' },
  mentor: { subtitle: 'Pembaruan dari peserta dan admin.', allHref: '/mentor/notifications' },
  admin: { subtitle: 'Pembaruan pengguna, kursus, dan operasional platform.', allHref: '/admin/notifications' },
  lembaga: { subtitle: 'Siswa program, voucher, dan pencairan dana lembaga.', allHref: '/lembaga/notifications' },
}

export function NotificationButton({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const { user } = useAuth()
  const view = user?.primary_role ? NOTIFICATION_VIEWS[user.primary_role] : undefined
  // Hook dipanggil tanpa syarat; peran tanpa notifikasi cukup mengirim userId null (tidak memuat apa pun).
  const notifications = useNotifications(view ? (user?.id ?? null) : null)
  const { open, setOpen, ref } = usePopover()
  const color = tone === 'dark' ? 'text-white/80 hover:bg-white/10' : 'text-slate-600 hover:bg-slate-100'
  const unreadCount = notifications.items.filter((notification) => !notification.is_read).length

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={view && unreadCount ? `Notifikasi, ${unreadCount} belum dibaca` : 'Notifikasi'}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`relative rounded-lg p-2 transition-colors ${color}`}
      >
        <Bell className="h-5 w-5" aria-hidden />
        {view && unreadCount > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        view
          ? (
            <NotificationPopover
              userId={user?.id ?? null}
              subtitle={view.subtitle}
              allHref={view.allHref}
              onClose={() => setOpen(false)}
            />
          )
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
