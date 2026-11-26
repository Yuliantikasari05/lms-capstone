import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  ClipboardList,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { ErrorState } from '../../components/ui/States'
import type { CourseType } from '../../features/courses/types'
import { api } from '../../lib/api'
import { useApiData } from '../../lib/useApiData'
import { courseAudience } from './courseData'

interface MentorSummaryCourse {
  id: number
  title: string
  type: CourseType
  modules_count: number
  sessions_count: number
  participants_count: number
}

interface MentorSummary {
  courses_total: number
  courses_active: number
  students_total: number
  students_active: number
  new_students_this_month: number
  upcoming_sessions_total: number
  courses: MentorSummaryCourse[]
}

interface SummaryItem {
  label: string
  value: string
  hint: string
  Icon: LucideIcon
  color: 'blue' | 'green' | 'amber' | 'orange'
}

function summaryCards(summary: MentorSummary | null): SummaryItem[] {
  return [
    { label: 'Kelas aktif', value: summary ? String(summary.courses_active) : '—', hint: `${summary?.courses_total ?? 0} kelas total`, Icon: BookOpen, color: 'blue' },
    { label: 'Jumlah siswa', value: summary ? String(summary.students_total) : '—', hint: `${summary?.students_active ?? 0} siswa aktif`, Icon: Users, color: 'green' },
    { label: 'Kelas mendatang', value: summary ? String(summary.upcoming_sessions_total) : '—', hint: 'Sesi terjadwal', Icon: CalendarDays, color: 'amber' },
    { label: 'Pendaftar', value: summary ? String(summary.new_students_this_month) : '—', hint: 'Siswa baru bulan ini', Icon: UserPlus, color: 'orange' },
  ]
}

const STUDENT_GROUPS = [
  { label: 'Aktif', male: 85, female: 25 },
  { label: 'Berisiko', male: 2, female: 7 },
  { label: 'Tidak aktif', male: 0, female: 3 },
]

const TASK_STATUS = [
  { label: 'Tugas belum dinilai', count: 57, color: '#ffa83d' },
  { label: 'Tugas dinilai', count: 23, color: '#36bfd2' },
  { label: 'Belum dikumpulkan', count: 13, color: '#ff8985' },
  { label: 'Tugas dikumpulkan', count: 67, color: '#8875f8' },
]

const QUICK_ACTIONS: { label: string; to: string; Icon: LucideIcon; tone: string }[] = [
  { label: 'Kelola Tugas', to: '/mentor/assignments', Icon: ClipboardList, tone: 'violet' },
  { label: 'Kelola Kurikulum', to: '/mentor/curriculum', Icon: BookOpen, tone: 'purple' },
  { label: 'Kelola Jadwal bimbingan', to: '/mentor/schedule', Icon: CalendarDays, tone: 'blue' },
]

const TASK_TOTAL = TASK_STATUS.reduce((total, item) => total + item.count, 0)

function SummaryCard({
  label,
  value,
  hint,
  Icon,
  color,
}: SummaryItem) {
  const colors = {
    blue: { icon: 'bg-blue-50 text-blue-500', bar: 'bg-blue-500' },
    green: { icon: 'bg-lime-50 text-lime-500', bar: 'bg-lime-500' },
    amber: { icon: 'bg-amber-50 text-amber-400', bar: 'bg-amber-400' },
    orange: { icon: 'bg-orange-50 text-orange-400', bar: 'bg-orange-400' },
  }

  return (
    <article className="relative overflow-hidden rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${colors[color].icon}`}>
          <Icon className="h-6 w-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-700">{label}</p>
          <p className="mt-1 text-[10px] leading-4 text-slate-500">{hint}</p>
        </div>
        <strong className="text-2xl font-bold text-slate-900">{value}</strong>
      </div>
      <div className={`absolute inset-x-0 bottom-0 h-1.5 ${colors[color].bar}`} />
    </article>
  )
}

function StudentProgressChart() {
  const width = 620
  const height = 220
  const plot = { left: 44, right: 12, top: 16, bottom: 34 }
  const plotHeight = height - plot.top - plot.bottom
  const max = 100
  const y = (value: number) => plot.top + plotHeight * (1 - value / max)
  const groups = STUDENT_GROUPS
  const groupWidth = (width - plot.left - plot.right) / groups.length
  const barWidth = 62

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-900">Perkembangan siswa</h2>
        <div className="flex gap-4 text-[11px] text-slate-600" aria-label="Legenda grafik">
          <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm bg-violet-400" />Laki-laki</span>
          <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm bg-rose-300" />Perempuan</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Grafik jumlah siswa berdasarkan status dan gender">
        {[0, 20, 40, 60, 80, 100].map((tick) => (
          <g key={tick}>
            <line x1={plot.left} x2={width - plot.right} y1={y(tick)} y2={y(tick)} stroke="#e8edf4" strokeDasharray={tick === 0 ? undefined : '3 3'} />
            <text x={plot.left - 10} y={y(tick) + 3} textAnchor="end" fill="#64748b" fontSize="10">{tick}</text>
          </g>
        ))}
        {groups.map((group, index) => {
          const center = plot.left + groupWidth * (index + 0.5)
          const maleHeight = plotHeight * (group.male / max)
          const femaleHeight = plotHeight * (group.female / max)
          return (
            <g key={group.label}>
              <rect x={center - barWidth - 2} y={y(group.male)} width={barWidth} height={maleHeight} rx="2" fill="#9a87fa" />
              <rect x={center + 2} y={y(group.female)} width={barWidth} height={femaleHeight} rx="2" fill="#ff9b96" />
              <text x={center} y={height - 10} textAnchor="middle" fill="#64748b" fontSize="10">{group.label}</text>
            </g>
          )
        })}
      </svg>
    </section>
  )
}

