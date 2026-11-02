import { ArrowLeft, BookOpen, CalendarDays, ChevronLeft, ChevronRight, FileText, Target, Video, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { SCHEDULE, type ScheduleItem, type ScheduleType } from './jadwalData'
import { TASK_STATUS, subjectColor, subjectTextColor, timeFormat } from './shared'

type Filter = 'all' | ScheduleType

const FILTERS: { key: Filter; label: string; Icon: LucideIcon; iconClass: string }[] = [
  { key: 'all', label: 'Semua', Icon: CalendarDays, iconClass: 'text-slate-700' },
  { key: 'bimbingan', label: 'Sesi Bimbingan', Icon: Video, iconClass: 'bg-emerald-100 text-emerald-600' },
  { key: 'materi', label: 'Materi', Icon: BookOpen, iconClass: 'bg-blue-50 text-blue-600' },
  { key: 'tugas', label: 'Tugas', Icon: Target, iconClass: 'bg-indigo-50 text-indigo-600' },
]

/** Ikon, warna kotak ikon, warna label, dan warna titik kalender per jenis jadwal. */
const TYPE_STYLE: Record<ScheduleType, { Icon: LucideIcon; dot: string; legend: string }> = {
  bimbingan: { Icon: Video, dot: 'bg-emerald-600', legend: 'Bimbingan' },
  tugas: { Icon: FileText, dot: 'bg-indigo-400', legend: 'Tugas' },
  materi: { Icon: BookOpen, dot: 'bg-blue-700', legend: 'Materi' },
}

function itemColors(item: ScheduleItem): { box: string; label: string } {
  if (item.type === 'bimbingan') return { box: 'bg-emerald-200 text-emerald-600', label: 'text-emerald-600' }
  if (item.type === 'materi') return { box: 'bg-blue-50 text-blue-600', label: 'text-blue-600' }
  return { box: subjectColor(item.subject), label: subjectTextColor(item.subject) }
}

const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
const fullDateFormat = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const weekdayFormat = new Intl.DateTimeFormat('id-ID', { weekday: 'long' })
const dayMonthFormat = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' })
const monthFormat = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' })

export default function SiswaJadwal() {
  const [filter, setFilter] = useState<Filter>('all')

  const today = new Date()
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
  const items = SCHEDULE.filter((item) => filter === 'all' || item.type === filter).sort((a, b) => a.start.localeCompare(b.start))
  const todayItems = items.filter((item) => dayKey(new Date(item.start)) === dayKey(today))
  const upcomingItems = items.filter((item) => new Date(item.start) >= tomorrow)

  return (
    <>
      <Link to="/siswa" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Kembali ke Dashboard
      </Link>
      <h1 className="mt-4 text-5xl font-bold text-slate-900">Jadwal</h1>
      <p className="mt-2 text-slate-800">Kelola jadwal belajar dan jangan lewatkan kelasmu</p>

      <div className="mt-10 grid gap-12 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-x-6 gap-y-3" role="group" aria-label="Filter jadwal">
            {FILTERS.map(({ key, label, Icon, iconClass }) => {
              const active = filter === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  aria-pressed={active}
                  className={`flex items-center gap-3 rounded-2xl px-6 py-3 text-lg transition-colors ${
                    active ? 'bg-blue-600 font-semibold text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-900 hover:border-slate-300'
                  }`}
                >
                  <span className={`flex h-7 w-7 items-center justify-center rounded-md ${active ? 'text-white' : iconClass}`}>
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  {label}
                </button>
              )
            })}
          </div>

          <h2 className="mt-6 flex flex-wrap gap-x-6 text-lg">
            <span className="font-semibold text-slate-900">Jadwal Hari Ini</span>
            <span className="text-blue-600">{fullDateFormat.format(today)}</span>
          </h2>
          <ScheduleList items={todayItems} upcoming={false} />

          <h2 className="mt-8 text-lg font-semibold text-slate-900">Jadwal Mendatang</h2>
          <ScheduleList items={upcomingItems} upcoming />
        </div>

        <Calendar today={today} />
      </div>
    </>
  )
}

function ScheduleList({ items, upcoming }: { items: ScheduleItem[]; upcoming: boolean }) {
  if (items.length === 0) {
    return <p className="mt-4 rounded-2xl border-2 border-slate-200 bg-white px-6 py-10 text-center text-slate-500">Tidak ada jadwal.</p>
  }

  return (
    <ul className="mt-4 divide-y divide-slate-200 rounded-2xl border-2 border-slate-200 bg-white px-6">
      {items.map((item) => (
        <ScheduleRow key={item.id} item={item} upcoming={upcoming} />
      ))}
    </ul>
  )
}

