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
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDate } from '../../lib/format'
import { SCHEDULE } from './jadwalData'
import { COURSES, isEnrolled } from './materiData'
import { TASK_STATUS, subjectColor, timeFormat } from './shared'
import { TASKS } from './tugasData'

/*
 * DATA CONTOH (statis) yang belum ada di halaman lain. Angka lain di halaman ini
 * dihitung dari data Materi (materiData), Tugas (tugasData), dan Jadwal (jadwalData).
 */
/** Jam belajar 11 bulan sebelum bulan ini; bulan ini dihitung dari studyMinutes kursus. */
const PAST_MONTH_HOURS = [12, 15, 18, 16, 20, 22, 20, 25, 30, 35, 40]
/** Hari aktif 12 bulan terakhir, bulan ini paling akhir. */
const ACTIVE_DAYS = [8, 9, 11, 10, 12, 13, 12, 14, 16, 18, 20, 18]
const ATTENDANCE_RATE = 92
const ACHIEVEMENTS: { Icon: LucideIcon; className: string; title: string; date: string }[] = [
  { Icon: Medal, className: 'bg-red-100 text-red-500', title: 'Nilai Terbaik Matematika (90)', date: '2026-10-20' },
  { Icon: Trophy, className: 'bg-blue-50 text-blue-600', title: 'Menyelesaikan Pendidikan Pancasila', date: '2026-10-18' },
  { Icon: Award, className: 'bg-green-200 text-green-600', title: 'Tugas Pertama Dikumpulkan', date: '2026-10-15' },
]

type Tab = 'ringkasan' | 'akademik' | 'tugas' | 'bimbingan'

const TABS: { key: Tab; label: string }[] = [
  { key: 'ringkasan', label: 'Ringkasan' },
  { key: 'akademik', label: 'Akademik' },
  { key: 'tugas', label: 'Tugas' },
  { key: 'bimbingan', label: 'Bimbingan' },
]

interface MonthStat {
  date: Date
  hours: number
  activeDays: number
}

const numberFormat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 })
const monthShort = new Intl.DateTimeFormat('id-ID', { month: 'short' })
const monthYear = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' })

function formatMinutes(minutes: number): string {
  const rest = minutes % 60
  return `${Math.floor(minutes / 60)} Jam${rest ? ` ${rest} Menit` : ''}`
}

const average = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null)

/** Semua angka laporan, dihitung dari data contoh halaman Materi dan Tugas. */
function buildReport() {
  const courses = COURSES.filter(isEnrolled)
  const modules = courses.flatMap((course) => course.modules)
  const submitted = TASKS.filter((task) => task.status !== 'belum')
  const scores = TASKS.flatMap((task) => (task.score === undefined ? [] : [task.score]))
  const studyMinutes = courses.reduce((sum, course) => sum + course.studyMinutes, 0)

  const subjects = [...new Set([...courses.map((course) => course.subject), ...TASKS.map((task) => task.subject)])]
  const subjectRows = subjects.map((subject) => {
    const course = courses.find((item) => item.subject === subject)
    const tasks = TASKS.filter((task) => task.subject === subject)
    return {
      subject,
      progress: course ? (course.progress ?? 0) : null,
      submitted: tasks.filter((task) => task.status !== 'belum').length,
      totalTasks: tasks.length,
      average: average(tasks.flatMap((task) => (task.score === undefined ? [] : [task.score]))),
      minutes: course && course.studyMinutes > 0 ? course.studyMinutes : null,
    }
  })

  const today = new Date()
  const hours = [...PAST_MONTH_HOURS, Math.round(studyMinutes / 60)]
  const months: MonthStat[] = hours.map((value, index) => ({
    date: new Date(today.getFullYear(), today.getMonth() - (hours.length - 1 - index), 1),
    hours: value,
    activeDays: ACTIVE_DAYS[index],
  }))

  return {
    courseCount: courses.length,
    modulesDone: modules.filter((module) => module.status === 'done').length,
    modulesTotal: modules.length,
    tasksSubmitted: submitted.length,
    tasksTotal: TASKS.length,
    averageScore: average(scores),
    xp: submitted.reduce((sum, task) => sum + task.xp, 0),
    subjectRows,
    months,
  }
}

