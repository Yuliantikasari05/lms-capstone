import { type FormEvent, type ReactNode, useState } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card, StatCard } from '../../../components/ui/Card'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { Field, inputClass } from '../../../components/ui/Field'
import { Modal } from '../../../components/ui/Modal'
import { Notice } from '../../../components/ui/Notice'
import { EmptyState, ErrorState, Spinner } from '../../../components/ui/States'
import { api, toApiError } from '../../../lib/api'
import { formatDateTime } from '../../../lib/format'
import { useApiData } from '../../../lib/useApiData'
import type { Institution, InstitutionDashboardResponse, Payout, PayoutListResponse } from './types'

const MONEY = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
const NUMBER = new Intl.NumberFormat('id-ID')
const PAYOUT_TONE = { pending: 'warning', completed: 'success', cancelled: 'neutral' } as const

type FieldErrors = Record<string, string[]>
type PayoutAction = { payout: Payout; status: 'completed' | 'cancelled' } | null

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-2 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="col-span-2 break-words text-slate-800">{children}</dd>
    </div>
  )
}

export function InstitutionDetailModal({
  institution,
  onClose,
  onChanged,
}: {
  institution: Institution
  onClose: () => void
  onChanged: () => void
}) {
  const [period, setPeriod] = useState('3m')
  const [payoutPage, setPayoutPage] = useState(1)
  const [showPayoutForm, setShowPayoutForm] = useState(false)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [payoutErrors, setPayoutErrors] = useState<FieldErrors>({})
  const [payoutError, setPayoutError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [action, setAction] = useState<PayoutAction>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const dashboard = useApiData(
    async () => (await api.get<InstitutionDashboardResponse>(`/institutions/${institution.id}/dashboard`, { params: { period } })).data,
    [institution.id, period],
  )
  const payouts = useApiData(
    async () => (await api.get<PayoutListResponse>(`/institutions/${institution.id}/payouts`, { params: { per_page: 10, page: payoutPage } })).data,
    [institution.id, payoutPage],
  )

  const data = dashboard.data?.data
  const rows = payouts.data?.data ?? []
  const maxRevenue = Math.max(1, ...(data?.revenue_chart.points.map((point) => point.institution_amount + point.platform_amount) ?? [0]))
  const firstError = (field: string) => payoutErrors[field]?.[0]

  const createPayout = async (event: FormEvent) => {
    event.preventDefault()
    setPayoutError(null)
    setPayoutErrors({})
    const numericAmount = amount === '' ? null : Number(amount)
    const local: FieldErrors = {}
    if (numericAmount !== null && (!Number.isInteger(numericAmount) || numericAmount < 1)) {
      local.amount = ['Jumlah pencairan harus bilangan bulat lebih dari 0.']
    }
    if (note.length > 255) local.note = ['Catatan maksimal 255 karakter.']
    setPayoutErrors(local)
    if (Object.keys(local).length > 0) return

    setSubmitting(true)
    try {
      const response = await api.post<{ message?: string }>(`/institutions/${institution.id}/payouts`, {
        amount: numericAmount,
        note: note.trim() || null,
      })
      setNotice(response.data.message ?? 'Pencairan dana berhasil diajukan.')
      setShowPayoutForm(false)
      setAmount('')
      setNote('')
      dashboard.reload()
      payouts.reload()
      onChanged()
    } catch (error) {
      const apiError = toApiError(error)
      if (apiError.kind === 'validation' && Object.keys(apiError.fieldErrors).length > 0) setPayoutErrors(apiError.fieldErrors)
      else setPayoutError(apiError.message)
    } finally {
      setSubmitting(false)
    }
  }

  const processPayout = async () => {
    if (!action) return
    setActionBusy(true)
    setActionError(null)
    try {
      const response = await api.patch<{ message?: string }>(`/institutions/${institution.id}/payouts/${action.payout.id}`, { status: action.status })
      setNotice(response.data.message ?? (action.status === 'completed' ? 'Pencairan ditandai selesai.' : 'Pencairan dibatalkan.'))
      setAction(null)
      dashboard.reload()
      payouts.reload()
      onChanged()
    } catch (error) {
      setActionError(toApiError(error).message)
    } finally {
      setActionBusy(false)
    }
  }

  return (
    <>
      <Modal
        open
        title={`Detail Lembaga — ${institution.name}`}
        description={institution.email ?? undefined}
        onClose={onClose}
        size="xl"
        footer={
          <Button variant="secondary" onClick={onClose}>
            Tutup
          </Button>
        }
      >
        {notice && <Notice onDismiss={() => setNotice(null)}>{notice}</Notice>}
        {dashboard.loading && !dashboard.data && <Spinner label="Memuat dashboard lembaga…" />}
        {dashboard.error && <ErrorState error={dashboard.error} onRetry={dashboard.reload} />}
        {dashboard.data && data && (
          <>
            <section aria-label="Profil lembaga" className="mb-5">
              <h3 className="mb-2 text-sm font-semibold text-ink-900">Profil dan akun</h3>
              <dl className="divide-y divide-slate-100 border-y border-slate-100">
                <InfoRow label="Status">
                  <Badge tone={institution.status ? ({ active: 'success', inactive: 'neutral', suspended: 'danger' } as const)[institution.status] : 'neutral'}>
                    {institution.status_label ?? '—'}
                  </Badge>
                </InfoRow>
                <InfoRow label="Telepon">{institution.phone ?? '—'}</InfoRow>
                <InfoRow label="Alamat">{institution.address ?? '—'}</InfoRow>
                <InfoRow label="Bagi hasil">{institution.revenue_share_percent === null ? 'Belum diatur' : `${institution.revenue_share_percent}% lembaga / ${100 - institution.revenue_share_percent}% platform`}</InfoRow>
                <InfoRow label="Rekening">{institution.bank.label ?? 'Belum diatur'}</InfoRow>
                <InfoRow label="Login terakhir">{formatDateTime(institution.account?.last_login_at)}</InfoRow>
              </dl>
            </section>

            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-ink-900">Ringkasan kinerja</h3>
                <p className="text-xs text-slate-500">Angka pendapatan dan penjualan menyesuaikan periode; saldo adalah total keseluruhan.</p>
              </div>
              <select value={period} onChange={(event) => setPeriod(event.target.value)} aria-label="Periode dashboard" className={`${inputClass()} !w-auto`}>
                {(dashboard.data.periods ?? []).map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <StatCard label="Pendapatan lembaga" value={MONEY.format(data.cards.total_revenue.value)} hint={data.cards.total_revenue.change_percent === null ? 'Belum ada pembanding periode sebelumnya' : `${data.cards.total_revenue.change_percent}% dari periode sebelumnya`} />
              <StatCard label="Konten terjual" value={NUMBER.format(data.cards.content_sold.value)} />
              <StatCard label="Siswa aktif" value={NUMBER.format(data.cards.active_students.value)} hint={`${NUMBER.format(data.cards.active_students.new_in_period)} baru pada periode ini`} />
              <StatCard label="Program aktif" value={NUMBER.format(data.cards.active_programs.value)} hint={`${NUMBER.format(data.cards.active_programs.released_in_period)} dirilis pada periode ini`} />
              <StatCard label="Saldo tersedia" value={MONEY.format(data.finance.available_balance)} hint="Setelah pencairan menunggu dan selesai" />
              <StatCard label="Voucher aktif" value={NUMBER.format(data.active_vouchers.total)} />
            </div>

            <Card title="Grafik pendapatan">
              {data.revenue_chart.points.length === 0 ? (
                <EmptyState title="Belum ada data pendapatan" />
              ) : (
                <div className="space-y-2" aria-label="Grafik pendapatan lembaga dan platform">
                  {data.revenue_chart.points.map((point) => {
                    const institutionWidth = (point.institution_amount / maxRevenue) * 100
                    const platformWidth = (point.platform_amount / maxRevenue) * 100
                    return (
                      <div key={point.key} className="grid grid-cols-[4rem_1fr_auto] items-center gap-2 text-xs">
                        <span className="text-slate-500">{point.label}</span>
                        <div className="flex h-3 overflow-hidden rounded-full bg-slate-100" title={`Lembaga ${MONEY.format(point.institution_amount)}, platform ${MONEY.format(point.platform_amount)}`}>
                          <span className="bg-brand-500" style={{ width: `${institutionWidth}%` }} />
                          <span className="bg-amber-400" style={{ width: `${platformWidth}%` }} />
                        </div>
                        <span className="w-24 text-right text-slate-600">{MONEY.format(point.institution_amount + point.platform_amount)}</span>
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="mt-3 flex gap-4 text-xs text-slate-500">
                <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-brand-500" />Bagian lembaga</span>
                <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />Bagian platform</span>
              </div>
            </Card>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <Card title="Program terlaris">
                {data.top_programs.length === 0 ? (
                  <EmptyState title="Belum ada penjualan program" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[24rem] text-left text-sm">
                      <thead className="text-xs text-slate-500">
                        <tr><th className="pb-2">Program</th><th className="pb-2">Terjual</th><th className="pb-2">Pendapatan</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.top_programs.map((program) => (
                          <tr key={program.course.id}>
                            <td className="py-2.5 font-medium text-slate-800">{program.course.title}</td>
                            <td className="py-2.5">{program.sold}</td>
                            <td className="py-2.5">{MONEY.format(program.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
              <Card title="Perkembangan siswa">
                {data.student_progress.length === 0 ? (
                  <EmptyState title="Belum ada siswa aktif" />
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {data.student_progress.map((row) => (
                      <li key={`${row.user.id}-${row.program.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-800">{row.user.name ?? 'Akun dihapus'}</p>
                          <p className="truncate text-xs text-slate-500">{row.program.title ?? 'Program tidak tersedia'}</p>
                        </div>
                        <span className="shrink-0 text-xs text-slate-500">{row.progress_percent === null ? 'Progres belum tersedia' : `${row.progress_percent}%`}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            <Card title="Voucher aktif" className="mt-5">
              {data.active_vouchers.items.length === 0 ? (
                <EmptyState title="Tidak ada voucher aktif" description="Voucher Lembaga akan tampil setelah alur voucher tersedia." />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {data.active_vouchers.items.map((voucher) => (
                    <Badge key={voucher.id} tone="info">
                      {voucher.code} · {voucher.discount_label} · {voucher.usage_label}
                    </Badge>
                  ))}
                </div>
              )}
            </Card>

            <Card
              title="Riwayat pencairan dana"
              className="mt-5"
              action={
                institution.abilities?.manage_payouts && data.finance.can_request_payout ? (
                  <Button variant="secondary" onClick={() => setShowPayoutForm((visible) => !visible)}>
                    {showPayoutForm ? 'Tutup form' : 'Ajukan Pencairan'}
                  </Button>
                ) : undefined
              }
            >
              {showPayoutForm && (
                <form onSubmit={createPayout} noValidate className="mb-4 grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-2">
                  {payoutError && <p role="alert" className="sm:col-span-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{payoutError}</p>}
                  <Field id="payout-amount" label="Jumlah (Rp)" error={firstError('amount')} hint="Kosongkan untuk mencairkan seluruh saldo tersedia.">
                    <input id="payout-amount" type="number" min={1} step={1} value={amount} onChange={(event) => setAmount(event.target.value)} aria-invalid={!!firstError('amount')} aria-describedby={firstError('amount') ? 'payout-amount-help' : 'payout-amount-help'} className={inputClass(!!firstError('amount'))} />
                  </Field>
                  <Field id="payout-note" label="Catatan (opsional)" error={firstError('note')}>
                    <input id="payout-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={255} aria-invalid={!!firstError('note')} aria-describedby={firstError('note') ? 'payout-note-help' : undefined} className={inputClass(!!firstError('note'))} />
                  </Field>
                  <div className="sm:col-span-2 flex justify-end">
                    <Button type="submit" loading={submitting}>Ajukan Pencairan</Button>
                  </div>
                </form>
              )}

              {payouts.loading && !payouts.data && <Spinner label="Memuat riwayat pencairan…" />}
              {payouts.error && <ErrorState error={payouts.error} onRetry={payouts.reload} />}
              {payouts.data && rows.length === 0 && <EmptyState title="Belum ada pencairan dana" />}
              {payouts.data && rows.length > 0 && (
                <div className={`overflow-x-auto ${payouts.loading ? 'opacity-60' : ''}`}>
                  <table className="w-full min-w-[44rem] text-left text-sm">
                    <thead className="text-xs text-slate-500">
                      <tr><th className="pb-2">Kode</th><th className="pb-2">Jumlah</th><th className="pb-2">Tujuan</th><th className="pb-2">Tanggal</th><th className="pb-2">Status</th><th className="pb-2 text-right">Aksi</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((payout) => (
                        <tr key={payout.id}>
                          <td className="py-2.5 font-medium text-slate-800">{payout.code}</td>
                          <td className="py-2.5">{MONEY.format(payout.amount)}</td>
                          <td className="py-2.5">{payout.destination.label ?? '—'}</td>
                          <td className="py-2.5">{formatDateTime(payout.requested_at)}</td>
                          <td className="py-2.5"><Badge tone={PAYOUT_TONE[payout.status]}>{payout.status_label}</Badge></td>
                          <td className="py-2.5 text-right">
                            {payout.status === 'pending' && institution.abilities?.manage_payouts && (
                              <div className="flex justify-end gap-1">
                                <Button variant="secondary" className="!px-2 !py-1 text-xs" onClick={() => { setActionError(null); setAction({ payout, status: 'completed' }) }}>Selesaikan</Button>
                                <Button variant="ghost" className="!px-2 !py-1 text-xs text-red-600" onClick={() => { setActionError(null); setAction({ payout, status: 'cancelled' }) }}>Batalkan</Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-3 text-xs text-slate-500">
                    Saldo tersedia {MONEY.format(payouts.data.summary.available_balance)} · Menunggu {MONEY.format(payouts.data.summary.pending_total)} · Selesai {MONEY.format(payouts.data.summary.completed_total)}
                  </p>
                  {payouts.data.meta.last_page > 1 && (
                    <div className="mt-3 flex items-center justify-between gap-2 text-sm text-slate-500">
                      <span>Halaman {payouts.data.meta.current_page} dari {payouts.data.meta.last_page}</span>
                      <div className="flex gap-2">
                        <Button variant="secondary" disabled={payoutPage <= 1 || payouts.loading} onClick={() => setPayoutPage((current) => current - 1)}>
                          Sebelumnya
                        </Button>
                        <Button variant="secondary" disabled={payoutPage >= payouts.data.meta.last_page || payouts.loading} onClick={() => setPayoutPage((current) => current + 1)}>
                          Berikutnya
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={!!action}
        title={action?.status === 'completed' ? 'Selesaikan pencairan?' : 'Batalkan pencairan?'}
        tone={action?.status === 'cancelled' ? 'danger' : 'primary'}
        confirmLabel={action?.status === 'completed' ? 'Tandai Selesai' : 'Batalkan'}
        loading={actionBusy}
        error={actionError}
        onCancel={() => setAction(null)}
        onConfirm={() => void processPayout()}
        message={
          action && (
            <>
              Pencairan <strong>{action.payout.code}</strong> sebesar <strong>{MONEY.format(action.payout.amount)}</strong> akan {action.status === 'completed' ? 'ditandai selesai' : 'dibatalkan'}.
            </>
          )
        }
      />
    </>
  )
}
