import { Bell, ChevronDown, LogOut } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { ROLE_CONFIG } from '../config/navigation'
import { initials } from '../lib/format'

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
  const { open, setOpen, ref } = usePopover()
  const color = tone === 'dark' ? 'text-white/80 hover:bg-white/10' : 'text-slate-600 hover:bg-slate-100'

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Notifikasi"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`rounded-lg p-2 transition-colors ${color}`}
      >
        <Bell className="h-5 w-5" aria-hidden />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-lg">
          <p className="font-semibold text-slate-800">Notifikasi</p>
          <p className="mt-1 text-slate-500">Fitur belum tersedia pada tahap ini</p>
        </div>
      )}
    </div>
  )
}

export function UserMenu({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const { user, logout } = useAuth()
  const { open, setOpen, ref } = usePopover()
  const [busy, setBusy] = useState(false)

  if (!user) return null

  const roleLabel = user.primary_role ? ROLE_CONFIG[user.primary_role].label : 'Tanpa role'
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
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-400 text-xs font-bold text-ink-900">
          {initials(user.name)}
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block max-w-[10rem] truncate text-sm font-semibold">{user.name}</span>
          <span className={`block text-xs ${sub}`}>{roleLabel}</span>
        </span>
        <ChevronDown className="h-4 w-4" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 text-slate-700 shadow-lg">
          <div className="border-b border-slate-100 px-3 py-2">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
            <p className="mt-1 text-xs font-medium text-brand-700">{roleLabel}</p>
          </div>
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