function ScheduleRow({ item, upcoming }: { item: ScheduleItem; upcoming: boolean }) {
  const { Icon } = TYPE_STYLE[item.type]
  const colors = itemColors(item)
  const start = new Date(item.start)
  const status = item.status ? TASK_STATUS[item.status] : null

  return (
    <li
      className={`grid items-center gap-x-6 gap-y-3 py-4 ${
        upcoming ? 'grid-cols-[4.5rem_4rem_3rem_1fr] md:grid-cols-[4.5rem_4rem_3rem_1fr_10rem_7.5rem]' : 'grid-cols-[4rem_3rem_1fr] md:grid-cols-[4rem_3rem_1fr_10rem_7.5rem]'
      }`}
    >
      {upcoming ? (
        <>
          <div className="space-y-3 text-center text-lg font-semibold text-slate-900">
            <p>{weekdayFormat.format(start)}</p>
            <p>{dayMonthFormat.format(start)}</p>
          </div>
          <p className="text-center text-lg leading-tight text-slate-600">
            {timeFormat.format(start)}
            {item.end && (
              <>
                <br />-<br />
                {timeFormat.format(new Date(item.end))}
              </>
            )}
          </p>
        </>
      ) : (
        <p className="text-center text-lg text-slate-600">{timeFormat.format(start)}</p>
      )}

      <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${colors.box}`}>
        <Icon className="h-6 w-6" strokeWidth={1.5} aria-hidden />
      </span>

      <div className="min-w-0">
        <p className={`text-xs ${colors.label}`}>{item.label}</p>
        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
        <p className="text-xs text-slate-600">{item.subtitle}</p>
      </div>

      {status || item.live ? (
        <div className="col-start-[-2] justify-self-start md:col-start-auto md:justify-self-center">
          {status && <span className={`rounded-lg px-3 py-1.5 ${status.badge}`}>{status.label}</span>}
          {item.live && <span className="rounded-lg bg-emerald-200 px-9 py-1.5 text-lg text-emerald-600">LIVE</span>}
        </div>
      ) : (
        // Materi tidak punya badge; sel kosong menjaga posisi kolom di layar lebar.
        <div className="hidden md:block" />
      )}

      {/* Tombol belum terhubung ke halaman detail. */}
      <button
        type="button"
        className="col-start-[-2] flex w-28 items-center justify-between justify-self-start rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 hover:border-slate-400 md:col-start-auto md:justify-self-end"
      >
        Lihat Detail
        <ChevronRight className="h-3 w-3" aria-hidden />
      </button>
    </li>
  )
}

/** Kalender bulanan (Senin di kolom pertama) dengan titik warna untuk hari yang punya jadwal. */
function Calendar({ today }: { today: Date }) {
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))

  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const leading = (month.getDay() + 6) % 7
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const cellCount = Math.ceil((leading + daysInMonth) / 7) * 7
  const cells = Array.from({ length: cellCount }, (_, index) => new Date(year, monthIndex, index - leading + 1))

  const typesByDay = new Map<string, Set<ScheduleType>>()
  for (const item of SCHEDULE) {
    const key = dayKey(new Date(item.start))
    typesByDay.set(key, (typesByDay.get(key) ?? new Set()).add(item.type))
  }

  return (
    <section className="h-fit rounded-2xl border-2 border-slate-200 bg-white px-4 pb-6 pt-5">
      <h2 className="flex items-center gap-3 text-xl text-slate-900">
        <CalendarDays className="h-8 w-8" strokeWidth={1.5} aria-hidden />
        Kalender
      </h2>

      <div className="mt-4 flex items-center justify-between px-2">
        <button type="button" onClick={() => setMonth(new Date(year, monthIndex - 1, 1))} className="rounded p-1 hover:bg-slate-100" aria-label="Bulan sebelumnya">
          <ChevronLeft className="h-5 w-5" strokeWidth={2.5} aria-hidden />
        </button>
        <p className="text-slate-900">{monthFormat.format(month)}</p>
        <button type="button" onClick={() => setMonth(new Date(year, monthIndex + 1, 1))} className="rounded p-1 hover:bg-slate-100" aria-label="Bulan berikutnya">
          <ChevronRight className="h-5 w-5" strokeWidth={2.5} aria-hidden />
        </button>
      </div>

      <div className="mt-5 grid grid-cols-7 gap-y-1 text-center">
        {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((day) => (
          <span key={day} className="pb-3 text-slate-900">
            {day}
          </span>
        ))}
        {cells.map((date) => {
          const inMonth = date.getMonth() === monthIndex
          const isToday = dayKey(date) === dayKey(today)
          const types = typesByDay.get(dayKey(date))
          return (
            <div key={date.toISOString()} className="flex flex-col items-center">
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-full ${
                  isToday ? 'bg-blue-600 text-white' : inMonth ? 'text-slate-900' : 'text-slate-300'
                }`}
                aria-current={isToday ? 'date' : undefined}
              >
                {date.getDate()}
              </span>
              <span className="-mt-1 flex h-2 gap-1">
                {types && [...types].map((type) => <span key={type} className={`h-2 w-2 rounded-full ${TYPE_STYLE[type].dot}`} />)}
              </span>
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex flex-wrap justify-between gap-3 border-t border-slate-200 px-2 pt-5 text-xs text-slate-900">
        {(['bimbingan', 'tugas', 'materi'] as const).map((type) => (
          <span key={type} className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${TYPE_STYLE[type].dot}`} aria-hidden />
            {TYPE_STYLE[type].legend}
          </span>
        ))}
      </div>
    </section>
  )
}
