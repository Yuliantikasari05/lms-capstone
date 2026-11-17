import {
  Download,
  Filter,
  RotateCcw,
  Search,
  Users,
  UserRoundCheck,
  UserRoundX,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Eye,
} from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { MENTOR_COURSES } from './courseData'
import { LEARNER_PREVIEW, type Audience, type LearnerStatus, type LearnerPreview } from './learnerData'

type AudienceFilter = 'Semua user' | Audience

const PAGE_SIZE = 6

const STATUS_STYLES: Record<LearnerStatus, string> = {
  Aktif: 'bg-green-50 text-green-700',
  'Kurang aktif': 'bg-amber-50 text-amber-700',
  'Tidak aktif': 'bg-rose-50 text-rose-600',
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
}

function exportCsv(rows: LearnerPreview[]) {
  const courseById = new Map(MENTOR_COURSES.map((course) => [course.id, course.title]))
  const values = [
    ['Nama', 'Kategori', 'Kelas yang diikuti', 'Status'],
    ...rows.map((learner) => [
      learner.name,
      learner.audience,
      courseById.get(learner.courseId) ?? '',
      learner.status,
    ]),
  ]
  const csv = values.map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'daftar-pengguna-mentor.csv'
  link.click()
  URL.revokeObjectURL(url)
}

