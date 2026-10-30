import { AlertCircle, CheckCircle2, X } from 'lucide-react'
import type { ReactNode } from 'react'

const TONES = {
  success: { box: 'border-emerald-200 bg-emerald-50 text-emerald-800', Icon: CheckCircle2, role: 'status' },
  error: { box: 'border-red-200 bg-red-50 text-red-800', Icon: AlertCircle, role: 'alert' },
} as const

/** Banner pesan singkat (berhasil/gagal). */
export function Notice({ tone = 'success', children, onDismiss }: { tone?: keyof typeof TONES; children: ReactNode; onDismiss?: () => void }) {
  const { box, Icon, role } = TONES[tone]
  return (
    <div role={role} className={`mb-4 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${box}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p className="flex-1">{children}</p>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Tutup pesan" className="rounded p-0.5 opacity-70 hover:opacity-100">
          <X className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  )
}
