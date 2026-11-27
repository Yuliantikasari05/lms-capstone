import {
  ArrowLeft,
  Award,
  BadgeCheck,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  Medal,
  Star,
  Target,
  Trophy,
  type LucideIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { StudyChart, type StudyMonth } from '../../components/StudyChart'
import { ErrorState, Spinner } from '../../components/ui/States'
import { downloadCsv } from '../../lib/downloadCsv'
import { formatDate } from '../../lib/format'
import { useApiData } from '../../lib/useApiData'
import { TASK_STATUS, subjectColor, timeFormat } from './shared'
import { fetchStudentReport, type StudentReport, type StudentReportAchievement } from './studentApi'

type Tab = 'ringkasan' | 'akademik' | 'tugas' | 'bimbingan'

const TABS: { key: Tab; label: string }[] = [
  { key: 'ringkasan', label: 'Ringkasan' },
  { key: 'akademik', label: 'Akademik' },
  { key: 'tugas', label: 'Tugas' },
  { key: 'bimbingan', label: 'Bimbingan' },
]

interface MonthStat extends StudyMonth {
  activeDays: number
}

const numberFormat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 })
const monthYear = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' })

const ACHIEVEMENT_STYLE: Record<StudentReportAchievement['type'], { Icon: LucideIcon; className: string }> = {
  best_score: { Icon: Medal, className: 'bg-red-100 text-red-500' },
  course_completed: { Icon: Trophy, className: 'bg-blue-50 text-blue-600' },
  first_submission: { Icon: Award, className: 'bg-green-200 text-green-600' },
}

function formatMinutes(minutes: number): string {
  const rest = minutes % 60
  return `${Math.floor(minutes / 60)} Jam${rest ? ` ${rest} Menit` : ''}`
}

/** Laporan dari API → bentuk yang dipakai tampilan (tanpa angka contoh). */
function buildReport(data: StudentReport) {
  const months: MonthStat[] = data.months.map((month) => ({
    date: new Date(`${month.month}-01T00:00:00`),
    hours: month.hours,
    activeDays: month.active_days,
  }))

  return {
    courseCount: data.courses_count,
    modulesDone: data.modules_done,
    modulesTotal: data.modules_total,
    tasksSubmitted: data.assignments_submitted,
    tasksTotal: data.assignments_total,
    averageScore: data.average_score,
    xp: data.xp_earned,
    attendanceRate: data.attendance_percent,
    subjects: data.subjects.map((row) => ({
      subject: row.subject,
      progress: row.progress,
      submitted: row.submitted,
      totalTasks: row.total,
      average: row.average,
      minutes: row.minutes,
    })),
    months,
  }
}

