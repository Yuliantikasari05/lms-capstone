import { ArrowLeft, BookOpen, Circle, CircleCheck, CirclePlay, FileText, Star, User, Video, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EmptyState, ErrorState, Spinner } from '../../components/ui/States'
import { useApiData } from '../../lib/useApiData'
import {
  completeMaterial,
  fetchStudentCourse,
  recordStudyMinute,
  studentMaterialFileUrl,
  type StudentCourseModule,
  type StudentMaterial,
} from './studentApi'

const MODULE_TYPE = {
  video: { label: 'Video', Icon: Video },
  pdf: { label: 'Dokumen PDF', Icon: FileText },
}

const STATUS_ICON = {
  done: { Icon: CircleCheck, className: 'bg-emerald-50 text-emerald-500', label: 'Selesai' },
  current: { Icon: CirclePlay, className: 'bg-blue-50 text-blue-600', label: 'Sedang dikerjakan' },
  todo: { Icon: Circle, className: 'bg-slate-100 text-slate-400', label: 'Belum dimulai' },
}

interface ModuleRow {
  id: number
  title: string
  type: 'video' | 'pdf'
  status: 'done' | 'current' | 'todo'
  materials: StudentMaterial[]
}

/** Ubah modul API menjadi baris modul yang dipakai tampilan (tanpa mengubah markup). */
function toRows(modules: StudentCourseModule[]): ModuleRow[] {
  let hasCurrent = false

  return modules.map((module) => {
    const materials = module.materials ?? []
    const done = module.completed
    const partiallyDone = materials.some((material) => material.completed)
    const status: ModuleRow['status'] = done ? 'done' : partiallyDone || !hasCurrent ? 'current' : 'todo'
    if (status === 'current') hasCurrent = true

    return {
      id: module.id,
      title: module.title,
      type: materials[0]?.type === 'video' ? 'video' : 'pdf',
      status,
      materials,
    }
  })
}

