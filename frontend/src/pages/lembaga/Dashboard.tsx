import {
  ArrowRight,
  BookCopy,
  CheckSquare,
  Code2,
  Folder,
  Layers3,
  LockKeyhole,
  Plus,
  Search,
  Star,
  Users,
  WalletCards,
  Clock3,
} from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Field, inputClass } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { ErrorState, Spinner } from '../../components/ui/States'
import { toApiError } from '../../lib/api'
import { useApiData } from '../../lib/useApiData'
import { LembagaPageHeader } from './LembagaPageHeader'
import { createProgram, fetchSummary, type LembagaProgram } from './api'

type ModuleTone = 'code' | 'design' | 'security' | 'business'

const TONE_STYLES: Record<ModuleTone, { background: string; icon: typeof Code2; label: string }> = {
  code: { background: 'from-slate-800 via-cyan-900 to-slate-950', icon: Code2, label: 'Kode program' },
  design: { background: 'from-orange-100 via-rose-100 to-slate-200', icon: Layers3, label: 'Desain kreatif' },
  security: { background: 'from-blue-950 via-cyan-900 to-slate-950', icon: LockKeyhole, label: 'Keamanan digital' },
  business: { background: 'from-emerald-900 via-teal-800 to-slate-950', icon: WalletCards, label: 'Bisnis digital' },
}

const TONES: ModuleTone[] = ['code', 'business', 'security', 'design']

const currency = new Intl.NumberFormat('id-ID')

