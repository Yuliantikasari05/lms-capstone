import type { ReactNode } from 'react'

export function Card({ title, action, children, className = '' }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-ink-900">{title}</h2>
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  )
}

interface StatCardProps {
  label: string
  /** Nilai nyata dari backend. `null`/`undefined` berarti belum tersedia. */
  value?: number | string | null
  hint?: string
}

export function StatCard({ label, value, hint }: StatCardProps) {
  const available = value !== null && value !== undefined
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${available ? 'text-ink-900' : 'text-slate-300'}`}>
        {available ? value : '—'}
      </p>
      <p className="mt-1 text-xs text-slate-500">{available ? hint : 'Data belum tersedia pada tahap ini'}</p>
    </div>
  )
}
