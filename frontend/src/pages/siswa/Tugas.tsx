import { ArrowLeft, ChevronRight, Clock, FileText, History, Search, Star, User } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDate } from '../../lib/format'
import { TASK_STATUS, subjectColor, timeFormat, type TaskStatus } from './shared'
import { TASKS, type Task } from './tugasData'

type Filter = 'all' | TaskStatus

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Semua Tugas' },
  { key: 'belum', label: 'Belum Dikerjakan' },
  { key: 'dikumpulkan', label: 'Dikumpulkan' },
  { key: 'selesai', label: 'Selesai' },
]

/** Selisih hari kalender dari hari ini ke tanggal tujuan. */
function daysUntil(iso: string): number {
  const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  return Math.round((startOfDay(new Date(iso)) - startOfDay(new Date())) / 86_400_000)
}

function remainingLabel(iso: string): string {
  const days = daysUntil(iso)
  if (days < 0) return 'Terlambat'
  if (days === 0) return 'Hari Ini'
  return `${days} Hari Lagi`
}

export default function SiswaTugas() {
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')

  const keyword = query.trim().toLowerCase()
  const tasks = TASKS.filter((task) => filter === 'all' || task.status === filter).filter(
    (task) => task.title.toLowerCase().includes(keyword) || task.subject.toLowerCase().includes(keyword),
  )

  return (
    <>
      <Link to="/siswa" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Kembali ke Dashboard
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-4xl font-bold text-slate-900">Tugas</h1>
        <label className="relative w-full max-w-md">
          <span className="sr-only">Cari tugas</span>
          <Search className="pointer-events-none absolute left-10 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari tugas..."
            className="w-full rounded-xl border-2 border-slate-200 bg-white py-4 pl-24 pr-4 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
          />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3" role="group" aria-label="Filter tugas">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
            className={`rounded-2xl px-8 py-3 transition-colors ${
              filter === key
                ? 'bg-blue-600 font-semibold text-white shadow-sm'
                : 'border border-slate-200 bg-white text-slate-900 hover:border-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tasks.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center text-slate-500">
          Tidak ada tugas yang cocok.
        </p>
      ) : (
        <ul className="mt-8 space-y-5">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </ul>
      )}
    </>
  )
}

function TaskCard({ task }: { task: Task }) {
  const status = TASK_STATUS[task.status]
  const color = subjectColor(task.subject)
  const pending = task.status === 'belum'

  return (
    <li className="flex flex-col gap-6 rounded-2xl border border-slate-300 bg-white px-6 py-4 lg:flex-row lg:items-center lg:gap-12 lg:pl-10">
      <span className={`hidden h-24 w-24 shrink-0 items-center justify-center rounded-2xl sm:flex ${color}`}>
        <FileText className="h-12 w-12" strokeWidth={1.25} aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap gap-3">
          <span className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 ${color}`}>
            <FileText className="h-4 w-4" aria-hidden />
            {task.subject}
          </span>
          {task.kind && <span className={`rounded-lg px-7 py-1.5 ${color}`}>{task.kind}</span>}
        </div>
        <h2 className="mt-3 text-2xl font-bold text-slate-900">{task.title}</h2>
        <p className="mt-2 text-sm text-slate-600">{task.description}</p>

        <div className="mt-5 flex flex-wrap items-center gap-x-10 gap-y-3">
          <div className="flex w-44 items-center gap-3">
            <History className="h-6 w-6 shrink-0 text-slate-500" strokeWidth={1.5} aria-hidden />
            <div className="text-sm">
              <p className="text-slate-600">Deadline</p>
              <p className="whitespace-nowrap text-red-600">
                {formatDate(task.deadline)} - {timeFormat.format(new Date(task.deadline))}
              </p>
            </div>
          </div>
          <div className="flex w-52 items-center gap-3">
            <User className="h-6 w-6 shrink-0 text-slate-600" strokeWidth={1.5} aria-hidden />
            <div className="text-sm">
              <p className="text-slate-600">Mentor</p>
              <p className="text-slate-900">{task.mentor}</p>
            </div>
          </div>
          <span className="flex items-center gap-2 text-blue-700">
            <Star className="h-6 w-6 fill-current" aria-hidden />+ {task.xp} XP
          </span>
        </div>
      </div>

      <div className="flex flex-col items-start gap-5 lg:items-end">
        <span className={`w-48 rounded-lg py-1.5 text-center ${status.badge}`}>{status.label}</span>
        <span className={`flex items-center gap-2 whitespace-nowrap ${pending ? 'text-red-600' : 'text-slate-300'}`}>
          <Clock className="h-5 w-5" aria-hidden />
          {pending ? remainingLabel(task.deadline) : `Dikumpulkan ${formatDate(task.submittedAt)}`}
        </span>
        {/* Tombol belum terhubung ke halaman pengerjaan, detail, atau nilai. */}
        <button
          type="button"
          className={`flex w-48 items-center justify-between rounded-lg px-9 py-3 transition-colors ${
            pending ? 'bg-blue-700 text-white hover:bg-blue-800' : 'border border-slate-300 bg-white text-slate-900 hover:border-slate-400'
          }`}
        >
          {status.action}
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </li>
  )
}
