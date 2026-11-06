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
import { LembagaPageHeader } from './LembagaPageHeader'

type ModuleIcon = 'code' | 'security' | 'mobile'

interface ExploreModule {
  id: number
  title: string
  level: string
  description: string
  lessons: number
  rating: string
  normalPrice: number
  salePrice: number
  active: boolean
  chapters: number
  enrollments: number
  revenue: number
  icon: ModuleIcon
  expanded: boolean
  voucher: string
}

const INITIAL_MODULES: ExploreModule[] = [
  {
    id: 1,
    title: 'Fullstack Web Developer Professional',
    level: 'UMUM',
    description: 'Kuasai front-end dan back-end development dengan stack modern.',
    lessons: 12,
    rating: '4.8',
    normalPrice: 350000,
    salePrice: 250000,
    active: true,
    chapters: 5,
    enrollments: 6,
    revenue: 1500000,
    icon: 'code',
    expanded: false,
    voucher: '',
  },
  {
    id: 2,
    title: 'Cyber Security Fundamentals',
    level: 'SMA/SMK',
    description: 'Pelajari dasar-dasar keamanan siber dan analisis ancaman.',
    lessons: 8,
    rating: '4.9',
    normalPrice: 200000,
    salePrice: 150000,
    active: true,
    chapters: 3,
    enrollments: 5,
    revenue: 750000,
    icon: 'security',
    expanded: false,
    voucher: '',
  },
  {
    id: 3,
    title: 'React Native Fundamentals',
    level: 'UMUM',
    description: 'Bangun aplikasi mobile cross-platform dengan React Native.',
    lessons: 15,
    rating: '4.7',
    normalPrice: 0,
    salePrice: 0,
    active: true,
    chapters: 8,
    enrollments: 3,
    revenue: 500000,
    icon: 'mobile',
    expanded: false,
    voucher: '',
  },
]

const VOUCHERS = [
  { value: '', label: 'Pilih voucher...' },
  { value: 'WELCOME10', label: 'WELCOME10 — Diskon 10%' },
  { value: 'BELAJAR25', label: 'BELAJAR25 — Diskon Rp25.000' },
  { value: 'MITRA15', label: 'MITRA15 — Diskon 15%' },
]