/** Detail kursus (/siswa/materials/:courseId). Biru untuk kursus reguler, merah untuk program Lembaga Bimbingan. */
export default function SiswaMateriDetail() {
  const { courseId } = useParams()
  const detail = useApiData(() => fetchStudentCourse(courseId ?? ''), [courseId])
  const [busyId, setBusyId] = useState<number | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const course = detail.data
  const firstMaterialId = course?.modules.flatMap((module) => module.materials).find((material) => !material.completed)?.id
    ?? course?.modules.flatMap((module) => module.materials)[0]?.id

  // Waktu belajar: satu sinyal per menit selama halaman materi terbuka (aturan 2 Nov 2026).
  useEffect(() => {
    if (!firstMaterialId) return
    const timer = window.setInterval(() => {
      recordStudyMinute(firstMaterialId).catch(() => undefined)
    }, 60_000)

    return () => window.clearInterval(timer)
  }, [firstMaterialId])

  const finishModule = async (module: ModuleRow) => {
    const pending = module.materials.filter((material) => !material.completed)
    if (pending.length === 0) {
      setNotice('Modul ini sudah selesai.')
      return
    }

    setBusyId(module.id)
    setNotice(null)
    try {
      let xp = 0
      for (const material of pending) {
        const result = await completeMaterial(material.id)
        xp += result.xp_awarded
      }
      setNotice(xp > 0 ? `Modul selesai. Anda mendapat ${xp} XP.` : 'Modul selesai.')
      detail.reload()
    } catch {
      setNotice('Progres gagal disimpan. Coba lagi.')
    } finally {
      setBusyId(null)
    }
  }

  if (detail.loading && !course) {
    return (
      <>
        <BackLink />
        <Spinner label="Memuat materi…" />
      </>
    )
  }

  if (detail.error) {
    return (
      <>
        <BackLink />
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white">
          {detail.error.kind === 'not_found' ? (
            <EmptyState title="Materi tidak ditemukan" description="Kursus yang Anda buka tidak tersedia." />
          ) : (
            <ErrorState error={detail.error} onRetry={detail.reload} />
          )}
        </div>
      </>
    )
  }

  if (!course) return null

  const isLembaga = course.source === 'lembaga'
  const locked = false // Program Lembaga yang belum dibeli tidak muncul di daftar (belum ada alur pembelian).
  const progress = course.progress
  const rows = toRows(course.modules)

  return (
    <>
      <section className="relative px-6 pb-7 pt-6 text-white">
        <div className={`absolute inset-0 -rotate-[0.5deg] rounded-[2rem] ${isLembaga ? 'bg-red-600' : 'bg-blue-600'}`} aria-hidden />

        <div className="relative flex flex-wrap items-center justify-between gap-8">
          <div className="min-w-0">
            <BackLink light />
            <span className="mt-4 block w-fit rounded-md bg-white/20 px-3.5 py-1.5 text-xs font-semibold">Materi</span>
            <h1 className="mt-3 text-5xl font-extrabold">{course.title}</h1>
            <p className="mt-1 text-2xl">{course.description ?? ''}</p>
            <div className="mt-8 flex flex-wrap items-center gap-x-12 gap-y-2 text-xl">
              <span className="flex items-center gap-3">
                <User className="h-6 w-6" aria-hidden />
                {course.owner}
              </span>
              <span className="flex items-center gap-2">
                <Star className="h-6 w-6 fill-current" aria-hidden />
                {/* Ulasan belum tersedia dari API: tampilkan keadaan kosong, bukan angka contoh. */}
                Belum ada ulasan
              </span>
            </div>
          </div>

          {locked ? (
            <div className="flex items-center gap-2">
              <BalloonIllustration />
              <button type="button" className="rounded-2xl bg-white px-6 py-6 font-extrabold text-red-600 hover:bg-red-50">
                BELI MODUL INI SEKARANG &nbsp;&gt;
              </button>
            </div>
          ) : (
            <div className="w-full max-w-sm rounded-xl border border-white/30 bg-white/15 p-5">
              <div className="flex items-center justify-between text-2xl font-semibold">
                <span>Progres</span>
                <span>{progress}%</span>
              </div>
              <div
                className="mt-4 h-4 overflow-hidden rounded-full bg-slate-500/60"
                role="progressbar"
                aria-label="Progres kursus"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="h-full rounded-full bg-green-500" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="mt-8 border-b border-slate-200">
        <span className="inline-block border-b-[3px] border-blue-600 px-7 pb-1 text-2xl text-blue-600">Materi</span>
      </div>

      {notice && (
        <p className="mt-4 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700" role="status">
          {notice}
        </p>
      )}

      <ul className="mt-6">
        {rows.map((module) => (
          <ModuleRow key={module.id} module={module} locked={locked} busy={busyId === module.id} onComplete={() => finishModule(module)} />
        ))}
        {rows.length === 0 && (
          <li className="border-b border-slate-200 px-5 py-6 text-center text-slate-500">Belum ada modul pada kursus ini.</li>
        )}
      </ul>

      <section className="mt-24 px-2 sm:px-8">
        <h2 className="font-semibold text-slate-900">Statistik Materi</h2>
        <div className="mt-3 flex items-center gap-6 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <BookOpen className="h-5 w-5" aria-hidden />
          </span>
          <span className="flex-1 text-slate-900">Total Modul</span>
          <span className="text-3xl font-semibold text-slate-900">{course.modules_total}</span>
        </div>
        <div className="mt-6 flex items-center gap-6 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <span className="flex h-11 w-11 items-center justify-center text-amber-500">
            <Zap className="h-8 w-8 fill-current" aria-hidden />
          </span>
          <span className="flex-1 text-slate-900">Total XP</span>
          <span className="text-3xl font-semibold text-slate-900">{course.total_xp} XP</span>
        </div>
      </section>
    </>
  )
}

function BackLink({ light = false }: { light?: boolean }) {
  return (
    <Link
      to="/siswa/materials"
      className={`inline-flex items-center gap-2 ${light ? 'text-white/90 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Kembali
    </Link>
  )
}

function ModuleRow({
  module,
  locked,
  busy,
  onComplete,
}: {
  module: ModuleRow
  locked: boolean
  busy: boolean
  onComplete: () => void
}) {
  const type = MODULE_TYPE[module.type]
  const status = STATUS_ICON[module.status]
  const linkable = module.materials.find((material) => material.has_file || material.external_url)

  return (
    <li className="flex items-center gap-5 border-b border-slate-200 px-5 py-3 last:border-b-0">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${status.className}`} title={status.label}>
        <status.Icon className="h-4 w-4" aria-label={status.label} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xl font-semibold text-slate-900">{module.title}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-600">
          <type.Icon className="h-3.5 w-3.5" aria-hidden />
          {type.label}
        </p>
      </div>
      {!locked && linkable && (
        <a
          href={linkable.has_file ? studentMaterialFileUrl(linkable.id) : linkable.external_url ?? '#'}
          target="_blank"
          rel="noreferrer"
          className="rounded-md bg-slate-200 px-5 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-300"
        >
          Buka materi
        </a>
      )}
      {!locked && module.status === 'done' && (
        <button type="button" onClick={onComplete} className="rounded-md bg-slate-200 px-5 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-300">
          {busy ? 'Menyimpan…' : 'Ulas'}
        </button>
      )}
      {!locked && module.status === 'current' && (
        <button
          type="button"
          onClick={onComplete}
          disabled={busy}
          className="rounded-md bg-blue-600 px-5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {busy ? 'Menyimpan…' : 'Mulai'}
        </button>
      )}
    </li>
  )
}

/** Ilustrasi dekoratif program Lembaga: orang bermain balon. */
function BalloonIllustration() {
  const ink = '#1F2937'
  return (
    <svg viewBox="0 0 260 240" className="-mb-7 hidden h-60 self-end lg:block" aria-hidden>
      <path d="M8 58c14-14 30-12 36 0 4 8-6 10-6 2 0-8 14-6 22 2" fill="none" stroke="white" strokeWidth="1.5" />
      <path d="M176 44c10 12 22 14 30 6 6-6-4-10-6-2-2 8 12 14 26 4" fill="none" stroke="white" strokeWidth="1.5" />
      <ellipse cx="130" cy="32" rx="19" ry="23" fill="white" />
      <path d="M126 56h8l-4 6z" fill="white" />
      <ellipse cx="46" cy="110" rx="20" ry="22" fill="#CBD5E1" stroke={ink} strokeWidth="1.2" />
      <path d="M36 100c2-6 6-9 10-10" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="224" cy="104" rx="20" ry="22" fill="#CBD5E1" stroke={ink} strokeWidth="1.2" />
      <path d="M232 92c3 3 5 7 4 12" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <path d="M100 168 66 146M160 168l34-22" stroke="white" strokeWidth="9" strokeLinecap="round" />
      <path d="M104 160c0-14 12-22 26-22s26 8 26 22l4 42c0 12-14 18-30 18s-30-6-30-18z" fill="#2B2D42" />
      <circle cx="130" cy="124" r="20" fill="white" stroke={ink} strokeWidth="1.5" />
      <path d="M114 112c6-14 30-16 38-2 6 10 0 22-4 24" fill="none" stroke={ink} strokeWidth="1.5" />
      <path d="M122 124h6M134 122l5 3M128 132c2 1 4 1 6 0" fill="none" stroke={ink} strokeWidth="1.2" strokeLinecap="round" />
      <rect x="118" y="218" width="9" height="24" fill="white" />
      <rect x="133" y="218" width="9" height="24" fill="white" />
      <rect x="127" y="218" width="6" height="24" fill="#E11D48" />
    </svg>
  )
}