export default function LembagaDashboard() {
  const navigate = useNavigate()
  const summary = useApiData(fetchSummary, [])
  const [moduleDialogOpen, setModuleDialogOpen] = useState(false)
  const [reportDialogOpen, setReportDialogOpen] = useState(false)
  const [selectedModule, setSelectedModule] = useState<LembagaProgram | null>(null)
  const [moduleName, setModuleName] = useState('')
  const [moduleLevel, setModuleLevel] = useState('SMA/SMK')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)

  const cards = summary.data?.cards
  const activeModules = cards?.active_programs ?? 0
  const moduleProgress = Math.min(activeModules, 10)
  const visibleModules = (summary.data?.programs ?? []).slice(0, 3)

  async function createModule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = moduleName.trim()
    if (!title) return

    setSaving(true)
    try {
      await createProgram({ title, category: moduleLevel, status: 'draft' })
      setModuleName('')
      setModuleLevel('SMA/SMK')
      setModuleDialogOpen(false)
      setNotice(`Program "${title}" dibuat sebagai draf. Lengkapi kurikulum di Kelola Modul.`)
      summary.reload()
    } catch (error) {
      setNotice(toApiError(error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <LembagaPageHeader onReportClick={() => setReportDialogOpen(true)} />

      {notice && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          <span>{notice}</span>
          <button type="button" className="font-semibold hover:underline" onClick={() => setNotice('')}>
            Tutup
          </button>
        </div>
      )}

      {summary.error && <ErrorState error={summary.error} onRetry={summary.reload} />}

      <section aria-label="Ringkasan lembaga" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          icon={<BookCopy className="h-5 w-5" aria-hidden />}
          value={activeModules}
          label="Modul Aktif"
          tone="green"
          footer={
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-emerald-700 transition-all" style={{ width: `${moduleProgress * 10}%` }} />
              </div>
              <span className="text-xs text-slate-500">{moduleProgress}/10</span>
            </div>
          }
        />
        <SummaryCard
          icon={<Users className="h-5 w-5" aria-hidden />}
          value={cards?.total_students ?? 0}
          label="Total Siswa"
          tone="blue"
        />
        <SummaryCard
          icon={<CheckSquare className="h-5 w-5" aria-hidden />}
          value={cards?.total_enrollments ?? 0}
          label="Total Enrollments"
          tone="sand"
        />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-bold text-slate-900">Aksi Cepat</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <QuickAction
            icon={<Plus className="h-5 w-5" aria-hidden />}
            label="Tambah Modul Baru"
            tone="blue"
            onClick={() => setModuleDialogOpen(true)}
          />
          <QuickAction
            icon={<Search className="h-5 w-5" aria-hidden />}
            label="Data Siswa"
            tone="green"
            onClick={() => navigate('/lembaga/students')}
          />
          <QuickAction
            icon={<Star className="h-5 w-5" aria-hidden />}
            label="Buat Voucher"
            tone="sand"
            onClick={() => navigate('/lembaga/vouchers')}
          />
        </div>
      </section>

      <section aria-labelledby="my-modules-title">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 id="my-modules-title" className="text-xl font-bold text-slate-900">
              Modul Saya
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">Program pembelajaran yang dikelola lembagamu.</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/lembaga/modules')}
            className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-900"
          >
            Lihat Semua <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
        {summary.loading && !summary.data && <Spinner label="Memuat program…" />}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleModules.map((program, index) => (
            <ModuleCard
              key={program.id}
              program={program}
              tone={TONES[index % TONES.length]}
              onClick={() => setSelectedModule(program)}
            />
          ))}
        </div>
        {summary.data && visibleModules.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center">
            <BookCopy className="mx-auto h-8 w-8 text-slate-400" aria-hidden />
            <h3 className="mt-3 font-semibold text-slate-800">Belum ada program</h3>
            <p className="mt-1 text-sm text-slate-500">Tambahkan modul pertama untuk mulai membangun pembelajaran opsional.</p>
          </div>
        )}
      </section>

      <Modal
        open={moduleDialogOpen}
        title="Tambah Modul Baru"
        description="Buat program pembelajaran opsional untuk lembagamu."
        onClose={() => setModuleDialogOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModuleDialogOpen(false)}>
              Batal
            </Button>
            <Button type="submit" form="create-module-form" disabled={saving} icon={<Plus className="h-4 w-4" aria-hidden />}>
              {saving ? 'Menyimpan…' : 'Tambah Modul'}
            </Button>
          </>
        }
      >
        <form id="create-module-form" className="space-y-4" onSubmit={createModule}>
          <Field id="module-name" label="Nama modul">
            <input
              id="module-name"
              className={inputClass()}
              value={moduleName}
              onChange={(event) => setModuleName(event.target.value)}
              placeholder="Contoh: UI/UX Design"
              required
              maxLength={80}
              data-autofocus
            />
          </Field>
          <Field id="module-level" label="Target peserta">
            <select
              id="module-level"
              className={inputClass()}
              value={moduleLevel}
              onChange={(event) => setModuleLevel(event.target.value)}
            >
              <option>SMP</option>
              <option>SMA/SMK</option>
              <option>Mahasiswa</option>
              <option>Umum</option>
            </select>
          </Field>
          <p className="text-xs leading-5 text-slate-500">
            Program dibuat sebagai draf. Isi bab, materi, dan harga lewat menu Kelola Modul dan Jelajahi.
          </p>
        </form>
      </Modal>

      <Modal
        open={reportDialogOpen}
        title="Laporan Lembaga"
        description="Ringkasan program dan pendapatan lembaga Anda."
        onClose={() => setReportDialogOpen(false)}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <ReportMetric label="Total siswa" value={`${cards?.total_students ?? 0} siswa`} />
          <ReportMetric label="Total enrollment" value={`${cards?.total_enrollments ?? 0} enrollment`} />
          <ReportMetric label="Modul aktif" value={`${activeModules} modul`} />
          <ReportMetric label="Pemasukan kerja sama" value={`Rp ${currency.format(cards?.total_revenue ?? 0)}`} />
        </div>
        <button
          type="button"
          onClick={() => {
            setReportDialogOpen(false)
            navigate('/lembaga/explore')
          }}
          className="mt-4 w-full rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-blue-50"
        >
          Buka laporan lengkap di Jelajahi
        </button>
      </Modal>

      <Modal
        open={selectedModule !== null}
        title={selectedModule?.title ?? 'Detail Modul'}
        description="Ringkasan program pada dashboard."
        onClose={() => setSelectedModule(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSelectedModule(null)}>
              Tutup
            </Button>
            <Button
              onClick={() => {
                setSelectedModule(null)
                navigate('/lembaga/modules')
              }}
              icon={<ArrowRight className="h-4 w-4" aria-hidden />}
            >
              Kelola Modul
            </Button>
          </>
        }
      >
        {selectedModule && (
          <div className="grid grid-cols-2 gap-3">
            <ReportMetric label="Target peserta" value={selectedModule.category ?? 'Umum'} />
            <ReportMetric label="Materi" value={`${selectedModule.modules_count} modul`} />
            <ReportMetric label="Sesi belajar" value={`${selectedModule.sessions_count} sesi`} />
            <ReportMetric label="Status" value={selectedModule.status_label} />
            <ReportMetric label="Harga" value={selectedModule.price_label} />
            <ReportMetric label="Pendapatan" value={`Rp ${currency.format(selectedModule.revenue)}`} />
          </div>
        )}
      </Modal>
    </div>
  )
}