function WeeklyProgressChart() {
  const circumference = 2 * Math.PI * 58
  let offset = 0

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Progres mingguan</h2>
      <div className="relative mx-auto mt-3 aspect-square w-full max-w-[250px]">
        <svg viewBox="0 0 160 160" className="h-full w-full" role="img" aria-label={`Status ${TASK_TOTAL} tugas dalam minggu ini`}>
          <g transform="rotate(-90 80 80)">
            {TASK_STATUS.map((item) => {
              const length = (item.count / TASK_TOTAL) * circumference
              const circle = (
                <circle
                  key={item.label}
                  cx="80"
                  cy="80"
                  r="58"
                  fill="none"
                  stroke={item.color}
                  strokeWidth="28"
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={-offset}
                />
              )
              offset += length
              return circle
            })}
          </g>
          <text x="80" y="76" textAnchor="middle" fill="#111827" fontSize="20" fontWeight="700">{TASK_TOTAL}</text>
          <text x="80" y="92" textAnchor="middle" fill="#64748b" fontSize="9">TUGAS</text>
        </svg>
      </div>
      <ul className="mt-3 space-y-3">
        {TASK_STATUS.map((item) => (
          <li key={item.label}>
            <div className="mb-1 flex items-center justify-between gap-2 text-[10px]">
              <span className="text-slate-700">{item.label}</span>
              <span className="shrink-0 text-slate-500">{item.count}/{TASK_TOTAL}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={item.label} aria-valuenow={item.count} aria-valuemin={0} aria-valuemax={TASK_TOTAL}>
              <div className="h-full rounded-full" style={{ width: `${(item.count / TASK_TOTAL) * 100}%`, backgroundColor: item.color }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function QuickActions() {
  const toneClasses = {
    violet: 'bg-indigo-50 text-indigo-500',
    purple: 'bg-purple-50 text-purple-600',
    blue: 'bg-blue-50 text-blue-600',
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">Aksi cepat</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {QUICK_ACTIONS.map(({ label, to, Icon, tone }) => (
          <Link key={to} to={to} className={`flex min-h-14 items-center gap-3 rounded-xl px-4 py-3 text-xs font-medium transition hover:ring-2 hover:ring-brand-100 ${toneClasses[tone as keyof typeof toneClasses]}`}>
            <Icon className="h-5 w-5 shrink-0" aria-hidden />
            <span>{label}</span>
            <ArrowUpRight className="ml-auto h-4 w-4 shrink-0 opacity-60" aria-hidden />
          </Link>
        ))}
      </div>
    </section>
  )
}

function MyCourses({ courses }: { courses: MentorSummaryCourse[] }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-900">Kursus saya</h2>
        <Link to="/mentor/courses" className="text-xs font-medium text-brand-700 hover:underline">Lihat semua</Link>
      </div>
      <ul className="space-y-2">
        {courses.slice(0, 3).map((course) => (
          <li key={course.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-slate-800">{course.title}</p>
              <p className="mt-1 text-[10px] text-slate-500">{course.modules_count} modul <span className="mx-1">·</span>{course.sessions_count} sesi</p>
            </div>
            <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-medium text-indigo-600">{course.participants_count} {courseAudience(course.type)}</span>
          </li>
        ))}
        {courses.length === 0 && <li className="rounded-lg bg-slate-50 px-3 py-2.5 text-[10px] text-slate-500">Belum ada kursus yang diampu.</li>}
      </ul>
    </section>
  )
}

export default function MentorDashboard() {
  const summary = useApiData<MentorSummary>(
    async () => (await api.get<{ data: MentorSummary }>('/mentor/summary')).data.data,
    [],
  )

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-700">Ringkasan langsung · grafik contoh</span>
      </div>
      {summary.error && <ErrorState error={summary.error} onRetry={summary.reload} />}
      <section aria-label="Ringkasan Mentor" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards(summary.data).map((item) => <SummaryCard key={item.label} {...item} />)}
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <StudentProgressChart />
          <QuickActions />
          <MyCourses courses={summary.data?.courses ?? []} />
        </div>
        <WeeklyProgressChart />
      </div>
    </div>
  )
}