export default function MentorUser() {
  const navigate = useNavigate()
  const [audience, setAudience] = useState<AudienceFilter>('Semua user')
  const [search, setSearch] = useState('')
  const [courseId, setCourseId] = useState('all')
  const [status, setStatus] = useState<'all' | LearnerStatus>('all')
  const [page, setPage] = useState(1)

  const learners = useMemo(() => LEARNER_PREVIEW.filter((learner) => {
    const course = MENTOR_COURSES.find((item) => item.id === learner.courseId)
    const matchesSearch = `${learner.name} ${course?.title ?? ''}`.toLowerCase().includes(search.trim().toLowerCase())
    return matchesSearch
      && (audience === 'Semua user' || learner.audience === audience)
      && (courseId === 'all' || learner.courseId === Number(courseId))
      && (status === 'all' || learner.status === status)
  }), [audience, courseId, search, status])

  const totalPages = Math.max(1, Math.ceil(learners.length / PAGE_SIZE))
  const visibleLearners = learners.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const studentCount = LEARNER_PREVIEW.filter((learner) => learner.audience === 'Siswa').length
  const employeeCount = LEARNER_PREVIEW.filter((learner) => learner.audience === 'Karyawan').length

  const resetFilters = () => {
    setAudience('Semua user')
    setSearch('')
    setCourseId('all')
    setStatus('all')
    setPage(1)
  }

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPage(1)
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold text-slate-900">Manajemen user</h1>
        <p className="mt-1 text-sm text-slate-500">Pantau peserta dari kelas, pelatihan, dan webinar yang Anda ampu.</p>
      </header>

      <section aria-label="Ringkasan peserta" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={BookOpen} label="Kelas tersedia" value={MENTOR_COURSES.length} tone="blue" detail="Kursus dalam pratinjau" />
        <SummaryCard icon={Users} label="Jumlah peserta" value={LEARNER_PREVIEW.length} tone="green" detail="Siswa dan karyawan" />
        <SummaryCard icon={UserRoundCheck} label="Siswa" value={studentCount} tone="yellow" detail="Peserta kelas siswa" />
        <SummaryCard icon={UserRoundX} label="Karyawan" value={employeeCount} tone="orange" detail="Peserta pelatihan/webinar" />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="mr-1 h-4 w-4 text-slate-400" aria-hidden />
            {(['Semua user', 'Siswa', 'Karyawan'] as const).map((item) => (
              <button
                type="button"
                key={item}
                onClick={() => { setAudience(item); setPage(1) }}
                aria-pressed={audience === item}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                  audience === item ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <form onSubmit={submitSearch} role="search" className="relative min-w-0 flex-1 sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
              <input
                type="search"
                value={search}
                onChange={(event) => { setSearch(event.target.value); setPage(1) }}
                placeholder="Cari nama atau kelas"
                aria-label="Cari nama atau kelas"
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-xs outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </form>
            <button
              type="button"
              onClick={() => exportCsv(learners)}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" aria-hidden />Export
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 p-3">
          <label className="sr-only" htmlFor="learner-course-filter">Filter kelas</label>
          <select
            id="learner-course-filter"
            value={courseId}
            onChange={(event) => { setCourseId(event.target.value); setPage(1) }}
            className="min-w-[12rem] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-brand-500"
          >
            <option value="all">Semua kelas</option>
            {MENTOR_COURSES.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
          </select>
          <label className="sr-only" htmlFor="learner-status-filter">Filter status peserta</label>
          <select
            id="learner-status-filter"
            value={status}
            onChange={(event) => { setStatus(event.target.value as 'all' | LearnerStatus); setPage(1) }}
            className="min-w-[12rem] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-brand-500"
          >
            <option value="all">Semua status</option>
            <option value="Aktif">Aktif</option>
            <option value="Kurang aktif">Kurang aktif</option>
            <option value="Tidak aktif">Tidak aktif</option>
          </select>
          <button type="button" onClick={resetFilters} className="ml-auto inline-flex items-center gap-1.5 px-2 py-2 text-xs font-medium text-brand-700 hover:underline">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />Reset filter
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Daftar peserta</h2>
          <p className="text-xs text-slate-500">{learners.length} peserta sesuai filter</p>
        </div>
        {visibleLearners.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <Users className="mx-auto h-8 w-8 text-slate-300" aria-hidden />
            <h3 className="mt-3 text-sm font-semibold text-slate-700">Peserta tidak ditemukan</h3>
            <p className="mt-1 text-xs text-slate-500">Ubah kata pencarian atau reset filter untuk melihat daftar peserta.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[42rem] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                  <tr>
                    <th scope="col" className="px-4 py-3">Nama peserta</th>
                    <th scope="col" className="px-4 py-3">Kategori</th>
                    <th scope="col" className="px-4 py-3">Kelas yang diikuti</th>
                    <th scope="col" className="px-4 py-3">Status peserta</th>
                    <th scope="col" className="px-4 py-3 text-center">Lihat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleLearners.map((learner) => {
                    const course = MENTOR_COURSES.find((item) => item.id === learner.courseId)
                    return (
                      <tr key={learner.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-indigo-200 text-xs font-semibold text-blue-800" aria-hidden="true">
                              {initials(learner.name)}
                            </span>
                            <span className="font-medium text-slate-800">{learner.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{learner.audience}</td>
                        <td className="px-4 py-3 text-slate-600">{course?.title ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-md px-3 py-1 text-xs font-medium ${STATUS_STYLES[learner.status]}`}>{learner.status}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            aria-label={`Lihat ringkasan ${learner.name}`}
                            title={`Lihat ringkasan ${learner.name}`}
                            onClick={() => navigate(`/mentor/users/${learner.id}`)}
                            className="rounded-lg p-2 text-slate-500 hover:bg-brand-50 hover:text-brand-700"
                          >
                            <Eye className="h-5 w-5" aria-hidden />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
              <span>
                Menampilkan {learners.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, learners.length)} dari {learners.length} peserta
              </span>
              <div className="flex items-center gap-1">
                <button type="button" aria-label="Halaman sebelumnya" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-40">
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                </button>
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                  <button
                    type="button"
                    key={pageNumber}
                    aria-current={pageNumber === page ? 'page' : undefined}
                    onClick={() => setPage(pageNumber)}
                    className={`min-w-7 rounded px-2 py-1.5 ${pageNumber === page ? 'bg-brand-600 font-semibold text-white' : 'hover:bg-slate-100'}`}
                  >
                    {pageNumber}
                  </button>
                ))}
                <button type="button" aria-label="Halaman berikutnya" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)} className="rounded border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-40">
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      <p className="text-center text-[11px] text-slate-400">Pratinjau statis · data peserta hanya contoh dan belum terhubung ke backend.</p>
    </div>
  )
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
  detail,
}: {
  icon: typeof Users
  label: string
  value: number
  tone: 'blue' | 'green' | 'yellow' | 'orange'
  detail: string
}) {
  const styles = {
    blue: 'bg-blue-50 text-blue-600 border-b-blue-400',
    green: 'bg-green-50 text-green-600 border-b-green-400',
    yellow: 'bg-amber-50 text-amber-600 border-b-amber-400',
    orange: 'bg-orange-50 text-orange-600 border-b-orange-400',
  }

  return (
    <article className={`flex items-center gap-3 rounded-xl border border-slate-200 border-b-4 bg-white p-4 ${styles[tone]}`}>
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${styles[tone].split(' ').slice(0, 2).join(' ')}`}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="mt-0.5 text-xl font-bold text-slate-900">{value}</p>
        <p className="truncate text-[10px] text-slate-400">{detail}</p>
      </div>
    </article>
  )
}