function SummaryCard({
  icon,
  value,
  label,
  tone,
  footer,
}: {
  icon: ReactNode
  value: string | number
  label: string
  tone: 'green' | 'blue' | 'sand'
  footer?: ReactNode
}) {
  const iconTones = {
    green: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-indigo-50 text-indigo-700',
    sand: 'bg-amber-50 text-amber-800',
  }

  return (
    <article className="flex min-h-[122px] flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconTones[tone]}`}>{icon}</span>
        <span className="text-3xl font-bold leading-none text-slate-900">{value}</span>
      </div>
      <div className="mt-3">
        <p className="text-sm font-semibold tracking-wide text-slate-600">{label}</p>
        {footer && <div className="mt-2">{footer}</div>}
      </div>
    </article>
  )
}

function QuickAction({
  icon,
  label,
  tone,
  onClick,
}: {
  icon: ReactNode
  label: string
  tone: 'blue' | 'green' | 'sand'
  onClick: () => void
}) {
  const tones = {
    blue: 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100',
    green: 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
    sand: 'bg-amber-50 text-amber-900 hover:bg-amber-100',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-12 items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-semibold transition-colors focus-visible:outline ${tones[tone]}`}
    >
      {icon}
      {label}
    </button>
  )
}

function ModuleCard({ program, tone, onClick }: { program: LembagaProgram; tone: ModuleTone; onClick: () => void }) {
  const style = TONE_STYLES[tone]
  const CoverIcon = style.icon

  return (
    <button
      type="button"
      onClick={onClick}
      className="group overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline"
    >
      <div className={`relative flex h-40 items-center justify-center overflow-hidden bg-gradient-to-br ${style.background}`}>
        <span className="absolute -left-7 -top-10 h-40 w-40 rounded-full border border-white/15" />
        <span className="absolute -bottom-16 -right-5 h-48 w-48 rounded-full border border-white/15" />
        {tone === 'code' && (
          <div className="absolute inset-0 grid grid-cols-8 gap-2 p-4 opacity-20" aria-hidden>
            {Array.from({ length: 32 }, (_, index) => (
              <span key={index} className={`h-1 rounded ${index % 3 === 0 ? 'bg-cyan-200' : 'bg-white'}`} />
            ))}
          </div>
        )}
        <CoverIcon
          className={`relative h-16 w-16 transition-transform group-hover:scale-110 ${
            tone === 'design' ? 'text-rose-700/70' : 'text-white/80'
          }`}
          strokeWidth={1.25}
          aria-label={style.label}
        />
        <span className="absolute right-3 top-3 rounded-md bg-white/90 px-2 py-1 text-[10px] font-bold text-slate-700 shadow-sm">
          {program.category ?? 'Umum'}
        </span>
      </div>
      <div className="p-4">
        <h3 className="min-h-12 text-lg font-bold leading-6 text-slate-900">{program.title}</h3>
        <div className="mt-3 flex items-center gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Folder className="h-3.5 w-3.5" aria-hidden /> {program.modules_count} Modul
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock3 className="h-3.5 w-3.5" aria-hidden /> {program.sessions_count} Sesi
          </span>
        </div>
      </div>
    </button>
  )
}

function ReportMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-900">{value}</p>
    </div>
  )
}