export default function SiswaLaporan() {
  const [tab, setTab] = useState<Tab>('ringkasan')
  const [month, setMonth] = useState<string | undefined>(undefined)
  const report = useApiData(() => fetchStudentReport(month), [month])

  const data = report.data
  const model = useMemo(() => (data ? buildReport(data) : null), [data])
  const monthIndex = data ? Math.max(0, data.months.findIndex((item) => item.month === data.month)) : 0
  const currentMonth = model?.months[monthIndex]
  const lastDay = currentMonth ? new Date(currentMonth.date.getFullYear(), currentMonth.date.getMonth() + 1, 0) : null
  const periodRange = currentMonth && lastDay
    ? `1 - ${lastDay.getDate()} ${new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(lastDay)} ${lastDay.getFullYear()}`
    : '—'

  const downloadReport = () => {
    if (!model || !currentMonth) return
    const lines = [
      ['Laporan Belajar', data ? data.month_label : ''],
      ['Total Belajar (jam)', currentMonth.hours],
      ['Total Hari Aktif', currentMonth.activeDays],
      ['Kelas Diikuti', model.courseCount],
      ['Rata-rata Kehadiran (%)', model.attendanceRate ?? '-'],
      ['Materi Selesai', `${model.modulesDone}/${model.modulesTotal}`],
      ['Tugas Dikumpulkan', `${model.tasksSubmitted}/${model.tasksTotal}`],
      ['Rata-rata Nilai', model.averageScore === null ? '-' : numberFormat.format(model.averageScore)],
      ['XP Didapatkan', model.xp],
      [],
      ['Mata Pelajaran', 'Progres Materi (%)', 'Tugas', 'Rata-rata Nilai', 'Total Belajar'],
      ...model.subjects.map((row) => [
        row.subject,
        row.progress,
        row.totalTasks ? `${row.submitted}/${row.totalTasks}` : '-',
        row.average === null ? '-' : numberFormat.format(row.average),
        row.minutes > 0 ? formatMinutes(row.minutes) : '-',
      ]),
    ]
    downloadCsv(lines, `laporan-${currentMonth.date.getFullYear()}-${String(currentMonth.date.getMonth() + 1).padStart(2, '0')}.csv`)
  }

  return (
    <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="min-w-0">
        <Link to="/siswa" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Kembali ke Dashboard
        </Link>
        <h1 className="mt-4 text-5xl font-bold text-slate-900">Laporan</h1>
        <p className="mt-2 text-slate-800">Pantau perkembangan belajarmu secara menyeluruh</p>

        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3" role="group" aria-label="Jenis laporan">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              aria-pressed={tab === key}
              className={`rounded-2xl px-8 py-3 text-lg transition-colors ${
                tab === key ? 'bg-blue-600 font-semibold text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-900 hover:border-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {report.loading && !data && <Spinner label="Memuat laporan…" />}
        {report.error && <ErrorState error={report.error} onRetry={report.reload} />}

        {data && model && currentMonth && (
          <>
            {tab === 'ringkasan' && (
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <StatCard Icon={Clock} iconClass="bg-orange-50 text-orange-500" label="Total Belajar" value={`${currentMonth.hours} jam`} />
                <StatCard
                  Icon={BookOpen}
                  iconClass="bg-blue-50 text-blue-600"
                  label="Materi Selesai"
                  value={`${model.modulesDone}/${model.modulesTotal}`}
                  progress={model.modulesTotal ? model.modulesDone / model.modulesTotal : 0}
                  barClass="bg-blue-700"
                />
                <StatCard
                  Icon={Target}
                  iconClass="bg-indigo-50 text-indigo-600"
                  label="Tugas Dikumpulkan"
                  value={`${model.tasksSubmitted}/${model.tasksTotal}`}
                  progress={model.tasksTotal ? model.tasksSubmitted / model.tasksTotal : 0}
                  barClass="bg-purple-600"
                />
                <StatCard
                  Icon={BadgeCheck}
                  iconClass="bg-emerald-50 text-emerald-600"
                  label="Rata-rata Nilai"
                  value={model.averageScore === null ? '—' : numberFormat.format(model.averageScore)}
                />
                <StatCard Icon={Star} iconClass="bg-red-100 text-red-600 [&>svg]:fill-current" label="XP Didapatkan" value={`+${model.xp.toLocaleString('id-ID')} XP`} />
              </div>
            )}

            {(tab === 'ringkasan' || tab === 'akademik') && (
              <>
                <StudyChart months={model.months} />
                <SubjectTable model={model} />
              </>
            )}
            {tab === 'tugas' && <TaskTable tasks={data.tasks} />}
            {tab === 'bimbingan' && <SessionTable sessions={data.sessions} attendanceRate={model.attendanceRate} />}
          </>
        )}
      </div>

      <aside className="space-y-4">
        <label className="relative flex items-center gap-3 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 focus-within:border-blue-500">
          <CalendarDays className="h-7 w-7 text-slate-800" strokeWidth={1.5} aria-hidden />
          <span className="flex-1">
            <span className="block text-sm text-slate-500">Periode</span>
            <span className="text-slate-900">{currentMonth ? monthYear.format(currentMonth.date) : '—'}</span>
          </span>
          <ChevronDown className="h-5 w-5 text-slate-700" aria-hidden />
          <select
            value={monthIndex}
            onChange={(event) => {
              const index = Number(event.target.value)
              setMonth(data?.months[index]?.month)
            }}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Pilih periode laporan"
            disabled={!data}
          >
            {(model?.months ?? []).map((item, index) => (
              <option key={item.date.toISOString()} value={index}>
                {monthYear.format(item.date)}
              </option>
            ))}
          </select>
        </label>

        <section className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-5">
          <h2 className="px-1 text-xl font-semibold text-slate-900">Ringkasan Periode</h2>
          <dl className="mt-3">
            {[
              ['Periode', periodRange],
              ['Total Hari Aktif', `${currentMonth?.activeDays ?? 0} hari`],
              ['Kelas Diikuti', `${model?.courseCount ?? 0} kelas`],
              ['Rata-rata Kehadiran', model?.attendanceRate === null || model?.attendanceRate === undefined ? '—' : `${model.attendanceRate}%`],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 border-b border-slate-200 px-10 py-3">
                <dt className="text-slate-900">{label}</dt>
                <dd className="text-right font-semibold text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
          <button type="button" onClick={downloadReport} className="mt-4 px-16 text-blue-600 hover:underline">
            Unduh laporan
          </button>
        </section>

        <section className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-5">
          <h2 className="px-1 text-xl font-semibold text-slate-900">Pencapaian Terbaru</h2>
          <ul className="mt-4 space-y-5 border-b border-slate-200 pb-5">
            {(data?.achievements ?? []).map((achievement) => {
              const style = ACHIEVEMENT_STYLE[achievement.type] ?? ACHIEVEMENT_STYLE.first_submission

              return (
                <li key={achievement.title} className="flex items-center gap-4">
                  <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full ${style.className}`}>
                    <style.Icon className="h-8 w-8" strokeWidth={1.75} aria-hidden />
                  </span>
                  <div>
                    <p className="font-semibold text-slate-900">{achievement.title}</p>
                    <p className="text-xs text-slate-500">{formatDate(achievement.achieved_at)}</p>
                  </div>
                </li>
              )
            })}
            {data && data.achievements.length === 0 && <li className="text-sm text-slate-500">Belum ada pencapaian.</li>}
          </ul>
          <button type="button" className="mt-4 flex items-center gap-8 text-blue-600 hover:underline">
            Lihat Semua Pencapaian
            <span className="flex h-4 w-4 items-center justify-center rounded bg-indigo-100">
              <ChevronRight className="h-3 w-3" aria-hidden />
            </span>
          </button>
        </section>
      </aside>
    </div>
  )
}

