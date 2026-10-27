import { AlertTriangle, Inbox, Loader2, ShieldAlert, WifiOff } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ApiError } from '../../lib/api'
import { Button } from './Button'

export function Spinner({ label = 'Memuat…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      {label}
    </div>
  )
}

export function FullScreenLoading({ label = 'Memeriksa sesi…' }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <Spinner label={label} />
    </div>
  )
}

export function EmptyState({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Inbox className="h-6 w-6" aria-hidden />
      </span>
      <h3 className="mt-3 text-sm font-semibold text-slate-700">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {children}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: ApiError | Error; onRetry?: () => void }) {
  const kind = 'kind' in error ? error.kind : 'unknown'
  const Icon = kind === 'network' ? WifiOff : kind === 'forbidden' ? ShieldAlert : AlertTriangle
  const title =
    kind === 'network' ? 'Server tidak dapat dihubungi' : kind === 'forbidden' ? 'Akses ditolak' : 'Terjadi kesalahan'

  return (
    <div role="alert" className="flex flex-col items-center px-4 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500">
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <h3 className="mt-3 text-sm font-semibold text-slate-800">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-slate-500">{error.message}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-4" onClick={onRetry}>
          Coba lagi
        </Button>
      )}
    </div>
  )
}
