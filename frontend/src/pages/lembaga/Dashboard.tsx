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
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Field, inputClass } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { LembagaPageHeader } from './LembagaPageHeader'

type ModuleTone = 'code' | 'design' | 'security' | 'business'

interface LearningModule {
  id: number
  title: string
  level: string
  modules: number
  sessions: number
  tone: ModuleTone
}

const INITIAL_MODULES: LearningModule[] = [
  { id: 1, title: 'Fullstack Web Developer', level: 'SMA/SMK', modules: 12, sessions: 24, tone: 'code' },
  { id: 2, title: 'Desain Grafis Remaja', level: 'SMP', modules: 8, sessions: 16, tone: 'design' },
  { id: 3, title: 'Cyber Security Fundamentals', level: 'SMA/UMUM', modules: 10, sessions: 20, tone: 'security' },
  { id: 4, title: 'Digital Marketing Dasar', level: 'UMUM', modules: 6, sessions: 12, tone: 'business' },
]

const TONE_STYLES: Record<ModuleTone, { background: string; icon: typeof Code2; label: string }> = {
  code: { background: 'from-slate-800 via-cyan-900 to-slate-950', icon: Code2, label: 'Kode program' },
  design: { background: 'from-orange-100 via-rose-100 to-slate-200', icon: Layers3, label: 'Desain kreatif' },
  security: { background: 'from-blue-950 via-cyan-900 to-slate-950', icon: LockKeyhole, label: 'Keamanan digital' },
  business: { background: 'from-emerald-900 via-teal-800 to-slate-950', icon: WalletCards, label: 'Bisnis digital' },
}

export default function LembagaDashboard() {
  const navigate = useNavigate()
  const [modules, setModules] = useState(INITIAL_MODULES)
  const [moduleDialogOpen, setModuleDialogOpen] = useState(false)
  const [reportDialogOpen, setReportDialogOpen] = useState(false)
  const [selectedModule, setSelectedModule] = useState<LearningModule | null>(null)
  const [moduleName, setModuleName] = useState('')
  const [moduleLevel, setModuleLevel] = useState('SMA/SMK')
  const [notice, setNotice] = useState('')

  const activeModules = modules.length
  const moduleProgress = Math.min(activeModules, 10)
  const visibleModules = useMemo(() => modules.slice(0, 3), [modules])

  function createModule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = moduleName.trim()
    if (!title) return

    const newModule: LearningModule = {
      id: Date.now(),
      title,
      level: moduleLevel,
      modules: 0,
      sessions: 0,
      tone: 'business',
    }
    setModules((current) => [newModule, ...current])
    setModuleName('')
    setModuleLevel('SMA/SMK')
    setModuleDialogOpen(false)
    setNotice(`Modul "${title}" ditambahkan ke pratinjau dashboard.`)
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
          value="40"
          label="Total Siswa"
          tone="blue"
        />
        <SummaryCard
          icon={<CheckSquare className="h-5 w-5" aria-hidden />}
          value="15"
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
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleModules.map((module) => (
            <ModuleCard key={module.id} module={module} onClick={() => setSelectedModule(module)} />
          ))}
        </div>
      </section>

      <Modal
        open={moduleDialogOpen}
        title="Tambah Modul Baru"
        description="Buat entri modul untuk pratinjau dashboard ini."
        onClose={() => setModuleDialogOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModuleDialogOpen(false)}>
              Batal
            </Button>
            <Button type="submit" form="create-module-form" icon={<Plus className="h-4 w-4" aria-hidden />}>
              Tambah Modul
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
            Ini hanya pratinjau lokal. Modul belum disimpan ke server.
          </p>
        </form>
      </Modal>

      <Modal
        open={reportDialogOpen}
        title="Laporan Lembaga"
        description="Ringkasan contoh untuk pratinjau desain dashboard."
        onClose={() => setReportDialogOpen(false)}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <ReportMetric label="Total siswa" value="40 siswa" />
          <ReportMetric label="Total enrollment" value="15 enrollment" />
          <ReportMetric label="Modul aktif" value={`${activeModules} modul`} />
          <ReportMetric label="Pemasukan kerja sama" value="Belum tersedia" />
        </div>
        <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-500">
          Angka pada halaman ini adalah data statis untuk referensi tampilan, bukan data aktual.
        </p>
      </Modal>

      <Modal
        open={selectedModule !== null}
        title={selectedModule?.title ?? 'Detail Modul'}
        description="Ringkasan modul pada pratinjau dashboard."
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
            <ReportMetric label="Target peserta" value={selectedModule.level} />
            <ReportMetric label="Materi" value={`${selectedModule.modules} modul`} />
            <ReportMetric label="Sesi belajar" value={`${selectedModule.sessions} sesi`} />
            <ReportMetric label="Status" value="Aktif" />
          </div>
        )}
        <p className="mt-4 text-xs leading-5 text-slate-500">Detail dan perubahan modul akan tersedia pada tahap berikutnya.</p>
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

function ModuleCard({ module, onClick }: { module: LearningModule; onClick: () => void }) {
  const style = TONE_STYLES[module.tone]
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
        {module.tone === 'code' && (
          <div className="absolute inset-0 grid grid-cols-8 gap-2 p-4 opacity-20" aria-hidden>
            {Array.from({ length: 32 }, (_, index) => (
              <span key={index} className={`h-1 rounded ${index % 3 === 0 ? 'bg-cyan-200' : 'bg-white'}`} />
            ))}
          </div>
        )}
        <CoverIcon
          className={`relative h-16 w-16 transition-transform group-hover:scale-110 ${
            module.tone === 'design' ? 'text-rose-700/70' : 'text-white/80'
          }`}
          strokeWidth={1.25}
          aria-label={style.label}
        />
        <span className="absolute right-3 top-3 rounded-md bg-white/90 px-2 py-1 text-[10px] font-bold text-slate-700 shadow-sm">
          {module.level}
        </span>
      </div>
      <div className="p-4">
        <h3 className="min-h-12 text-lg font-bold leading-6 text-slate-900">{module.title}</h3>
        <div className="mt-3 flex items-center gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Folder className="h-3.5 w-3.5" aria-hidden /> {module.modules} Modul
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock3 className="h-3.5 w-3.5" aria-hidden /> {module.sessions} Sesi
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
