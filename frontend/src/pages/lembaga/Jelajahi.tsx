import {
  ChevronDown,
  Code2,
  Edit3,
  LayoutGrid,
  Smartphone,
  Shield,
  Star,
  Users,
  Wallet,
} from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '../../components/ui/Button'
import { Field, inputClass } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { ErrorState, Spinner } from '../../components/ui/States'
import { toApiError } from '../../lib/api'
import { useApiData } from '../../lib/useApiData'
import { LembagaPageHeader } from './LembagaPageHeader'
import { fetchReport, fetchVouchers, updatePricing, updateVoucher, type LembagaProgram } from './api'

type ModuleIcon = 'code' | 'security' | 'mobile'

const ICONS: ModuleIcon[] = ['code', 'security', 'mobile']

const moduleCover: Record<ModuleIcon, { background: string }> = {
  code: { background: 'bg-[#0b318f]' },
  security: { background: 'bg-[#176c54]' },
  mobile: { background: 'bg-[#754700]' },
}

export default function LembagaJelajahi() {
  const report = useApiData(fetchReport, [])
  const vouchers = useApiData(fetchVouchers, [])
  const [expanded, setExpanded] = useState<number[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [priceDialogOpen, setPriceDialogOpen] = useState(false)
  const [isFree, setIsFree] = useState(false)
  const [normalPrice, setNormalPrice] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [voucher, setVoucher] = useState('')
  const [reportOpen, setReportOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const programs = report.data?.programs ?? []
  const summary = report.data?.summary
  const editingProgram = programs.find((program) => program.id === editingId) ?? null

  function openPriceDialog(program: LembagaProgram) {
    const effective = program.discount_price ?? program.price
    setEditingId(program.id)
    setIsFree(effective === 0)
    setNormalPrice(program.price ? String(program.price) : '')
    setSalePrice(program.discount_price !== null ? String(program.discount_price) : '')
    setVoucher('')
    setPriceDialogOpen(true)
  }

  async function savePrice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (editingId === null || busy) return

    const regular = isFree ? 0 : Number(normalPrice)
    const discounted = isFree ? null : salePrice === '' ? null : Number(salePrice)
    if (!Number.isFinite(regular) || regular < 0 || (discounted !== null && (!Number.isFinite(discounted) || discounted < 0 || discounted > regular))) {
      setNotice('Harga tidak valid: pastikan harga diskon tidak melebihi harga normal.')
      return
    }

    setBusy(true)
    try {
      await updatePricing(editingId, regular, discounted)
      if (voucher) {
        await updateVoucher(Number(voucher), { course_id: editingId })
      }
      setPriceDialogOpen(false)
      setNotice(`Harga "${editingProgram?.title ?? 'program'}" berhasil diperbarui.`)
      report.reload()
      vouchers.reload()
    } catch (error) {
      setNotice(toApiError(error).message)
    } finally {
      setBusy(false)
    }
  }

  function toggleIncome(id: number) {
    setExpanded((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]))
  }

  return (
    <div className="space-y-6">
      <LembagaPageHeader onReportClick={() => setReportOpen(true)} />

      {report.error && <ErrorState error={report.error} onRetry={report.reload} />}

      <section aria-labelledby="explore-modules-title">
        <h1 id="explore-modules-title" className="mb-4 text-2xl font-bold tracking-tight text-slate-900">
          Daftar Modul
        </h1>
        {report.loading && !report.data && <Spinner label="Memuat program…" />}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {programs.map((program, index) => (
            <ExploreModuleCard
              key={program.id}
              program={program}
              icon={ICONS[index % ICONS.length]}
              onSetPrice={() => openPriceDialog(program)}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="income-summary-title" className="border-t border-slate-200 pt-5">
        <h2 id="income-summary-title" className="mb-4 text-sm font-bold tracking-[0.08em] text-slate-600">
          RINGKASAN LAPORAN &amp; PENDAPATAN
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryMetric icon={<LayoutGrid className="h-4 w-4" aria-hidden />} label="Total modul aktif" value={String(summary?.active_programs ?? 0)} />
          <SummaryMetric icon={<Users className="h-4 w-4" aria-hidden />} label="Total siswa enroll" value={String(summary?.total_enrollments ?? 0)} />
          <SummaryMetric
            icon={<Wallet className="h-4 w-4" aria-hidden />}
            label="Total pendapatan"
            value={formatCurrency(summary?.total_revenue ?? 0)}
            green
          />
        </div>

        <ul className="mt-4 space-y-2.5">
          {programs.map((program, index) => {
            const isOpen = expanded.includes(program.id)
            const icon = ICONS[index % ICONS.length]

            return (
              <li key={program.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => toggleIncome(program.id)}
                  className="flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-slate-50 sm:gap-4 sm:px-4"
                >
                  <ModuleIconBox icon={icon} compact />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-slate-900">{program.title}</span>
                    <span className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                      <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
                        {program.status_label.toUpperCase()}
                      </span>
                      <span>·</span>
                      <span>{program.modules_count} Bab</span>
                    </span>
                  </span>
                  <span className="hidden text-right sm:block">
                    <span className="block text-xs font-semibold text-slate-800">{program.students_count} siswa</span>
                    <span className="text-[10px] text-slate-500">enroll</span>
                  </span>
                  <span className="text-right">
                    <span className="block whitespace-nowrap text-xs font-semibold text-emerald-700">
                      {formatCurrency(program.revenue)}
                    </span>
                    <span className="text-[10px] text-slate-500">pendapatan</span>
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    aria-hidden
                  />
                </button>
                {isOpen && (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                    <span>{program.students_count} siswa terdaftar pada modul ini</span>
                    <span className="font-semibold text-emerald-700">
                      Total pendapatan: {formatCurrency(program.revenue)}
                    </span>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
        {report.data && programs.length === 0 && (
          <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
            Belum ada program untuk dilaporkan. Tambahkan modul terlebih dahulu.
          </p>
        )}
      </section>

      <Modal
        open={priceDialogOpen}
        title="Atur Harga Modul"
        description={editingProgram?.title}
        onClose={() => setPriceDialogOpen(false)}
        size="xl"
        centered
        titleClassName="text-brand-800"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPriceDialogOpen(false)}>
              Batal
            </Button>
            <Button type="submit" form="module-price-form" disabled={busy}>
              {busy ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </>
        }
      >
        <form id="module-price-form" className="space-y-5" onSubmit={savePrice}>
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1" role="group" aria-label="Jenis harga">
            <button
              type="button"
              aria-pressed={isFree}
              onClick={() => setIsFree(true)}
              className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                isFree ? 'bg-brand-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              Gratis
            </button>
            <button
              type="button"
              aria-pressed={!isFree}
              onClick={() => setIsFree(false)}
              className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                !isFree ? 'bg-brand-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              Berbayar
            </button>
          </div>

          {!isFree && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="normal-price" label="Harga normal (Rp)">
                <input
                  id="normal-price"
                  type="number"
                  min="0"
                  step="1000"
                  className={inputClass()}
                  value={normalPrice}
                  onChange={(event) => setNormalPrice(event.target.value)}
                  placeholder="Masukkan harga"
                  required
                  data-autofocus
                />
              </Field>
              <Field id="sale-price" label="Harga setelah diskon (Rp)">
                <input
                  id="sale-price"
                  type="number"
                  min="0"
                  step="1000"
                  className={inputClass()}
                  value={salePrice}
                  onChange={(event) => setSalePrice(event.target.value)}
                  placeholder="Kosongkan bila tanpa diskon"
                />
              </Field>
            </div>
          )}

          <Field id="active-voucher" label="Voucher yang berlaku">
            <select
              id="active-voucher"
              className={inputClass()}
              value={voucher}
              onChange={(event) => setVoucher(event.target.value)}
            >
              <option value="">Tanpa voucher</option>
              {(vouchers.data?.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} — {item.discount_label}
                </option>
              ))}
            </select>
          </Field>
          <p className="text-xs leading-5 text-slate-500">
            Harga berlaku untuk transaksi berikutnya; riwayat penjualan tidak berubah. Memilih voucher menautkannya ke program ini.
          </p>
        </form>
      </Modal>

      <Modal
        open={reportOpen}
        title="Ringkasan Laporan & Pendapatan"
        description="Angka diambil dari transaksi dan pendaftaran program lembaga Anda."
        onClose={() => setReportOpen(false)}
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Total modul aktif: {summary?.active_programs ?? 0}</p>
          <p className="text-sm text-slate-600">Total siswa enroll: {summary?.total_enrollments ?? 0}</p>
          <p className="text-sm text-slate-600">Voucher aktif: {summary?.active_vouchers ?? 0}</p>
          <p className="text-sm font-semibold text-emerald-700">Total pendapatan: {formatCurrency(summary?.total_revenue ?? 0)}</p>
        </div>
      </Modal>

      {notice && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-40 flex max-w-sm items-center gap-3 rounded-lg border border-emerald-200 bg-white px-4 py-3 text-sm text-emerald-800 shadow-lg"
        >
          <span>{notice}</span>
          <button type="button" className="font-semibold hover:underline" onClick={() => setNotice('')}>
            Tutup
          </button>
        </div>
      )}
    </div>
  )
}

function ExploreModuleCard({ program, icon, onSetPrice }: { program: LembagaProgram; icon: ModuleIcon; onSetPrice: () => void }) {
  const currentPrice = program.discount_price ?? program.price

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className={`relative flex h-28 items-center justify-center ${moduleCover[icon].background}`}>
        <span className="absolute left-3 top-3 rounded bg-black/20 px-2 py-1 text-[10px] font-semibold text-white">
          {program.category ?? 'UMUM'}
        </span>
        <ModuleIllustration icon={icon} />
      </div>
      <div className="p-4">
        <h3 className="min-h-12 text-base font-bold leading-6 text-slate-900">{program.title}</h3>
        <p className="mt-1 min-h-10 text-xs leading-5 text-slate-500">{program.description ?? 'Program pembelajaran lembaga.'}</p>
        <div className="mt-3 flex items-center gap-4 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1">
            <LayoutGrid className="h-3.5 w-3.5" aria-hidden /> {program.modules_count} Modul
          </span>
          <span className="inline-flex items-center gap-1" title="Rating belum tersedia">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden /> —
          </span>
        </div>
        <div className="mt-3 flex items-end justify-between gap-2 border-t border-slate-100 pt-3">
          <div className="min-w-0">
            {program.discount_price !== null && program.discount_price < program.price && (
              <p className="text-[11px] text-slate-400 line-through">{formatCurrency(program.price)}</p>
            )}
            <p className={`whitespace-nowrap text-lg font-bold ${currentPrice === 0 ? 'text-brand-700' : 'text-emerald-700'}`}>
              {currentPrice === 0 ? 'Gratis' : formatCurrency(currentPrice)}
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={onSetPrice}
            icon={<Edit3 className="h-3.5 w-3.5" aria-hidden />}
            className="shrink-0 px-2.5 py-1.5 text-xs"
          >
            Atur Harga
          </Button>
        </div>
      </div>
    </article>
  )
}

function ModuleIllustration({ icon }: { icon: ModuleIcon }) {
  const classes = 'h-8 w-8 text-white/80'
  if (icon === 'code') return <Code2 className={classes} strokeWidth={2} aria-label="Pemrograman" />
  if (icon === 'security') return <Shield className={classes} strokeWidth={2} aria-label="Keamanan siber" />
  return <Smartphone className={classes} strokeWidth={2} aria-label="Aplikasi mobile" />
}

function ModuleIconBox({ icon, compact = false }: { icon: ModuleIcon; compact?: boolean }) {
  const tones: Record<ModuleIcon, string> = {
    code: 'bg-blue-50 text-brand-700',
    security: 'bg-emerald-50 text-emerald-700',
    mobile: 'bg-amber-50 text-amber-800',
  }
  const Icon = icon === 'code' ? Code2 : icon === 'security' ? Shield : Smartphone
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-lg ${compact ? 'h-8 w-8' : 'h-10 w-10'} ${tones[icon]}`}>
      <Icon className={compact ? 'h-4 w-4' : 'h-5 w-5'} aria-hidden />
    </span>
  )
}

function SummaryMetric({
  icon,
  label,
  value,
  green = false,
}: {
  icon: ReactNode
  label: string
  value: string
  green?: boolean
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        <span className="text-slate-500">{icon}</span>
        {label}
      </p>
      <p className={`mt-2 text-2xl font-bold tracking-tight ${green ? 'text-emerald-700' : 'text-slate-900'}`}>{value}</p>
    </article>
  )
}

function formatCurrency(value: number): string {
  return `Rp ${new Intl.NumberFormat('id-ID').format(value)}`
}
