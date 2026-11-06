import { Award, BarChart3, ChevronRight, MonitorPlay, Presentation, Timer, Video, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'

/*
 * DATA CONTOH (statis). Endpoint dashboard Karyawan belum ada.
 * Saat API tersedia, ganti konstanta di bawah ini dengan data dari backend.
 */
const WEEKLY_TARGET_PERCENT = 80
const ACTIVE_TRAINING = { title: 'Proyek Pengembangan Mandiri', modulesDone: 4, modulesTotal: 6 }
const TASK_SUMMARY = {
  remaining: 5,
  /** Tugas terdekat. dueDay = tanggal tenggat. */
  nearest: [
    { id: 1, title: 'Kuis Basis Data Waktu', dueDay: 14 },
    { id: 2, title: 'Evaluasi Proyek', dueDay: 20 },
  ],
}
const COURSE_COMPLETION = [
  { key: 'selesai', label: 'Selesai', value: 12, className: 'stroke-blue-600', dot: 'bg-blue-600' },
  { key: 'berjalan', label: 'Berjalan', value: 5, className: 'stroke-blue-300', dot: 'bg-blue-300' },
  { key: 'belum', label: 'Belum Dimulai', value: 17, className: 'stroke-blue-100', dot: 'bg-blue-100' },
]
const UPCOMING_WEBINARS = [
  { id: 1, title: 'Webinar: Kepemimpinan Digital', speaker: 'Ahmad Dani (HR)', schedule: 'Senin, 02.00-03.30' },
  { id: 2, title: 'Webinar: Kepemimpinan Digital', speaker: 'Ahmad Dani (HR)', schedule: 'Senin, 02.00-03.30' },
]
const LATEST_MATERIALS: { id: number; title: string; type: 'word' | 'pdf' | 'video' }[] = [
  { id: 1, title: 'Kebijakan', type: 'word' },
  { id: 2, title: 'Panduan Proyek Mandiri', type: 'pdf' },
  { id: 3, title: 'Rekaman Kepemimpinan Digital', type: 'video' },
]

const SHORTCUTS: { label: string; to: string; Icon: LucideIcon }[] = [
  { label: 'Pelatihan', to: '/karyawan/trainings', Icon: Presentation },
  { label: 'Webinar', to: '/karyawan/webinars', Icon: MonitorPlay },
  { label: 'Sertifikat', to: '/karyawan/certificates', Icon: Award },
  { label: 'Laporan', to: '/karyawan/reports', Icon: BarChart3 },
]

const CARD = 'rounded-3xl bg-white p-8 shadow-md'

export default function KaryawanDashboard() {
  const { user } = useAuth()
  const trainingPercent = Math.round((ACTIVE_TRAINING.modulesDone / ACTIVE_TRAINING.modulesTotal) * 100)

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <h1 className="text-4xl font-extrabold uppercase text-slate-800">Halo, {user?.name ?? ''}! 👋</h1>
          <p className="mt-2 max-w-sm italic text-slate-500">Senang melihatmu kembali, Mari lanjutkan kemajuan belajarmu</p>
        </div>
        <div className="w-full rounded-2xl bg-white px-7 py-5 shadow-md sm:w-80">
          <p className="text-sm font-bold text-slate-800">Target Mingguan</p>
          <ProgressBar percent={WEEKLY_TARGET_PERCENT} label="Target mingguan" className="mt-3" />
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-6 lg:grid-cols-4">
        {SHORTCUTS.map(({ label, to, Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center justify-center gap-3 rounded-2xl bg-white px-4 py-5 text-xl font-bold text-slate-800 shadow-md transition-shadow hover:shadow-lg"
          >
            <Icon className="h-7 w-7 shrink-0" strokeWidth={2.25} aria-hidden />
            {label}
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <section className={`flex min-h-64 flex-col ${CARD}`}>
          <h2 className="text-2xl font-bold text-slate-800">Pelatihan Aktif</h2>
          <p className="mt-1 font-semibold text-slate-400">Kemajuan Kursus</p>
          <p className="mt-3 text-xl font-bold text-slate-800">{ACTIVE_TRAINING.title}</p>
          <ProgressBar percent={trainingPercent} label="Kemajuan kursus" className="mt-5" />
          <p className="mt-auto pt-6 text-xs font-semibold text-slate-400">
            {ACTIVE_TRAINING.modulesDone} dari {ACTIVE_TRAINING.modulesTotal} modul selesai
          </p>
        </section>

        <section className={CARD}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-bold text-slate-800">Tugas &amp; Evaluasi</h2>
            <span className="rounded-full bg-sky-200 px-3 py-1 text-[10px] font-semibold text-slate-800">{TASK_SUMMARY.remaining} Tugas Tersisa</span>
          </div>
          <ul className="mt-6 space-y-2">
            {TASK_SUMMARY.nearest.map((task) => (
              <li key={task.id} className="flex items-center gap-3 font-semibold text-slate-800">
                <span className="ml-4 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-800" aria-hidden />
                <span className="min-w-0 flex-1">{task.title}</span>
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm"
                  title={`Tenggat tanggal ${task.dueDay}`}
                  aria-label={`Tenggat tanggal ${task.dueDay}`}
                >
                  {task.dueDay}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <CompletionCard />
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="mb-6 text-2xl font-bold text-slate-800">Jadwal Webinar Mendatang</h2>
          <ul className="space-y-6">
            {UPCOMING_WEBINARS.map((webinar) => (
              <li key={webinar.id} className="flex flex-wrap items-center gap-5 rounded-2xl bg-white px-6 py-6 shadow-md">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-800">
                  <Timer className="h-6 w-6" aria-hidden />
                </span>
                <div className="min-w-[17rem] flex-1">
                  <p className="text-lg font-bold text-slate-800">{webinar.title}</p>
                  <p className="text-xs font-semibold text-slate-400">{webinar.speaker}</p>
                </div>
                <p className="text-sm font-semibold text-slate-500">{webinar.schedule}</p>
                <span className="rounded-lg bg-sky-200 px-3.5 py-1.5 text-xs font-semibold text-slate-600">Mendatang</span>
                <Link
                  to="/karyawan/webinars"
                  className="flex h-7 w-9 items-center justify-center rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300"
                  aria-label={`Lihat ${webinar.title}`}
                >
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col">
          <h2 className="mb-6 text-2xl font-bold text-slate-800">Materi Terbaru</h2>
          <ul className="flex-1 space-y-5 rounded-2xl bg-white px-10 py-8 shadow-md">
            {LATEST_MATERIALS.map((material) => (
              <li key={material.id} className="flex items-center gap-4 text-sm font-bold text-slate-800">
                <MaterialIcon type={material.type} />
                {material.title}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  )
}

function ProgressBar({ percent, label, className = '' }: { percent: number; label: string; className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-300"
        role="progressbar"
        aria-label={label}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full bg-yellow-400" style={{ width: `${percent}%` }} />
      </div>
      <span className="font-semibold text-yellow-500">{percent}%</span>
    </div>
  )
}

/** Kartu Ringkasan Laporan: donut penyelesaian kursus. Menyorot potongan menampilkan jumlahnya di tengah. */
function CompletionCard() {
  const [hoverKey, setHoverKey] = useState<string | null>(null)
  const total = COURSE_COMPLETION.reduce((sum, item) => sum + item.value, 0)
  const hovered = COURSE_COMPLETION.find((item) => item.key === hoverKey)
  const radius = 38
  const circumference = 2 * Math.PI * radius
  const gap = 2

  let offset = 0
  const segments = COURSE_COMPLETION.map((item) => {
    const length = (item.value / total) * circumference
    const segment = { ...item, length, offset }
    offset += length
    return segment
  })

  return (
    <section className={CARD}>
      <h2 className="text-2xl font-bold text-slate-800">Ringkasan Laporan</h2>
      <div className="mt-4 flex flex-wrap items-start gap-x-8 gap-y-4">
        <div className="w-28 shrink-0">
          <svg viewBox="0 0 120 120" className="w-full" role="img" aria-label="Diagram penyelesaian kursus" onMouseLeave={() => setHoverKey(null)}>
            <g transform="rotate(-90 60 60)">
              {segments.map((segment) => (
                <circle
                  key={segment.key}
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="none"
                  strokeWidth="24"
                  className={segment.className}
                  strokeDasharray={`${segment.length - gap} ${circumference - segment.length + gap}`}
                  strokeDashoffset={-segment.offset}
                  onMouseEnter={() => setHoverKey(segment.key)}
                />
              ))}
            </g>
            {hovered && (
              <text x="60" y="66" textAnchor="middle" className="fill-slate-800 text-lg font-bold">
                {hovered.value}
              </text>
            )}
          </svg>
          <table className="sr-only">
            <caption>Penyelesaian kursus</caption>
            <tbody>
              {COURSE_COMPLETION.map((item) => (
                <tr key={item.key}>
                  <th scope="row">{item.label}</th>
                  <td>{item.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="min-w-0 flex-1">
          <p className="whitespace-nowrap text-lg font-bold text-slate-800">Penyelesaian Kursus</p>
          <ul className="mt-2 space-y-1.5 text-xs font-semibold text-slate-800">
            {COURSE_COMPLETION.map((item) => (
              <li key={item.key} className={`flex items-center gap-3 ${hoverKey === item.key ? 'underline' : ''}`}>
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.dot}`} aria-hidden />
                {item.label} {item.value}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-4 max-w-[10rem] text-xs text-slate-400">Penyelesaian kursus dari semua pelatihan Anda</p>
    </section>
  )
}

/** Ikon jenis materi: Word, PDF, atau video. */
function MaterialIcon({ type }: { type: 'word' | 'pdf' | 'video' }) {
  if (type === 'video') return <Video className="h-6 w-6 shrink-0 fill-current text-slate-900" aria-label="Video" />
  return (
    <span className="flex h-7 w-6 shrink-0 items-center justify-center rounded-sm bg-slate-900 text-[9px] font-bold text-white">
      {type === 'word' ? 'W' : 'PDF'}
    </span>
  )
}