function StatCard({
  Icon,
  iconClass,
  label,
  value,
  progress,
  barClass,
}: {
  Icon: LucideIcon
  iconClass: string
  label: string
  value: string
  progress?: number
  barClass?: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 pb-5 pt-4">
      <span className={`flex h-12 w-12 items-center justify-center rounded-lg ${iconClass}`}>
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <p className="mt-5 whitespace-nowrap text-[13px] text-slate-900">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
      {progress !== undefined && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div className={`h-full rounded-full ${barClass}`} style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
    </div>
  )
}

function SubjectTable({ model }: { model: ReturnType<typeof buildReport> }) {
  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white px-4 py-4">
      <h2 className="font-semibold text-slate-900">Performa per Mata Pelajaran</h2>
      <div className="mt-4 overflow-x-auto px-2">
        <table className="w-full min-w-[40rem] text-left">
          <thead className="border-y border-slate-200 bg-slate-50 text-sm text-slate-900">
            <tr>
              <th className="px-4 py-2 font-normal">Mata Pelajaran</th>
              <th className="px-4 py-2 font-normal">Progres Materi</th>
              <th className="px-4 py-2 text-center font-normal">Tugas</th>
              <th className="px-4 py-2 text-center font-normal">Rata-rata Nilai</th>
              <th className="px-4 py-2 text-center font-normal">Total belajar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-xs text-slate-900">
            {model.subjects.map((row) => (
              <tr key={row.subject}>
                <td className="px-2 py-1.5">
                  <span className="flex items-center gap-3 font-semibold">
                    <span className={`flex h-6 w-6 items-center justify-center rounded ${subjectColor(row.subject)}`}>
                      <FileText className="h-3.5 w-3.5" aria-hidden />
                    </span>
                    {row.subject}
                  </span>
                </td>
                <td className="px-4 py-1.5">
                  <span className="flex items-center gap-1">
                    <span className="w-8">{row.progress}%</span>
                    <span className="h-1 w-36 overflow-hidden bg-slate-300">
                      <span className="block h-full bg-blue-700" style={{ width: `${row.progress}%` }} />
                    </span>
                  </span>
                </td>
                <td className="px-4 py-1.5 text-center">{row.totalTasks ? `${row.submitted} / ${row.totalTasks}` : '—'}</td>
                <td className="px-4 py-1.5 text-center text-base font-semibold text-emerald-600">
                  {row.average === null ? <span className="text-slate-400">—</span> : numberFormat.format(row.average)}
                </td>
                <td className="px-4 py-1.5 text-center font-semibold">{row.minutes > 0 ? formatMinutes(row.minutes) : '—'}</td>
              </tr>
            ))}
            {model.subjects.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-center text-slate-500">
                  Belum ada kursus yang diikuti.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function TaskTable({ tasks }: { tasks: StudentReport['tasks'] }) {
  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white px-4 py-4">
      <h2 className="font-semibold text-slate-900">Laporan Tugas</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-y border-slate-200 bg-slate-50 text-slate-900">
            <tr>
              <th className="px-4 py-2 font-normal">Tugas</th>
              <th className="px-4 py-2 font-normal">Mata Pelajaran</th>
              <th className="px-4 py-2 font-normal">Status</th>
              <th className="px-4 py-2 text-center font-normal">Nilai</th>
              <th className="px-4 py-2 text-center font-normal">XP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-900">
            {tasks.map((task) => (
              <tr key={task.id}>
                <td className="px-4 py-2.5 font-semibold">{task.title}</td>
                <td className="px-4 py-2.5">{task.subject ?? '—'}</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-lg px-3 py-1 text-xs ${TASK_STATUS[task.state.status].badge}`}>{TASK_STATUS[task.state.status].label}</span>
                </td>
                <td className="px-4 py-2.5 text-center font-semibold text-emerald-600">
                  {task.state.score === null ? <span className="text-slate-400">—</span> : numberFormat.format(task.state.score)}
                </td>
                <td className="px-4 py-2.5 text-center">{task.state.status === 'belum' ? '—' : `+${task.xp_points}`}</td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-center text-slate-500">
                  Belum ada tugas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function SessionTable({ sessions, attendanceRate }: { sessions: StudentReport['sessions']; attendanceRate: number | null }) {
  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white px-4 py-4">
      <h2 className="font-semibold text-slate-900">Laporan Bimbingan</h2>
      <p className="mt-1 text-sm text-slate-500">
        Rata-rata kehadiran {attendanceRate === null ? '—' : `${attendanceRate}%`}. Kehadiran tercatat saat menekan &quot;Gabung sesi&quot;.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="border-y border-slate-200 bg-slate-50 text-slate-900">
            <tr>
              <th className="px-4 py-2 font-normal">Sesi</th>
              <th className="px-4 py-2 font-normal">Mentor</th>
              <th className="px-4 py-2 font-normal">Tanggal</th>
              <th className="px-4 py-2 font-normal">Waktu</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-900">
            {sessions.map((session) => (
              <tr key={session.id}>
                <td className="px-4 py-2.5 font-semibold">
                  {session.title}
                  {session.attended && <span className="ml-2 rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-600">Hadir</span>}
                </td>
                <td className="px-4 py-2.5">{session.mentor_name ?? '—'}</td>
                <td className="px-4 py-2.5">{formatDate(session.starts_at)}</td>
                <td className="px-4 py-2.5">
                  {session.starts_at ? timeFormat.format(new Date(session.starts_at)) : '—'}
                  {session.ends_at && ` - ${timeFormat.format(new Date(session.ends_at))}`}
                </td>
              </tr>
            ))}
            {sessions.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-4 text-center text-slate-500">
                  Belum ada sesi bimbingan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
