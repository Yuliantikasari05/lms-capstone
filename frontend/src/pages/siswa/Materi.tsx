import { ArrowLeft, ChevronRight, Search, Star } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { COURSES, formatRating, isEnrolled, type Course } from './materiData'

type Filter = 'all' | 'running' | 'done' | 'newest' | 'lembaga'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Semua Kursus' },
  { key: 'running', label: 'Sedang Berjalan' },
  { key: 'done', label: 'Selesai' },
  { key: 'newest', label: 'Terbaru' },
  { key: 'lembaga', label: 'Lembaga Bimbingan' },
]

const isRunning = (course: Course) => course.progress !== null && course.progress > 0 && course.progress < 100

function applyFilter(courses: Course[], filter: Filter): Course[] {
  switch (filter) {
    case 'running':
      return courses.filter(isRunning)
    case 'done':
      return courses.filter((course) => course.progress === 100)
    case 'newest':
      return [...courses].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    case 'lembaga':
      return courses.filter((course) => course.source === 'lembaga')
    default:
      return courses
  }
}

function filterClass(key: Filter, active: boolean): string {
  if (key === 'lembaga') return `bg-red-600 text-white hover:bg-red-700 ${active ? 'font-semibold ring-2 ring-red-300 ring-offset-2' : ''}`
  if (active) return 'bg-blue-600 font-semibold text-white shadow-sm'
  return 'border border-slate-200 bg-white text-slate-900 hover:border-slate-300'
}

export default function SiswaMateri() {
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')

  const keyword = query.trim().toLowerCase()
  const courses = applyFilter(COURSES, filter).filter((course) => course.title.toLowerCase().includes(keyword))

  const enrolled = COURSES.filter(isEnrolled)
  const stats = [
    { label: 'Total Materi', value: enrolled.length, className: 'bg-blue-100 text-blue-700' },
    { label: 'Selesai', value: enrolled.filter((course) => course.progress === 100).length, className: 'bg-emerald-50 text-emerald-600' },
    { label: 'Sedang Berjalan', value: enrolled.filter(isRunning).length, className: 'bg-amber-100 text-amber-600' },
  ]

  return (
    <>
      <Link to="/siswa" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Kembali ke Dashboard
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-4xl font-bold text-slate-900">Eksplor Materi</h1>
        <label className="relative w-full max-w-md">
          <span className="sr-only">Cari kursus</span>
          <Search className="pointer-events-none absolute left-10 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari kursus..."
            className="w-full rounded-xl border-2 border-slate-200 bg-white py-4 pl-24 pr-4 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
          />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3" role="group" aria-label="Filter kursus">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
            className={`rounded-2xl px-8 py-3 transition-colors ${filterClass(key, filter === key)}`}
          >
            {label}
          </button>
        ))}
      </div>

      {courses.length === 0 ? (
        <p className="mt-12 rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center text-slate-500">
          Tidak ada kursus yang cocok.
        </p>
      ) : (
        <div className="mt-12 grid gap-10 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) =>
            course.source === 'lembaga' ? <LembagaCourseCard key={course.id} course={course} /> : <CourseCard key={course.id} course={course} />,
          )}
        </div>
      )}

      <div className="mx-auto mt-24 grid max-w-5xl gap-8 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className={`rounded-lg py-4 text-center ${stat.className}`}>
            <p className="text-4xl font-bold">{stat.value}</p>
            <p className="mt-1 font-semibold">{stat.label}</p>
          </div>
        ))}
      </div>
    </>
  )
}

/** Kartu kursus reguler (dari Admin/Mentor): kotak putih, gambar biru. */
function CourseCard({ course }: { course: Course }) {
  return (
    <Link
      to={`/siswa/materials/${course.id}`}
      className="flex flex-col rounded-2xl border-2 border-slate-200 bg-white p-8 transition-colors hover:border-slate-300"
    >
      <div className="relative h-52 bg-gradient-to-br from-blue-600 to-indigo-500">
        <span className="absolute left-2.5 top-3 rounded-lg bg-white/25 px-6 py-2 text-white">{course.modules.length} Materi</span>
        <span className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/30 text-white">
          <ChevronRight className="h-5 w-5" aria-hidden />
        </span>
      </div>

      <div className="mt-5 flex items-end justify-between gap-3 border-b border-slate-200 px-0.5 pb-1.5">
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-blue-600">{course.title}</p>
          <p className="text-xs text-slate-500">{course.description}</p>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-amber-500">
          <Star className="h-4 w-4 fill-current" aria-hidden />
          {formatRating(course.rating)}
        </span>
      </div>

      {course.progress !== null && (
        <div className="border-b border-slate-200 pb-2.5 pt-3">
          <div className="flex items-center justify-between text-sm font-semibold text-blue-600">
            <span>Progres</span>
            <span>{course.progress}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden bg-slate-300">
            <div className="h-full bg-blue-700" style={{ width: `${course.progress}%` }} />
          </div>
        </div>
      )}

      <div className="mt-5 flex items-center gap-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-xl text-slate-800" aria-hidden>
          {course.owner.charAt(0)}
        </span>
        <span className="text-xs text-slate-500">{course.owner}</span>
      </div>
    </Link>
  )
}

/** Kartu program Lembaga Bimbingan: kotak merah dengan tulisan putih. */
function LembagaCourseCard({ course }: { course: Course }) {
  return (
    <Link
      to={`/siswa/materials/${course.id}`}
      className="relative flex flex-col overflow-hidden rounded-2xl bg-red-600 p-8 text-white transition-colors hover:bg-red-700"
    >
      <span className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/40 blur-2xl" aria-hidden />

      <div className="relative h-52 bg-white">
        <div className="absolute left-2.5 top-3 flex flex-wrap gap-2">
          <span className="rounded-xl bg-red-600 px-6 py-2">{course.modules.length} Materi</span>
          <span className="rounded-xl bg-red-600 px-6 py-2">Lembaga Bimbingan</span>
        </div>
      </div>

      <div className="mt-5 flex items-end justify-between gap-3 border-b-2 border-white pb-1.5">
        <div className="min-w-0">
          <p className="truncate text-lg font-bold">{course.title}</p>
          <p className="text-xs">{course.description}</p>
        </div>
        <span className="flex shrink-0 items-center gap-1 font-bold text-yellow-400">
          <Star className="h-4 w-4 fill-current" aria-hidden />
          {formatRating(course.rating)}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-xl text-slate-900" aria-hidden>
          {course.owner.charAt(0)}
        </span>
        <span className="text-xs">{course.owner}</span>
      </div>

      <span className="mt-4 self-end rounded-xl bg-white px-8 py-3 text-blue-600">Preview</span>
    </Link>
  )
}
