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
import { LembagaPageHeader } from './LembagaPageHeader'

interface VoucherItem {
  id: number
  name: string
  code: string
  discount: number
  quota: number
  used: number
  expiresAt: string
  module: string
  active: boolean
}

type VoucherDialog = 'create' | 'edit' | 'detail' | null

const MODULES = [
  'Fullstack Web Developer',
  'Desain Grafis Remaja',
  'Cyber Security Fundamentals',
  'React Native Fundamentals',
  'Sistem Informasi Kesehatan - Dasar',
]

const INITIAL_VOUCHERS: VoucherItem[] = [
  {
    id: 1,
    name: 'Diskon Awal Semester',
    code: 'MABASMS1',
    discount: 20,
    quota: 200,
    used: 150,
    expiresAt: '2026-12-31',
    module: MODULES[0],
    active: true,
  },
  {
    id: 2,
    name: 'Akses Modul Premium',
    code: 'PRODEV24',
    discount: 15,
    quota: 50,
    used: 12,
    expiresAt: '2026-11-15',
    module: MODULES[2],
    active: true,
  },
  {
    id: 3,
    name: 'Promo Hari Kemerdekaan',
    code: 'MERDEKA79',
    discount: 30,
    quota: 500,
    used: 500,
    expiresAt: '2026-08-31',
    module: MODULES[1],
    active: false,
  },
]

const EMPTY_FORM = {
  name: '',
  code: '',
  discount: '20',
  quota: '100',
  expiresAt: '',
  module: MODULES[0],
}

function isExpired(date: string) {
  return date < new Date().toISOString().slice(0, 10)
}