const REPORT = buildReport()

export default function SiswaLaporan() {
  const [tab, setTab] = useState<Tab>('ringkasan')
  const [monthIndex, setMonthIndex] = useState(REPORT.months.length - 1)
  const month = REPORT.months[monthIndex]
  const lastDay = new Date(month.date.getFullYear(), month.date.getMonth() + 1, 0)
  const periodRange = `1 - ${lastDay.getDate()} ${monthShort.format(lastDay)} ${lastDay.getFullYear()}`

  const downloadReport = () => {
    const lines = [
      ['Laporan Belajar', monthYear.format(month.date)],
      ['Total Belajar (jam)', month.hours],
      ['Total Hari Aktif', month.activeDays],
      ['Kelas Diikuti', REPORT.courseCount],
      ['Rata-rata Kehadiran (%)', ATTENDANCE_RATE],
      ['Materi Selesai', `${REPORT.modulesDone}/${REPORT.modulesTotal}`],
      ['Tugas Dikumpulkan', `${REPORT.tasksSubmitted}/${REPORT.tasksTotal}`],
      ['Rata-rata Nilai', REPORT.averageScore === null ? '-' : numberFormat.format(REPORT.averageScore)],
      ['XP Didapatkan', REPORT.xp],
      [],
      ['Mata Pelajaran', 'Progres Materi (%)', 'Tugas', 'Rata-rata Nilai', 'Total Belajar'],
      ...REPORT.subjectRows.map((row) => [
        row.subject,
        row.progress ?? '-',
        row.totalTasks ? `${row.submitted}/${row.totalTasks}` : '-',
        row.average === null ? '-' : numberFormat.format(row.average),
        row.minutes === null ? '-' : formatMinutes(row.minutes),
      ]),
    ]
    const csv = lines.map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\n')
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `laporan-${month.date.getFullYear()}-${String(month.date.getMonth() + 1).padStart(2, '0')}.csv`
    link.click()
    URL.revokeObjectURL(url)
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

        {tab === 'ringkasan' && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard Icon={Clock} iconClass="bg-orange-50 text-orange-500" label="Total Belajar" value={`${month.hours} jam`} />
            <StatCard
              Icon={BookOpen}
              iconClass="bg-blue-50 text-blue-600"
              label="Materi Selesai"
              value={`${REPORT.modulesDone}/${REPORT.modulesTotal}`}
              progress={REPORT.modulesDone / REPORT.modulesTotal}
              barClass="bg-blue-700"
            />
            <StatCard
              Icon={Target}
              iconClass="bg-indigo-50 text-indigo-600"
              label="Tugas Dikumpulkan"
              value={`${REPORT.tasksSubmitted}/${REPORT.tasksTotal}`}
              progress={REPORT.tasksSubmitted / REPORT.tasksTotal}
              barClass="bg-purple-600"
            />
            <StatCard
              Icon={BadgeCheck}
              iconClass="bg-emerald-50 text-emerald-600"
              label="Rata-rata Nilai"
              value={REPORT.averageScore === null ? '—' : numberFormat.format(REPORT.averageScore)}
            />
            <StatCard Icon={Star} iconClass="bg-red-100 text-red-600 [&>svg]:fill-current" label="XP Didapatkan" value={`+${REPORT.xp.toLocaleString('id-ID')} XP`} />
          </div>
        )}

        {(tab === 'ringkasan' || tab === 'akademik') && (
          <>
            <StudyChart months={REPORT.months} />
            <SubjectTable />
          </>
        )}
        {tab === 'tugas' && <TaskTable />}
        {tab === 'bimbingan' && <SessionTable />}
      </div>

      <aside className="space-y-4">
        <label className="relative flex items-center gap-3 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 focus-within:border-blue-500">
          <CalendarDays className="h-7 w-7 text-slate-800" strokeWidth={1.5} aria-hidden />
          <span className="flex-1">
            <span className="block text-sm text-slate-500">Periode</span>
            <span className="text-slate-900">{monthYear.format(month.date)}</span>
          </span>
          <ChevronDown className="h-5 w-5 text-slate-700" aria-hidden />
          <select
            value={monthIndex}
            onChange={(event) => setMonthIndex(Number(event.target.value))}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Pilih periode laporan"
          >
            {REPORT.months.map((item, index) => (
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
              ['Total Hari Aktif', `${month.activeDays} hari`],
              ['Kelas Diikuti', `${REPORT.courseCount} kelas`],
              ['Rata-rata Kehadiran', `${ATTENDANCE_RATE}%`],
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
            {ACHIEVEMENTS.map(({ Icon, className, title, date }) => (
              <li key={title} className="flex items-center gap-4">
                <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full ${className}`}>
                  <Icon className="h-8 w-8" strokeWidth={1.75} aria-hidden />
                </span>
                <div>
                  <p className="font-semibold text-slate-900">{title}</p>
                  <p className="text-xs text-slate-500">{formatDate(date)}</p>
                </div>
              </li>
            ))}
          </ul>
          {/* Halaman semua pencapaian belum ada. */}
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

/** Grafik garis jam belajar per bulan, dengan tooltip saat titik disorot. */
function StudyChart({ months }: { months: MonthStat[] }) {
  const [range, setRange] = useState(6)
  const [hover, setHover] = useState<number | null>(null)
  const data = months.slice(-range)

  const W = 860
  const H = 230
  const left = 44
  const right = 24
  const top = 28
  const bottom = 28
  const max = Math.max(60, Math.ceil((Math.max(...data.map((item) => item.hours)) * 1.2) / 10) * 10)
  const ticks = Array.from({ length: max / 10 + 1 }, (_, index) => index * 10)
  const step = (W - left - right) / data.length
  const x = (index: number) => left + step * (index + 0.5)
  const y = (value: number) => top + (H - top - bottom) * (1 - value / max)
  const line = data.map((item, index) => `${index ? 'L' : 'M'}${x(index)} ${y(item.hours)}`).join('')
  const area = `${line}L${x(data.length - 1)} ${y(0)}L${x(0)} ${y(0)}Z`
  const hovered = hover === null ? null : data[hover]

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-slate-900">Grafik Perkembangan Belajar</h2>
        <select
          value={range}
          onChange={(event) => setRange(Number(event.target.value))}
          className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
          aria-label="Rentang grafik"
        >
          <option value={3}>3 Bulan Terakhir</option>
          <option value={6}>6 Bulan Terakhir</option>
          <option value={12}>12 Bulan Terakhir</option>
        </select>
      </div>

      <div className="relative mt-2" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Grafik jam belajar per bulan">
          <defs>
            <linearGradient id="study-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563EB" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#2563EB" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <text x={left - 34} y={12} className="fill-slate-600 text-[10px]">
            Jam Belajar
          </text>
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={left} x2={W - right} y1={y(tick)} y2={y(tick)} className={tick === 0 ? 'stroke-slate-300' : 'stroke-slate-100'} />
              <text x={left - 12} y={y(tick) + 3} textAnchor="end" className="fill-slate-500 text-[10px]">
                {tick}
              </text>
            </g>
          ))}
          <path d={area} fill="url(#study-area)" />
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={top} y2={y(0)} className="stroke-slate-300" strokeDasharray="4 4" />}
          <path d={line} fill="none" className="stroke-blue-600" strokeWidth={2} strokeLinejoin="round" />
          {data.map((item, index) => (
            <g key={item.date.toISOString()}>
              <circle cx={x(index)} cy={y(item.hours)} r={hover === index ? 5 : 3.5} className="fill-blue-600 stroke-white" strokeWidth={1.5} />
              <text x={x(index)} y={y(item.hours) - 10} textAnchor="middle" className="fill-slate-700 text-[10px] font-semibold">
                {item.hours}
              </text>
              <text x={x(index)} y={H - 6} textAnchor="middle" className="fill-slate-500 text-[10px]">
                {monthShort.format(item.date)}
              </text>
              <rect
                x={x(index) - step / 2}
                y={top}
                width={step}
                height={H - top - bottom}
                fill="transparent"
                onMouseEnter={() => setHover(index)}
              />
            </g>
          ))}
        </svg>

        {hovered && hover !== null && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg"
            style={{ left: `${(x(hover) / W) * 100}%`, top: `${((y(hovered.hours) - 18) / H) * 100}%` }}
          >
            <p className="font-semibold">{monthYear.format(hovered.date)}</p>
            <p>{hovered.hours} jam belajar</p>
          </div>
        )}

        <table className="sr-only">
          <caption>Jam belajar per bulan</caption>
          <tbody>
            {data.map((item) => (
              <tr key={item.date.toISOString()}>
                <th scope="row">{monthYear.format(item.date)}</th>
                <td>{item.hours} jam</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function SubjectTable() {
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
            {REPORT.subjectRows.map((row) => (
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
                  {row.progress === null ? (
                    '—'
                  ) : (
                    <span className="flex items-center gap-1">
                      <span className="w-8">{row.progress}%</span>
                      <span className="h-1 w-36 overflow-hidden bg-slate-300">
                        <span className="block h-full bg-blue-700" style={{ width: `${row.progress}%` }} />
                      </span>
                    </span>
                  )}
                </td>
                <td className="px-4 py-1.5 text-center">{row.totalTasks ? `${row.submitted} / ${row.totalTasks}` : '—'}</td>
                <td className="px-4 py-1.5 text-center text-base font-semibold text-emerald-600">
                  {row.average === null ? <span className="text-slate-400">—</span> : numberFormat.format(row.average)}
                </td>
                <td className="px-4 py-1.5 text-center font-semibold">{row.minutes === null ? '—' : formatMinutes(row.minutes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function TaskTable() {
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
            {TASKS.map((task) => (
              <tr key={task.id}>
                <td className="px-4 py-2.5 font-semibold">{task.title}</td>
                <td className="px-4 py-2.5">{task.subject}</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-lg px-3 py-1 text-xs ${TASK_STATUS[task.status].badge}`}>{TASK_STATUS[task.status].label}</span>
                </td>
                <td className="px-4 py-2.5 text-center font-semibold text-emerald-600">
                  {task.score === undefined ? <span className="text-slate-400">—</span> : numberFormat.format(task.score)}
                </td>
                <td className="px-4 py-2.5 text-center">{task.status === 'belum' ? '—' : `+${task.xp}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function SessionTable() {
  const sessions = SCHEDULE.filter((item) => item.type === 'bimbingan')
  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white px-4 py-4">
      <h2 className="font-semibold text-slate-900">Laporan Bimbingan</h2>
      <p className="mt-1 text-sm text-slate-500">
        Rata-rata kehadiran {ATTENDANCE_RATE}%. Kehadiran tercatat saat menekan "Gabung sesi".
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
                <td className="px-4 py-2.5 font-semibold">{session.title}</td>
                <td className="px-4 py-2.5">{session.subtitle}</td>
                <td className="px-4 py-2.5">{formatDate(session.start)}</td>
                <td className="px-4 py-2.5">
                  {timeFormat.format(new Date(session.start))}
                  {session.end && ` - ${timeFormat.format(new Date(session.end))}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
