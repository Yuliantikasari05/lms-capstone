import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  Copy,
  MoreVertical,
  Plus,
  Ticket,
  Trash2,
} from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '../../components/ui/Button'
import { Field, inputClass } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { ErrorState, Spinner } from '../../components/ui/States'
import { toApiError } from '../../lib/api'
import { useApiData } from '../../lib/useApiData'
import { LembagaPageHeader } from './LembagaPageHeader'
import {
  createVoucher,
  deleteVoucher,
  fetchPrograms,
  fetchVouchers,
  updateVoucher,
  type LembagaVoucher,
} from './api'

type VoucherDialog = 'create' | 'edit' | 'detail' | null

const EMPTY_FORM = {
  name: '',
  code: '',
  discount: '20',
  quota: '100',
  expiresAt: '',
  module: '',
}

function formatDate(date: string | null) {
  if (!date) return 'Belum ditentukan'
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date.slice(0, 10)}T00:00:00Z`))
}

export default function LembagaVoucher() {
  const vouchers = useApiData(fetchVouchers, [])
  const programs = useApiData(fetchPrograms, [])
  const [dialog, setDialog] = useState<VoucherDialog>(null)
  const [selectedVoucher, setSelectedVoucher] = useState<LembagaVoucher | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LembagaVoucher | null>(null)
  const [menuVoucherId, setMenuVoucherId] = useState<number | null>(null)
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [busy, setBusy] = useState(false)

  const list = vouchers.data?.data ?? []
  const summary = vouchers.data?.summary
  const moduleList = programs.data ?? []

  function openCreate() {
    setSelectedVoucher(null)
    setForm({ ...EMPTY_FORM, module: moduleList[0]?.title ?? '' })
    setDialog('create')
  }

  function openVoucher(voucher: LembagaVoucher, mode: 'edit' | 'detail') {
    setSelectedVoucher(voucher)
    setForm({
      name: voucher.name ?? '',
      code: voucher.code,
      discount: String(voucher.discount_value),
      quota: String(voucher.usage_limit ?? 0),
      expiresAt: voucher.expires_at?.slice(0, 10) ?? '',
      module: voucher.course?.title ?? moduleList[0]?.title ?? '',
    })
    setDialog(mode)
    setMenuVoucherId(null)
  }

  function courseIdFor(title: string): number | null {
    return moduleList.find((program) => program.title === title)?.id ?? null
  }

  async function saveVoucher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = form.name.trim()
    const code = form.code.trim().toUpperCase()
    const discount = Number(form.discount)
    const quota = Number(form.quota)
    if (!name || !code || !form.expiresAt || !Number.isFinite(discount) || discount <= 0 || discount > 100 || !Number.isInteger(quota) || quota < 1) {
      setNotice('Lengkapi nama, kode, diskon 1–100%, kuota, dan tanggal kedaluwarsa.')
      return
    }

    setBusy(true)
    try {
      const payload = {
        name,
        code,
        discount_type: 'percentage' as const,
        discount_value: discount,
        usage_limit: quota,
        course_id: courseIdFor(form.module),
        expires_at: form.expiresAt,
      }

      if (dialog === 'edit' && selectedVoucher) {
        await updateVoucher(selectedVoucher.id, payload)
        setNotice(`Voucher "${name}" berhasil diperbarui.`)
      } else {
        await createVoucher(payload)
        setNotice(`Voucher "${name}" berhasil dibuat.`)
      }

      setDialog(null)
      vouchers.reload()
    } catch (error) {
      setNotice(toApiError(error).message)
    } finally {
      setBusy(false)
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      setNotice(`Kode ${code} disalin.`)
    } catch {
      setNotice('Kode tidak dapat disalin otomatis. Silakan salin kode voucher secara manual.')
    }
  }

  async function toggleActive(voucher: LembagaVoucher) {
    setBusy(true)
    try {
      await updateVoucher(voucher.id, { is_active: !voucher.is_active })
      setMenuVoucherId(null)
      setNotice(`Status voucher "${voucher.name ?? voucher.code}" diperbarui.`)
      vouchers.reload()
    } catch (error) {
      setNotice(toApiError(error).message)
    } finally {
      setBusy(false)
    }
  }

  async function removeVoucher() {
    if (!deleteTarget) return
    setBusy(true)
    try {
      await deleteVoucher(deleteTarget.id)
      setNotice(`Voucher "${deleteTarget.name ?? deleteTarget.code}" berhasil dihapus.`)
      setDeleteTarget(null)
      vouchers.reload()
    } catch (error) {
      setNotice(toApiError(error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <LembagaPageHeader
        subtitle="Kelola diskon dan akses khusus melalui sistem voucher."
        onReportClick={() => setNotice('Laporan voucher: lihat ringkasan pada metrik di atas.')}
      />

      {notice && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <span>{notice}</span>
          <button type="button" className="font-semibold hover:underline" onClick={() => setNotice('')}>Tutup</button>
        </div>
      )}

      {vouchers.error && <ErrorState error={vouchers.error} onRetry={vouchers.reload} />}

      <section aria-label="Metrik voucher" className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="TOTAL VOUCHER AKTIF" value={String(summary?.active_total ?? 0)} icon={<Ticket className="h-4 w-4" aria-hidden />} tone="blue" />
        <MetricCard label="TOTAL DIGUNAKAN" value={String(summary?.used_total ?? 0)} icon={<CheckCircle2 className="h-4 w-4" aria-hidden />} tone="green" />
        <MetricCard label="AKAN KEDALUWARSA" value={String(summary?.expiring_soon ?? 0)} icon={<AlertTriangle className="h-4 w-4" aria-hidden />} tone="red" />
      </section>

      <section aria-labelledby="voucher-heading">
        <div className="flex items-center justify-between gap-3 rounded-t-xl border border-slate-200 bg-white px-4 py-3.5 sm:px-5">
          <h1 id="voucher-heading" className="text-lg font-bold text-slate-900">Voucher</h1>
          <Button onClick={openCreate} icon={<Plus className="h-4 w-4" aria-hidden />} className="shrink-0 px-3 py-2 text-xs sm:text-sm">
            Tambah Voucher
          </Button>
        </div>
        <div className="grid gap-4 rounded-b-xl border-x border-b border-slate-200 bg-slate-50/60 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
          {vouchers.loading && !vouchers.data && (
            <div className="sm:col-span-2 xl:col-span-3"><Spinner label="Memuat voucher…" /></div>
          )}
          {list.map((voucher) => {
            const available = voucher.status === 'active'
            const quota = voucher.usage_limit ?? 0
            const progress = quota > 0 ? Math.min((voucher.used_count / quota) * 100, 100) : 0
            const name = voucher.name ?? voucher.code

            return (
              <article key={voucher.id} className="relative flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${available ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {available && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />}
                    {available ? 'Aktif' : voucher.status_label}
                  </span>
                  <div className="relative">
                    <button
                      type="button"
                      aria-label={`Opsi voucher ${name}`}
                      aria-expanded={menuVoucherId === voucher.id}
                      onClick={() => setMenuVoucherId((current) => current === voucher.id ? null : voucher.id)}
                      className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
                    >
                      <MoreVertical className="h-4 w-4" aria-hidden />
                    </button>
                    {menuVoucherId === voucher.id && (
                      <div className="absolute right-0 top-full z-10 mt-1 w-36 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                        <button type="button" onClick={() => openVoucher(voucher, 'edit')} className="block w-full rounded-md px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50">Edit voucher</button>
                        <button
                          type="button"
                          onClick={() => toggleActive(voucher)}
                          disabled={busy}
                          className="block w-full rounded-md px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          {voucher.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <h2 className="mt-2 truncate text-sm font-semibold text-slate-900" title={name}>{name}</h2>
                <div className="mt-2 flex w-fit items-center gap-1 rounded-md bg-slate-100 px-2 py-1">
                  <span className="font-mono text-[11px] font-bold tracking-wider text-brand-700">{voucher.code}</span>
                  <button type="button" aria-label={`Salin kode ${voucher.code}`} title="Salin kode" onClick={() => copyCode(voucher.code)} className="rounded p-0.5 text-slate-500 hover:bg-white hover:text-brand-700">
                    <Copy className="h-3 w-3" aria-hidden />
                  </button>
                </div>
                <div className="mt-4 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Penggunaan</span>
                  <span className="font-medium text-slate-700">{voucher.used_count}/{voucher.usage_limit ?? '∞'}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${available ? 'bg-emerald-600' : 'bg-slate-300'}`} style={{ width: `${progress}%` }} />
                </div>
                <p className={`mt-2.5 flex items-center gap-1.5 text-[11px] ${voucher.status === 'expired' ? 'text-red-600' : 'text-slate-500'}`}>
                  <CalendarDays className="h-3 w-3 shrink-0" aria-hidden />
                  Kedaluwarsa: {formatDate(voucher.expires_at)}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => openVoucher(voucher, available ? 'edit' : 'detail')}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    {available ? 'Edit' : 'Detail'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(voucher)}
                    className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                  >
                    Hapus
                  </button>
                </div>
              </article>
            )
          })}
          {vouchers.data && list.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center sm:col-span-2 xl:col-span-3">
              <Ticket className="mx-auto h-8 w-8 text-slate-400" aria-hidden />
              <p className="mt-2 text-sm font-medium text-slate-700">Belum ada voucher</p>
              <p className="mt-1 text-xs text-slate-500">Buat voucher untuk mulai menawarkan promo kepada siswa.</p>
            </div>
          )}
        </div>
      </section>

      <Modal
        open={dialog !== null}
        title={dialog === 'create' ? 'Tambah Voucher' : 'Detail Voucher'}
        onClose={() => setDialog(null)}
        size="xl"
        centered
        titleClassName="text-brand-800"
        footer={
          dialog === 'detail' ? (
            <Button variant="secondary" onClick={() => setDialog(null)}>Tutup</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setDialog(null)}>Batal</Button>
              <Button type="submit" form="voucher-form" disabled={busy} icon={<Check className="h-4 w-4" aria-hidden />}>
                {busy ? 'Menyimpan…' : 'Simpan Voucher'}
              </Button>
            </>
          )
        }
      >
        <form id="voucher-form" className="space-y-4" onSubmit={saveVoucher}>
          <Field id="voucher-name" label="Nama Voucher">
            <input id="voucher-name" className={inputClass()} placeholder="Diskon Akhir Tahun" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required maxLength={100} disabled={dialog === 'detail'} data-autofocus />
          </Field>
          <Field id="voucher-code" label="Kode Voucher">
            <input id="voucher-code" className={`${inputClass()} font-mono uppercase`} placeholder="AKHIR2025" value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') }))} required maxLength={30} disabled={dialog === 'detail'} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="voucher-discount" label="Persentase Diskon (%)">
              <div className="relative">
                <input id="voucher-discount" type="number" min="1" max="100" step="1" className={`${inputClass()} pr-9`} value={form.discount} onChange={(event) => setForm((current) => ({ ...current, discount: event.target.value }))} required disabled={dialog === 'detail'} />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-500">%</span>
              </div>
            </Field>
            <Field id="voucher-quota" label="Kuota Penggunaan">
              <input id="voucher-quota" type="number" min="1" step="1" className={inputClass()} value={form.quota} onChange={(event) => setForm((current) => ({ ...current, quota: event.target.value }))} required disabled={dialog === 'detail'} />
            </Field>
          </div>
          <Field id="voucher-expiry" label="Tanggal Kedaluwarsa">
            <div className="relative">
              <input id="voucher-expiry" type="date" className={`${inputClass()} pr-10`} value={form.expiresAt} onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))} required disabled={dialog === 'detail'} />
              <CalendarDays className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
            </div>
          </Field>
          <Field id="voucher-module" label="Pilih Modul">
            <select id="voucher-module" className={inputClass()} value={form.module} onChange={(event) => setForm((current) => ({ ...current, module: event.target.value }))} disabled={dialog === 'detail'}>
              <option value="">Semua program</option>
              {moduleList.map((program) => <option key={program.id} value={program.title}>{program.title}</option>)}
            </select>
          </Field>
          {dialog === 'detail' && (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              {selectedVoucher?.used_count} dari {selectedVoucher?.usage_limit ?? '∞'} penggunaan voucher terpakai.
            </div>
          )}
        </form>
      </Modal>

      <Modal
        open={deleteTarget !== null}
        title="Hapus Voucher?"
        description={`Voucher "${deleteTarget?.name ?? deleteTarget?.code ?? ''}" akan dihapus.`}
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Batal</Button>
            <Button variant="danger" onClick={removeVoucher} disabled={busy} icon={<Trash2 className="h-4 w-4" aria-hidden />}>Hapus Voucher</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">Voucher yang sudah dipakai pada transaksi tetap tercatat pada riwayat penjualan.</p>
      </Modal>
    </div>
  )
}

function MetricCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string
  value: string
  icon: ReactNode
  tone: 'blue' | 'green' | 'red'
}) {
  const styles = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-600',
  }
  return (
    <article className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${styles[tone]}`}>{icon}</span>
      <div>
        <p className="text-[10px] font-semibold tracking-wide text-slate-500">{label}</p>
        <p className="mt-0.5 text-xl font-bold leading-6 text-slate-900">{value}</p>
      </div>
    </article>
  )
}