function formatDate(date: string) {
  if (!date) return 'Belum ditentukan'
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`))
}

export default function LembagaVoucher() {
  const [vouchers, setVouchers] = useState(INITIAL_VOUCHERS)
  const [dialog, setDialog] = useState<VoucherDialog>(null)
  const [selectedVoucher, setSelectedVoucher] = useState<VoucherItem | null>(null)
  const [deleteVoucher, setDeleteVoucher] = useState<VoucherItem | null>(null)
  const [menuVoucherId, setMenuVoucherId] = useState<number | null>(null)
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)

  function openCreate() {
    setSelectedVoucher(null)
    setForm(EMPTY_FORM)
    setDialog('create')
  }

  function openVoucher(voucher: VoucherItem, mode: 'edit' | 'detail') {
    setSelectedVoucher(voucher)
    setForm({
      name: voucher.name,
      code: voucher.code,
      discount: String(voucher.discount),
      quota: String(voucher.quota),
      expiresAt: voucher.expiresAt,
      module: voucher.module,
    })
    setDialog(mode)
    setMenuVoucherId(null)
  }

  function saveVoucher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = form.name.trim()
    const code = form.code.trim().toUpperCase()
    const discount = Number(form.discount)
    const quota = Number(form.quota)
    if (!name || !code || !form.expiresAt || !Number.isFinite(discount) || discount <= 0 || discount > 100 || !Number.isInteger(quota) || quota < 1) {
      return
    }

    if (dialog === 'edit' && selectedVoucher) {
      setVouchers((current) =>
        current.map((voucher) =>
          voucher.id === selectedVoucher.id
            ? { ...voucher, name, code, discount, quota, expiresAt: form.expiresAt, module: form.module }
            : voucher,
        ),
      )
      setNotice(`Voucher "${name}" diperbarui pada pratinjau.`)
    } else {
      const newVoucher: VoucherItem = {
        id: Date.now(),
        name,
        code,
        discount,
        quota,
        used: 0,
        expiresAt: form.expiresAt,
        module: form.module,
        active: true,
      }
      setVouchers((current) => [newVoucher, ...current])
      setNotice(`Voucher "${name}" ditambahkan pada pratinjau.`)
    }
    setDialog(null)
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      setNotice(`Kode ${code} disalin.`)
    } catch {
      setNotice('Kode tidak dapat disalin otomatis. Silakan salin kode voucher secara manual.')
    }
  }

  function removeVoucher() {
    if (!deleteVoucher) return
    setVouchers((current) => current.filter((voucher) => voucher.id !== deleteVoucher.id))
    setNotice(`Voucher "${deleteVoucher.name}" dihapus dari pratinjau.`)
    setDeleteVoucher(null)
  }

  return (
    <div className="space-y-6">
      <LembagaPageHeader
        subtitle="Kelola diskon dan akses khusus melalui sistem voucher."
        onReportClick={() => setNotice('Laporan voucher belum tersedia di pratinjau.')}
      />

      {notice && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <span>{notice}</span>
          <button type="button" className="font-semibold hover:underline" onClick={() => setNotice('')}>Tutup</button>
        </div>
      )}

      <section aria-label="Metrik voucher" className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="TOTAL VOUCHER AKTIF" value="24" icon={<Ticket className="h-4 w-4" aria-hidden />} tone="blue" />
        <MetricCard label="TOTAL DIGUNAKAN" value="1,248" icon={<CheckCircle2 className="h-4 w-4" aria-hidden />} tone="green" />
        <MetricCard label="AKAN KEDALUWARSA" value="3" icon={<AlertTriangle className="h-4 w-4" aria-hidden />} tone="red" />
      </section>

      <section aria-labelledby="voucher-heading">
        <div className="flex items-center justify-between gap-3 rounded-t-xl border border-slate-200 bg-white px-4 py-3.5 sm:px-5">
          <h1 id="voucher-heading" className="text-lg font-bold text-slate-900">Voucher</h1>
          <Button onClick={openCreate} icon={<Plus className="h-4 w-4" aria-hidden />} className="shrink-0 px-3 py-2 text-xs sm:text-sm">
            Tambah Voucher
          </Button>
        </div>
        <div className="grid gap-4 rounded-b-xl border-x border-b border-slate-200 bg-slate-50/60 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
          {vouchers.map((voucher) => {
            const expired = isExpired(voucher.expiresAt)
            const active = voucher.active && !expired && voucher.used < voucher.quota
            const progress = voucher.quota > 0 ? Math.min((voucher.used / voucher.quota) * 100, 100) : 0
            return (
              <article key={voucher.id} className="relative flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {active && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />}
                    {active ? 'Aktif' : 'Tidak Aktif'}
                  </span>
                  <div className="relative">
                    <button
                      type="button"
                      aria-label={`Opsi voucher ${voucher.name}`}
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
                          onClick={() => {
                            setVouchers((current) => current.map((item) => item.id === voucher.id ? { ...item, active: !item.active } : item))
                            setMenuVoucherId(null)
                            setNotice(`Status voucher "${voucher.name}" diperbarui.`)
                          }}
                          className="block w-full rounded-md px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                        >
                          {voucher.active ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <h2 className="mt-2 truncate text-sm font-semibold text-slate-900" title={voucher.name}>{voucher.name}</h2>
                <div className="mt-2 flex w-fit items-center gap-1 rounded-md bg-slate-100 px-2 py-1">
                  <span className="font-mono text-[11px] font-bold tracking-wider text-brand-700">{voucher.code}</span>
                  <button type="button" aria-label={`Salin kode ${voucher.code}`} title="Salin kode" onClick={() => copyCode(voucher.code)} className="rounded p-0.5 text-slate-500 hover:bg-white hover:text-brand-700">
                    <Copy className="h-3 w-3" aria-hidden />
                  </button>
                </div>
                <div className="mt-4 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Penggunaan</span>
                  <span className="font-medium text-slate-700">{voucher.used}/{voucher.quota}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${active ? 'bg-emerald-600' : 'bg-slate-300'}`} style={{ width: `${progress}%` }} />
                </div>
                <p className={`mt-2.5 flex items-center gap-1.5 text-[11px] ${expired ? 'text-red-600' : 'text-slate-500'}`}>
                  <CalendarDays className="h-3 w-3 shrink-0" aria-hidden />
                  Kedaluwarsa: {formatDate(voucher.expiresAt)}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => openVoucher(voucher, active ? 'edit' : 'detail')}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    {active ? 'Edit' : 'Detail'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteVoucher(voucher)}
                    className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                  >
                    Hapus
                  </button>
                </div>
              </article>
            )
          })}
          {vouchers.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center sm:col-span-2 xl:col-span-3">
              <Ticket className="mx-auto h-8 w-8 text-slate-400" aria-hidden />
              <p className="mt-2 text-sm font-medium text-slate-700">Belum ada voucher</p>
              <p className="mt-1 text-xs text-slate-500">Buat voucher untuk mulai menawarkan promo kepada siswa.</p>
            </div>
          )}
        </div>
        <p className="mt-3 text-xs text-slate-500">Data voucher dan metrik merupakan contoh untuk pratinjau frontend.</p>
      </section>

      <Modal
        open={dialog !== null}
        title={dialog === 'create' ? 'Tambah Voucher' : dialog === 'edit' ? 'Detail Voucher' : 'Detail Voucher'}
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
              <Button type="submit" form="voucher-form" icon={<Check className="h-4 w-4" aria-hidden />}>Simpan Voucher</Button>
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
              {MODULES.map((module) => <option key={module}>{module}</option>)}
            </select>
          </Field>
          {dialog === 'detail' && (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              {selectedVoucher?.used} dari {selectedVoucher?.quota} penggunaan voucher terpakai.
            </div>
          )}
        </form>
      </Modal>

      <Modal
        open={deleteVoucher !== null}
        title="Hapus Voucher?"
        description={`Voucher "${deleteVoucher?.name ?? ''}" akan dihapus dari daftar pratinjau.`}
        onClose={() => setDeleteVoucher(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteVoucher(null)}>Batal</Button>
            <Button variant="danger" onClick={removeVoucher} icon={<Trash2 className="h-4 w-4" aria-hidden />}>Hapus Voucher</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">Tindakan ini hanya mengubah data lokal pratinjau.</p>
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