export default function LembagaJelajahi() {
  const [modules, setModules] = useState(INITIAL_MODULES)
  const [editingModuleId, setEditingModuleId] = useState<number | null>(null)
  const [priceDialogOpen, setPriceDialogOpen] = useState(false)
  const [isFree, setIsFree] = useState(false)
  const [normalPrice, setNormalPrice] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [voucher, setVoucher] = useState('')
  const [reportOpen, setReportOpen] = useState(false)
  const [notice, setNotice] = useState('')

  const editingModule = modules.find((module) => module.id === editingModuleId) ?? null

  function openPriceDialog(module: ExploreModule) {
    setEditingModuleId(module.id)
    setIsFree(module.salePrice === 0)
    setNormalPrice(module.normalPrice ? String(module.normalPrice) : '')
    setSalePrice(module.salePrice ? String(module.salePrice) : '')
    setVoucher(module.voucher)
    setPriceDialogOpen(true)
  }

  function savePrice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (editingModuleId === null) return

    const regular = isFree ? 0 : Number(normalPrice)
    const discounted = isFree ? 0 : Number(salePrice)
    if (!isFree && (!Number.isFinite(regular) || !Number.isFinite(discounted) || regular < 0 || discounted < 0)) {
      return
    }

    setModules((current) =>
      current.map((module) =>
        module.id === editingModuleId
          ? {
              ...module,
              normalPrice: regular,
              salePrice: discounted,
              voucher,
            }
          : module,
      ),
    )
    setPriceDialogOpen(false)
    setNotice(`Harga "${editingModule?.title ?? 'modul'}" diperbarui pada pratinjau.`)
  }

  function toggleIncome(id: number) {
    setModules((current) => current.map((module) => (module.id === id ? { ...module, expanded: !module.expanded } : module)))
  }

  return (
    <div className="space-y-6">
      <LembagaPageHeader onReportClick={() => setReportOpen(true)} />

      <section aria-labelledby="explore-modules-title">
        <h1 id="explore-modules-title" className="mb-4 text-2xl font-bold tracking-tight text-slate-900">
          Daftar Modul
        </h1>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((module) => (
            <ExploreModuleCard key={module.id} module={module} onSetPrice={() => openPriceDialog(module)} />
          ))}
        </div>
      </section>

      <section aria-labelledby="income-summary-title" className="border-t border-slate-200 pt-5">
        <h2 id="income-summary-title" className="mb-4 text-sm font-bold tracking-[0.08em] text-slate-600">
          RINGKASAN LAPORAN &amp; PENDAPATAN
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryMetric icon={<LayoutGrid className="h-4 w-4" aria-hidden />} label="Total modul aktif" value="3" />
          <SummaryMetric icon={<Users className="h-4 w-4" aria-hidden />} label="Total siswa enroll" value="14" />
          <SummaryMetric
            icon={<Wallet className="h-4 w-4" aria-hidden />}
            label="Total pendapatan"
            value={formatCurrency(2750000)}
            green
          />
        </div>

        <ul className="mt-4 space-y-2.5">
          {modules.map((module) => (
            <li key={module.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                aria-expanded={module.expanded}
                onClick={() => toggleIncome(module.id)}
                className="flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-slate-50 sm:gap-4 sm:px-4"
              >
                <ModuleIconBox icon={module.icon} compact />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-slate-900">{module.title}</span>
                  <span className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                    <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">AKTIF</span>
                    <span>·</span>
                    <span>{module.chapters} Bab</span>
                  </span>
                </span>
                <span className="hidden text-right sm:block">
                  <span className="block text-xs font-semibold text-slate-800">{module.enrollments} siswa</span>
                  <span className="text-[10px] text-slate-500">enroll</span>
                </span>
                <span className="text-right">
                  <span className="block whitespace-nowrap text-xs font-semibold text-emerald-700">
                    {formatCurrency(module.revenue)}
                  </span>
                  <span className="text-[10px] text-slate-500">pendapatan</span>
                </span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${module.expanded ? 'rotate-180' : ''}`}
                  aria-hidden
                />
              </button>
              {module.expanded && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                  <span>{module.enrollments} siswa terdaftar pada modul ini</span>
                  <span className="font-semibold text-emerald-700">
                    Total pendapatan: {formatCurrency(module.revenue)}
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">Harga, enrollment, dan pendapatan merupakan data contoh untuk pratinjau.</p>
      </section>

      <Modal
        open={priceDialogOpen}
        title="Atur Harga Modul"
        description={editingModule?.title}
        onClose={() => setPriceDialogOpen(false)}
        size="xl"
        centered
        titleClassName="text-brand-800"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPriceDialogOpen(false)}>
              Batal
            </Button>
            <Button type="submit" form="module-price-form">
              Simpan
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
                  placeholder="Masukkan harga"
                  required
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
              {VOUCHERS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
          <p className="text-xs leading-5 text-slate-500">Perubahan harga dan voucher hanya tersimpan sementara di pratinjau.</p>
        </form>
      </Modal>

      <Modal
        open={reportOpen}
        title="Ringkasan Laporan & Pendapatan"
        description="Data laporan belum terhubung ke server."
        onClose={() => setReportOpen(false)}
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Total modul aktif: 3</p>
          <p className="text-sm text-slate-600">Total siswa enroll: 14</p>
          <p className="text-sm font-semibold text-emerald-700">Total pendapatan: Rp 2.750.000</p>
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

function ExploreModuleCard({ module, onSetPrice }: { module: ExploreModule; onSetPrice: () => void }) {
  const currentPrice = module.salePrice

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className={`relative flex h-28 items-center justify-center ${moduleCover[ module.icon ].background}`}>
        <span className="absolute left-3 top-3 rounded bg-black/20 px-2 py-1 text-[10px] font-semibold text-white">
          {module.level}
        </span>
        <ModuleIllustration icon={module.icon} />
      </div>
      <div className="p-4">
        <h3 className="min-h-12 text-base font-bold leading-6 text-slate-900">{module.title}</h3>
        <p className="mt-1 min-h-10 text-xs leading-5 text-slate-500">{module.description}</p>
        <div className="mt-3 flex items-center gap-4 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1">
            <LayoutGrid className="h-3.5 w-3.5" aria-hidden /> {module.lessons} Modul
          </span>
          <span className="inline-flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden /> {module.rating}
          </span>
        </div>
        <div className="mt-3 flex items-end justify-between gap-2 border-t border-slate-100 pt-3">
          <div className="min-w-0">
            {module.normalPrice > currentPrice && (
              <p className="text-[11px] text-slate-400 line-through">{formatCurrency(module.normalPrice)}</p>
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

const moduleCover: Record<ModuleIcon, { background: string }> = {
  code: { background: 'bg-[#0b318f]' },
  security: { background: 'bg-[#176c54]' },
  mobile: { background: 'bg-[#754700]' },
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
