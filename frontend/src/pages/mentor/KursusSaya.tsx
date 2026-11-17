import { BookOpen, ChevronRight, Clock3, Search, SlidersHorizontal, Star, Users, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/States'
import type { CourseType } from '../../features/courses/types'
import { courseAudience, courseDurationMinutes, MENTOR_COURSES, type MentorCoursePreview } from './courseData'

type AudienceFilter = 'all' | 'siswa' | 'karyawan'

const FILTERS: { value: AudienceFilter; label: string }[] = [
  { value: 'all', label: 'Semua kursus' },
  { value: 'siswa', label: 'Kursus siswa' },
  { value: 'karyawan', label: 'Kursus karyawan' },
]

const TYPE_STYLES: Record<CourseType, { label: string; gradient: string; badge: string }> = {
  academic: {
    label: 'Kelas',
    gradient: 'from-blue-600 to-blue-900',
    badge: 'bg-white/60 text-slate-700',
  },
  training: {
    label: 'Pelatihan',
    gradient: 'from-blue-600 to-blue-900',
    badge: 'bg-white/60 text-slate-700',
  },
  webinar: {
    label: 'Webinar',
    gradient: 'from-blue-600 to-blue-900',
    badge: 'bg-white/60 text-slate-700',
  },
  institution: {
    label: 'Program Lembaga',
    gradient: 'from-blue-600 to-blue-900',
    badge: 'bg-white/60 text-slate-700',
  },
}

function MentorAvatar({ name }: { name: string }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 to-rose-300 text-[10px] font-semibold text-slate-700" aria-hidden="true">
      {initials || 'M'}
    </span>
  )
}

function CourseCard({
  course,
  mentorName,
}: {
  course: MentorCoursePreview
  mentorName: string
}) {
  const style = TYPE_STYLES[course.type]
  const durationHours = Math.ceil(courseDurationMinutes(course) / 60)

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white transition-shadow hover:shadow-md">
      <Link
        to={`/mentor/courses/${course.id}`}
        aria-label={`Buka detail kursus ${course.title}`}
        className="group block h-full"
      >
        <div className={`relative mx-4 mt-4 flex h-32 items-start justify-between bg-gradient-to-br ${style.gradient} p-3`}>
          <span className={`rounded-md px-3 py-1 text-[10px] font-medium ${style.badge}`}>{style.label}</span>
          <span className="absolute bottom-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/40 text-white shadow-sm transition group-hover:bg-white/70 group-hover:text-blue-900">
            <ChevronRight className="h-5 w-5" aria-hidden />
          </span>
        </div>

        <div className="p-4">
          <h3 className="line-clamp-2 text-sm font-semibold text-blue-700 group-hover:underline">{course.title}</h3>
          <p className="mt-1.5 min-h-9 line-clamp-2 text-xs leading-5 text-slate-500">{course.description}</p>

          <div className="mt-3 flex items-center justify-between border-y border-slate-100 py-2.5 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" aria-hidden />
              {course.modules.length} modul
            </span>
            <span className="flex items-center gap-1.5">
              <Clock3 className="h-4 w-4" aria-hidden />
              {durationHours} jam
            </span>
            <span className="flex items-center gap-1 text-amber-600">
              <Star className="h-4 w-4 fill-current" aria-hidden />
              {course.rating.toFixed(1)}
            </span>
          </div>

          <div className="flex items-center justify-between pt-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <MentorAvatar name={mentorName} />
              <span className="truncate text-[10px] text-slate-500">{mentorName}</span>
            </div>
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-medium text-indigo-600">
              <Users className="h-3 w-3" aria-hidden />
              {course.students} {courseAudience(course.type)}
            </span>
          </div>
        </div>
      </Link>
    </article>
  )
}

export default function MentorKursusSaya() {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [audience, setAudience] = useState<AudienceFilter>('all')

  const courses = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('id-ID')

    return MENTOR_COURSES.filter((course) => {
      const matchesAudience = audience === 'all' || courseAudience(course.type) === audience
      const matchesQuery =
        !normalizedQuery ||
        course.title.toLocaleLowerCase('id-ID').includes(normalizedQuery) ||
        course.description.toLocaleLowerCase('id-ID').includes(normalizedQuery)

      return matchesAudience && matchesQuery
    })
  }, [audience, query])

  const mentorName = user?.name ?? 'Mentor'

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Jelajahi kursus Anda</h1>
          <p className="mt-1 text-sm text-slate-600">Preview kurikulum untuk kursus yang Anda ampu.</p>
        </div>
        <label className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <span className="sr-only">Cari kursus</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari kursus Anda"
            maxLength={100}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-9 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Hapus pencarian" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
        </label>
      </div>

      <section aria-label="Filter kursus" className="mb-4 flex flex-wrap items-center gap-2">
        <SlidersHorizontal className="mr-1 h-4 w-4 text-slate-400" aria-hidden />
        {FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setAudience(filter.value)}
            aria-pressed={audience === filter.value}
            className={`rounded-full border px-4 py-2 text-xs font-medium transition-colors ${
              audience === filter.value
                ? 'border-brand-500 bg-brand-500 text-white shadow-sm'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            {filter.label}
          </button>
        ))}
        {(query || audience !== 'all') && (
          <Button variant="ghost" className="px-2 py-1.5 text-xs" onClick={() => { setQuery(''); setAudience('all') }}>
            Reset
          </Button>
        )}
      </section>

      <p className="mb-3 text-xs text-slate-500" aria-live="polite">
        Menampilkan {courses.length} dari {MENTOR_COURSES.length} kursus <span className="text-amber-700">· data contoh</span>
      </p>

      {courses.length === 0 ? (
        <EmptyState title="Kursus tidak ditemukan" description="Coba ubah kata pencarian atau filter yang dipilih." />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} mentorName={mentorName} />
          ))}
        </div>
      )}
    </>
  )
}
