import { ArrowDown, ArrowUp, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { Field, inputClass } from '../../../components/ui/Field'
import { Modal } from '../../../components/ui/Modal'
import { Notice } from '../../../components/ui/Notice'
import { EmptyState, ErrorState, Spinner } from '../../../components/ui/States'
import { api, toApiError } from '../../../lib/api'
import { formatDateTime } from '../../../lib/format'
import { useApiData } from '../../../lib/useApiData'
import { formatXp } from './utils'
import type { LeaderboardEntry, XpHistory } from './types'

interface Props {
  student: LeaderboardEntry['user']
  onClose: () => void
  onChanged: () => void
}

type Mode = 'history' | 'adjust' | 'reset'
type FieldErrors = Record<string, string[]>

export function XpHistoryModal({ student, onClose, onChanged }: Props) {
  const [mode, setMode] = useState<Mode>('history')
  const [page, setPage] = useState(1)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [general, setGeneral] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const history = useApiData(
    async () => (await api.get<XpHistory>(`/gamification/users/${student.id}/xp`, { params: { page, per_page: 10 } })).data,
    [student.id, page],
  )

  const firstError = (field: string) => errors[field]?.[0]

  const selectMode = (next: Mode) => {
    setMode(next)
    setErrors({})
    setGeneral(null)
    setReason('')
    setAmount('')
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setErrors({})
    setGeneral(null)

    const local: FieldErrors = {}
    const numericAmount = Number(amount)
    if (mode === 'adjust') {
      if (!Number.isInteger(numericAmount) || numericAmount === 0 || Math.abs(numericAmount) > 1_000_000) {
        local.amount = ['Masukkan bilangan bulat bukan 0, maksimal ±1.000.000 XP.']
      } else if (numericAmount < 0 && numericAmount + (history.data?.xp ?? 0) < 0) {
        local.amount = ['Pengurangan tidak boleh membuat saldo XP negatif.']
      }
    }
    if (reason.trim().length < 3 || reason.trim().length > 255) {
      local.reason = ['Alasan wajib diisi sepanjang 3–255 karakter.']
    }
    setErrors(local)
    if (Object.keys(local).length > 0) return

    setSubmitting(true)
    try {
      const response =
        mode === 'adjust'
          ? await api.post<{ message?: string }>(`/gamification/users/${student.id}/xp-adjustments`, {
              amount: numericAmount,
              reason: reason.trim(),
            })
          : await api.post<{ message?: string }>(`/gamification/users/${student.id}/xp-reset`, { reason: reason.trim() })

      setNotice(response.data.message ?? 'XP berhasil diperbarui.')
      selectMode('history')
      history.reload()
      onChanged()
    } catch (error) {
      const apiError = toApiError(error)
      if (apiError.kind === 'validation' && Object.keys(apiError.fieldErrors).length > 0) setErrors(apiError.fieldErrors)
      else setGeneral(apiError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      title={`XP Siswa: ${student.name}`}
      description={student.email}
      onClose={onClose}
      dismissible={!submitting}
      size="lg"
      footer={
        mode === 'history' ? (
          <Button variant="secondary" onClick={onClose} data-autofocus>
            Tutup
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={() => selectMode('history')} disabled={submitting}>
              Kembali
            </Button>
            <Button type="submit" form="xp-form" variant={mode === 'reset' ? 'danger' : 'primary'} loading={submitting}>
              {mode === 'reset' ? 'Reset XP ke 0' : 'Simpan Koreksi'}
            </Button>
          </>
        )
      }
    >
      {notice && (
        <Notice onDismiss={() => setNotice(null)}>
          {notice}
        </Notice>
      )}

      {mode === 'history' && (
        <>
          {history.loading && !history.data && <Spinner label="Memuat riwayat XP…" />}
          {history.error && <ErrorState error={history.error} onRetry={history.reload} />}
          {history.data && (
            <>
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <Card>
                  <p className="text-sm text-slate-500">Saldo XP saat ini</p>
                  <p className="mt-1 text-2xl font-semibold text-ink-900">{formatXp(history.data.xp)} XP</p>
                </Card>
                <Card>
                  <p className="text-sm text-slate-500">Level saat ini</p>
                  <div className="mt-2">
                    {history.data.level ? <Badge tone="info">{history.data.level.name}</Badge> : <span className="text-sm text-slate-500">Belum ada level</span>}
                  </div>
                </Card>
              </div>

              <div className="mb-4 flex flex-wrap gap-2">
                <Button onClick={() => selectMode('adjust')} icon={<SlidersHorizontal className="h-4 w-4" aria-hidden />}>
                  Koreksi XP
                </Button>
                <Button
                  variant="danger"
                  disabled={history.data.xp === 0}
                  onClick={() => selectMode('reset')}
                  icon={<RotateCcw className="h-4 w-4" aria-hidden />}
                >
                  Reset ke 0
                </Button>
              </div>

              <h3 className="mb-2 text-sm font-semibold text-ink-900">Riwayat transaksi</h3>
              {history.data.data.length === 0 ? (
                <EmptyState title="Belum ada transaksi XP" description="Koreksi atau reset XP akan tercatat di sini." />
              ) : (
                <ul className={`divide-y divide-slate-100 rounded-lg border border-slate-200 ${history.loading ? 'opacity-60' : ''}`}>
                  {history.data.data.map((transaction) => (
                    <li key={transaction.id} className="flex flex-wrap items-start justify-between gap-3 px-3 py-3">
                      <div className="flex min-w-0 items-start gap-2.5">
                        <span className={`mt-0.5 rounded-full p-1.5 ${transaction.amount >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                          {transaction.amount >= 0 ? <ArrowUp className="h-4 w-4" aria-hidden /> : <ArrowDown className="h-4 w-4" aria-hidden />}
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800">{transaction.source_label}</p>
                          {transaction.reason && <p className="mt-0.5 break-words text-xs text-slate-600">{transaction.reason}</p>}
                          <p className="mt-1 text-xs text-slate-500">
                            {transaction.created_by ? `Oleh ${transaction.created_by.name} · ` : ''}
                            {formatDateTime(transaction.created_at)}
                          </p>
                        </div>
                      </div>
                      <span className={`font-semibold ${transaction.amount >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        {transaction.amount > 0 ? '+' : ''}
                        {formatXp(transaction.amount)} XP
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {history.data.meta.last_page > 1 && (
                <div className="mt-4 flex items-center justify-between gap-2 text-sm text-slate-500">
                  <span>
                    Halaman {history.data.meta.current_page} dari {history.data.meta.last_page} · {history.data.meta.total} transaksi
                  </span>
                  <div className="flex gap-2">
                    <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                      Sebelumnya
                    </Button>
                    <Button variant="secondary" disabled={page >= history.data.meta.last_page} onClick={() => setPage((current) => current + 1)}>
                      Berikutnya
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {(mode === 'adjust' || mode === 'reset') && (
        <form id="xp-form" onSubmit={onSubmit} noValidate className="space-y-4">
          {general && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {general}
            </p>
          )}
          {mode === 'adjust' ? (
            <Field id="xp-amount" label="Jumlah XP" error={firstError('amount')} hint="Nilai positif menambah XP, nilai negatif mengurangi XP. Maksimal ±1.000.000.">
              <input
                id="xp-amount"
                type="number"
                min={-1_000_000}
                max={1_000_000}
                step={1}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                aria-invalid={!!firstError('amount')}
                aria-describedby="xp-amount-help"
                className={inputClass(!!firstError('amount'))}
              />
            </Field>
          ) : (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              XP Siswa akan dikembalikan ke 0. Riwayat tidak dihapus; sistem mencatat satu transaksi reset dengan alasan yang diberikan.
            </div>
          )}
          <Field id="xp-reason" label={mode === 'reset' ? 'Alasan reset' : 'Alasan koreksi'} error={firstError('reason')} hint="Wajib diisi, 3–255 karakter.">
            <textarea
              id="xp-reason"
              data-autofocus
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              maxLength={255}
              aria-invalid={!!firstError('reason')}
              aria-describedby="xp-reason-help"
              className={inputClass(!!firstError('reason'))}
            />
          </Field>
        </form>
      )}
    </Modal>
  )
}
