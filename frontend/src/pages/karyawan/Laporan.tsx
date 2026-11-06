import { ArrowLeft, BadgeCheck, CalendarDays, ChevronDown, Clock, FileText, MonitorPlay, Presentation, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { StudyChart, type StudyMonth } from '../../components/StudyChart'
import { downloadCsv } from '../../lib/downloadCsv'
import { TRAININGS } from './pelatihanData'
import { WEBINARS } from './webinarData'

/*
 * DATA CONTOH (statis) yang belum ada di halaman lain: jam belajar 11 bulan sebelum bulan ini.
 * Angka lain dihitung dari data Pelatihan (pelatihanData) dan Webinar (webinarData).
 */
const PAST_MONTH_HOURS = [4, 6, 5, 8, 7, 9, 10, 12, 11, 14, 15]

const numberFormat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 })
const monthShort = new Intl.DateTimeFormat('id-ID', { month: 'short' })
const monthYear = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' })

/** Warna ikon baris tabel, berurutan. */
const ROW_COLORS = ['bg-indigo-100 text-blue-700', 'bg-emerald-100 text-emerald-600', 'bg-red-100 text-red-500', 'bg-amber-100 text-amber-600']

function formatMinutes(minutes: number): string {
  const rest = minutes % 60
  return `${Math.floor(minutes / 60)} Jam${rest ? ` ${rest} Menit` : ''}`
}

/** Semua angka laporan, dihitung dari pelatihan dan webinar yang sudah dibayar. */
function buildReport() {
  const trainings = TRAININGS.filter((training) => training.purchased)
  const scores = trainings.flatMap((training) => (training.averageScore === undefined ? [] : [training.averageScore]))
  const studyMinutes = trainings.reduce((sum, training) => sum + training.studyMinutes, 0)
  const today = new Date()
  const hours = [...PAST_MONTH_HOURS, Math.round(studyMinutes / 60)]
  const months: StudyMonth[] = hours.map((value, index) => ({
    date: new Date(today.getFullYear(), today.getMonth() - (hours.length - 1 - index), 1),
    hours: value,
  }))

  return {
    trainings,
    trainingsDone: trainings.filter((training) => training.progress === 100).length,
    trainingsActive: trainings.filter((training) => training.progress < 100).length,
    webinarsJoined: WEBINARS.filter((webinar) => webinar.purchased).length,
    webinarsTotal: WEBINARS.length,
    averageScore: scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null,
    months,
  }
}

const REPORT = buildReport()
const averageLabel = REPORT.averageScore === null ? '—' : numberFormat.format(REPORT.averageScore)

export default function KaryawanLaporan() {
  const [monthIndex, setMonthIndex] = useState(REPORT.months.length - 1)
  const month = REPORT.months[monthIndex]
  const lastDay = new Date(month.date.getFullYear(), month.date.getMonth() + 1, 0)
  const periodRange = `1 - ${lastDay.getDate()} ${monthShort.format(lastDay)} ${lastDay.getFullYear()}`

  const downloadReport = () => {
    downloadCsv(
      [
        ['Laporan Aktivitas', monthYear.format(month.date)],
        ['Total Belajar (jam)', month.hours],
        ['Pelatihan Selesai', `${REPORT.trainingsDone}/${REPORT.trainings.length}`],
        ['Total Pelatihan Aktif', REPORT.trainingsActive],
        ['Webinar Diikuti', `${REPORT.webinarsJoined}/${REPORT.webinarsTotal}`],
        ['Rata-rata Nilai', averageLabel],
        [],
        ['Pelatihan', 'Progres Materi (%)', 'Tugas', 'Rata-rata Nilai', 'Total Belajar'],
        ...REPORT.trainings.map((training) => [
          training.title,
          training.progress,
          `${training.tasksDone}/${training.tasksTotal}`,
          training.averageScore === undefined ? '-' : numberFormat.format(training.averageScore),
          formatMinutes(training.studyMinutes),
        ]),
      ],
      `laporan-aktivitas-${month.date.getFullYear()}-${String(month.date.getMonth() + 1).padStart(2, '0')}.csv`,
    )
  }

  return (
    <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="min-w-0">
        <Link to="/karyawan" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Kembali ke Dashboard
        </Link>
        <h1 className="mt-1 text-5xl font-bold text-slate-900">Laporan Aktivitas</h1>
        <p className="mt-2 text-slate-800">Pantau perkembangan aktivitasmu secara menyeluruh</p>

        <h2 className="mt-9 px-6 text-lg font-semibold text-slate-900">Ringkasan</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard Icon={Clock} iconClass="bg-orange-50 text-orange-500" label="Total Belajar" value={`${month.hours} jam`} />
          <StatCard
            Icon={Presentation}
            iconClass="text-slate-900"
            label="Pelatihan Selesai"
            value={`${REPORT.trainingsDone}/${REPORT.trainings.length}`}
            progress={REPORT.trainings.length ? REPORT.trainingsDone / REPORT.trainings.length : 0}
          />
          <StatCard Icon={MonitorPlay} iconClass="text-slate-900" label="Webinar Diikuti" value={`${REPORT.webinarsJoined}/${REPORT.webinarsTotal}`} />
          <StatCard Icon={BadgeCheck} iconClass="bg-emerald-50 text-emerald-600" label="Rata-rata Nilai" value={averageLabel} />
        </div>

        <StudyChart months={REPORT.months} yMax={30} />
        <TrainingTable />
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
              ['Total Pelatihan Aktif', `${REPORT.trainingsActive} pelatihan`],
              ['Webinar Diikuti', `${REPORT.webinarsJoined} webinar`],
              ['Rata-rata Nilai', averageLabel],
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
}: {
  Icon: LucideIcon
  iconClass: string
  label: string
  value: string
  progress?: number
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 pb-5 pt-4">
      <span className={`flex h-12 w-12 items-center justify-center rounded-lg ${iconClass}`}>
        <Icon className="h-7 w-7" aria-hidden />
      </span>
      <p className="mt-5 whitespace-nowrap text-[13px] text-slate-900">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
      {progress !== undefined && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-blue-700" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
    </div>
  )
}

function TrainingTable() {
  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white px-4 py-4">
      <h2 className="font-semibold text-slate-900">Performa per Modul</h2>
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
            {REPORT.trainings.map((training, index) => (
              <tr key={training.id}>
                <td className="px-2 py-1.5">
                  <span className="flex items-center gap-3 font-semibold">
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded ${ROW_COLORS[index % ROW_COLORS.length]}`}>
                      <FileText className="h-3.5 w-3.5" aria-hidden />
                    </span>
                    {training.title}
                  </span>
                </td>
                <td className="px-4 py-1.5">
                  <span className="flex items-center gap-1">
                    <span className="w-8">{training.progress}%</span>
                    <span className="h-1 w-36 overflow-hidden bg-slate-300">
                      <span className="block h-full bg-blue-700" style={{ width: `${training.progress}%` }} />
                    </span>
                  </span>
                </td>
                <td className="px-4 py-1.5 text-center">{`${training.tasksDone} / ${training.tasksTotal}`}</td>
                <td className="px-4 py-1.5 text-center text-base font-semibold text-emerald-600">
                  {training.averageScore === undefined ? <span className="text-slate-400">—</span> : numberFormat.format(training.averageScore)}
                </td>
                <td className="px-4 py-1.5 text-center font-semibold">{formatMinutes(training.studyMinutes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
