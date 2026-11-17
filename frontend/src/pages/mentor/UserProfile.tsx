import {
  ArrowLeft,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  Search,
  Star,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EmptyState } from '../../components/ui/States'
import type { LearnerCourseProgress, LearnerTaskStatus } from './learnerData'
import { getLearnerProfile, LEARNER_PREVIEW } from './learnerData'

const TASK_BREAKDOWN = [
  { label: 'Tugas selesai', value: 68, color: '#1689ff' },
  { label: 'Tugas sedang dipelajari', value: 18, color: '#f0d900' },
  { label: 'Tugas belum dipelajari', value: 10, color: '#d4d4d4' },
  { label: 'Tugas terlambat', value: 4, color: '#fb8585' },
]

const TASK_STATUS_STYLES: Record<LearnerTaskStatus, string> = {
  Selesai: 'bg-green-50 text-green-700',
  Dikumpulkan: 'bg-indigo-50 text-indigo-700',
  Terlambat: 'bg-rose-50 text-rose-600',
  'Sedang dikerjakan': 'bg-amber-50 text-amber-700',
  'Belum dikerjakan': 'bg-slate-100 text-slate-600',
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
}

export default function MentorUserProfile() {
  const { userId } = useParams<{ userId: string }>()
  const [activeTab, setActiveTab] = useState<'summary' | 'report'>('summary')
  const learner = LEARNER_PREVIEW.find((item) => item.id === Number(userId))

  if (!learner) {
    return (
      <div className="space-y-4">
        <Link to="/mentor/users" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-brand-700">
          <ArrowLeft className="h-4 w-4" aria-hidden />Kembali
        </Link>
        <EmptyState title="Peserta tidak ditemukan" description="Peserta mungkin sudah tidak tersedia pada data pratinjau." />
      </div>
    )
  }

  const profile = getLearnerProfile(learner)
  const profileLabel = learner.audience === 'Siswa' ? 'Profil siswa' : 'Profil karyawan'

  return (
    <div className="space-y-5">
      <Link to="/mentor/users" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" aria-hidden />Kembali
      </Link>

      <h1 className="text-xl font-bold text-slate-900">{profileLabel}</h1>

      <section className="flex flex-col gap-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-indigo-200 text-lg font-bold text-blue-800" aria-hidden="true">
            {initials(learner.name)}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900">{profile.fullName}</h2>
              <span className={`rounded-full px-3 py-1 text-[10px] font-medium ${
                learner.status === 'Aktif' ? 'bg-green-50 text-green-700' : learner.status === 'Kurang aktif' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-600'
              }`}>
                {learner.status}
              </span>
            </div>
            <p className="mt-1 truncate text-sm text-slate-500">{profile.email}</p>
            <p className="mt-1 text-xs text-slate-400">{learner.audience}</p>
          </div>
        </div>
        <div className="flex gap-3 sm:shrink-0">
          <ProfileMetric icon={BookOpen} value={profile.courses.length} label="Kelas diikuti" tone="blue" />
          <ProfileMetric icon={Clock3} value={profile.studyHours} label="Total belajar" tone="purple" />
        </div>
      </section>

      <nav aria-label="Tab profil peserta" className="flex gap-6 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('summary')}
          aria-current={activeTab === 'summary' ? 'page' : undefined}
          className={`border-b-2 px-1 py-3 text-sm font-semibold ${activeTab === 'summary' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Ringkasan
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('report')}
          aria-current={activeTab === 'report' ? 'page' : undefined}
          className={`border-b-2 px-1 py-3 text-sm font-semibold ${activeTab === 'report' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Laporan belajar
        </button>
      </nav>

      {activeTab === 'summary' ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
              <h2 className="text-sm font-semibold text-slate-900">Tentang peserta</h2>
              <dl className="mt-4 space-y-3 text-xs sm:text-sm">
                <ProfileField label="Nama lengkap" value={profile.fullName} />
                <ProfileField label="Email" value={profile.email} />
                <ProfileField label={learner.audience === 'Siswa' ? 'Asal sekolah' : 'Asal instansi'} value={profile.institution} />
                <ProfileField label={learner.audience === 'Siswa' ? 'Kelas/program' : 'Program'} value={profile.program} />
                <ProfileField label="Bio peserta" value={profile.bio} />
              </dl>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
              <h2 className="text-sm font-semibold text-slate-900">Diagram progres belajar</h2>
              <div className="mt-4 flex flex-col items-center justify-center gap-5 sm:flex-row sm:justify-around">
                <ul className="w-full space-y-3 sm:w-auto">
                  {TASK_BREAKDOWN.map((item) => (
                    <li key={item.label} className="flex items-center gap-2 text-xs text-slate-600">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
                      <span>{item.label}</span>
                    </li>
                  ))}
                </ul>
                <div
                  role="img"
                  aria-label="Diagram progres tugas: 68 persen selesai, 18 persen sedang dipelajari, 10 persen belum dipelajari, dan 4 persen terlambat."
                  className="relative h-36 w-36 shrink-0 rounded-full"
                  style={{ background: 'conic-gradient(#1689ff 0% 68%, #f0d900 68% 86%, #d4d4d4 86% 96%, #fb8585 96% 100%)' }}
                >
                  <span className="absolute left-[58%] top-[50%] -translate-y-1/2 text-[10px] font-semibold text-white">68%</span>
                  <span className="absolute left-[22%] top-[25%] text-[10px] font-semibold text-slate-800">18%</span>
                  <span className="absolute left-[19%] top-[66%] text-[10px] font-semibold text-slate-700">10%</span>
                  <span className="absolute left-[45%] top-[91%] -translate-y-full text-[9px] font-semibold text-white">4%</span>
                </div>
              </div>
            </section>
          </div>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <header className="border-b border-slate-100 px-4 py-4">
              <h2 className="text-sm font-semibold text-slate-900">Kursus yang diikuti</h2>
              <p className="mt-1 text-xs text-slate-500">Ringkasan tugas dan progres belajar peserta.</p>
            </header>
            {profile.courses.length === 0 ? (
              <div className="p-4">
                <EmptyState title="Belum mengikuti kelas" description="Kursus yang diikuti peserta akan tampil di sini." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                    <tr>
                      <th scope="col" className="px-4 py-3">Nama kursus</th>
                      <th scope="col" className="px-4 py-3">Tugas</th>
                      <th scope="col" className="px-4 py-3">Progres belajar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {profile.courses.map((course) => (
                      <tr key={course.title}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                              <FileText className="h-4 w-4" aria-hidden />
                            </span>
                            <span className="font-medium text-slate-800">{course.title}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{course.assignmentsDone}/{course.assignmentsTotal} tugas</td>
                        <td className="px-4 py-3">
                          <div className="relative h-5 min-w-36 overflow-hidden rounded-full bg-slate-200">
                            <div className="flex h-full items-center justify-center rounded-full bg-sky-500 text-[10px] font-semibold text-white" style={{ width: `${course.progress}%` }}>
                              {course.progress}%
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : (
        <LearnerReport courses={profile.courses} />
      )}

      <p className="text-center text-[11px] text-slate-400">Pratinjau statis · data profil, nilai, dan kehadiran hanya contoh.</p>
    </div>
  )
}

function LearnerReport({ courses }: { courses: LearnerCourseProgress[] }) {
  const [query, setQuery] = useState('')
  const [expandedCourses, setExpandedCourses] = useState<string[]>(() => courses[0] ? [courses[0].title] : [])
  const filteredCourses = courses.filter((course) => course.title.toLowerCase().includes(query.trim().toLowerCase()))
  const gradedTasks = courses.flatMap((course) => course.tasks.filter((task) => task.score !== null))
  const attendancePresent = courses.reduce((sum, course) => sum + course.attendancePresent, 0)
  const attendanceTotal = courses.reduce((sum, course) => sum + course.attendanceTotal, 0)
  const averageScore = gradedTasks.length
    ? Math.round(gradedTasks.reduce((sum, task) => sum + (task.score ?? 0), 0) / gradedTasks.length)
    : null
  const submittedTasks = courses.reduce(
    (sum, course) => sum + course.tasks.filter((task) => task.submittedAt !== null).length,
    0,
  )
  const totalTasks = courses.reduce((sum, course) => sum + course.tasks.length, 0)
  const attendanceRate = attendanceTotal ? Math.round((attendancePresent / attendanceTotal) * 100) : 0

  const toggleCourse = (title: string) => {
    setExpandedCourses((current) => current.includes(title)
      ? current.filter((item) => item !== title)
      : [...current, title])
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Laporan belajar</h2>
          <p className="mt-1 text-sm text-slate-500">Rangkuman nilai, tugas, dan kehadiran per kelas.</p>
        </div>
        <span className="w-fit rounded-full bg-amber-50 px-3 py-1 text-[10px] font-medium text-amber-800">Data contoh</span>
      </header>

      <section aria-label="Ringkasan laporan belajar" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ReportMetric icon={Star} label="Rata-rata nilai" value={averageScore === null ? '—' : `${averageScore}/100`} tone="blue" />
        <ReportMetric icon={CalendarCheck} label="Kehadiran" value={`${attendanceRate}%`} detail={`${attendancePresent}/${attendanceTotal} sesi`} tone="green" />
        <ReportMetric icon={FileText} label="Tugas dikumpulkan" value={`${submittedTasks}/${totalTasks}`} tone="purple" />
        <ReportMetric icon={BookOpen} label="Kelas dilaporkan" value={String(courses.length)} tone="orange" />
      </section>

      {courses.length === 0 ? (
        <EmptyState title="Belum ada laporan" description="Laporan kelas akan tampil setelah peserta mengikuti pembelajaran." />
      ) : (
        <section className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Rincian per kelas</h3>
              <p className="mt-1 text-xs text-slate-500">Buka kelas untuk melihat nilai tugas dan kehadiran.</p>
            </div>
            <label className="relative block sm:w-64">
              <span className="sr-only">Cari kelas dalam laporan</span>
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari kelas"
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-xs outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </label>
          </div>
          {filteredCourses.length === 0 ? (
            <EmptyState title="Kelas tidak ditemukan" description="Coba kata pencarian lain." />
          ) : (
            <div className="space-y-3">
              {filteredCourses.map((course) => (
                <ReportCourseCard
                  key={course.title}
                  course={course}
                  expanded={expandedCourses.includes(course.title)}
                  onToggle={() => toggleCourse(course.title)}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function ReportCourseCard({
  course,
  expanded,
  onToggle,
}: {
  course: LearnerCourseProgress
  expanded: boolean
  onToggle: () => void
}) {
  const gradedTasks = course.tasks.filter((task) => task.score !== null)
  const average = gradedTasks.length
    ? Math.round(gradedTasks.reduce((sum, task) => sum + (task.score ?? 0), 0) / gradedTasks.length)
    : null
  const attendanceRate = course.attendanceTotal
    ? Math.round((course.attendancePresent / course.attendanceTotal) * 100)
    : 0

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className="flex w-full flex-wrap items-center gap-4 p-4 text-left hover:bg-slate-50"
      >
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${expanded ? '' : '-rotate-90'}`} aria-hidden />
        <span className="min-w-40 flex-1">
          <span className="block text-sm font-semibold text-slate-900">{course.title}</span>
          <span className="mt-1 block text-xs text-slate-500">{course.tasks.length} tugas · Nilai rata-rata {average ?? '—'}</span>
        </span>
        <span className="min-w-40 flex-1">
          <span className="mb-1 flex justify-between text-[10px] text-slate-500"><span>Progres tugas</span><span>{course.progress}%</span></span>
          <span className="block h-2.5 overflow-hidden rounded-full bg-slate-200">
            <span className="block h-full rounded-full bg-sky-500" style={{ width: `${course.progress}%` }} />
          </span>
        </span>
        <span className="text-xs font-medium text-slate-600">Kehadiran {attendanceRate}%</span>
      </button>

      {expanded && (
        <div className="space-y-5 border-t border-slate-100 bg-slate-50/60 p-4">
          <section className="rounded-lg border border-slate-200 bg-white">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-800">Nilai dan tugas</h4>
                <p className="mt-1 text-xs text-slate-500">Rata-rata nilai tugas yang sudah dinilai: {average ?? 'Belum ada nilai'}.</p>
              </div>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                {course.assignmentsDone}/{course.assignmentsTotal} dikumpulkan
              </span>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[48rem] text-left text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">Tugas</th>
                    <th scope="col" className="px-4 py-3 font-medium">Jenis</th>
                    <th scope="col" className="px-4 py-3 font-medium">Tenggat</th>
                    <th scope="col" className="px-4 py-3 font-medium">Dikumpulkan</th>
                    <th scope="col" className="px-4 py-3 font-medium">Status</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Nilai</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {course.tasks.map((task) => (
                    <tr key={task.title}>
                      <td className="px-4 py-3 font-medium text-slate-800">{task.title}</td>
                      <td className="px-4 py-3 text-slate-600">{task.type}</td>
                      <td className="px-4 py-3 text-slate-600">{task.deadline}</td>
                      <td className="px-4 py-3 text-slate-600">{task.submittedAt ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex whitespace-nowrap rounded-md px-2.5 py-1 text-[10px] font-medium ${TASK_STATUS_STYLES[task.status]}`}>
                          {task.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">{task.score === null ? '—' : task.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-800">Kehadiran kelas</h4>
                <p className="mt-1 text-xs text-slate-500">Hadir {course.attendancePresent} dari {course.attendanceTotal} sesi.</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${attendanceRate >= 80 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                {attendanceRate}%
              </span>
            </header>
            {course.attendance.length === 0 ? (
              <p className="p-4 text-xs text-slate-500">Belum ada catatan kehadiran.</p>
            ) : (
              <ul className="divide-y divide-slate-100 sm:grid sm:grid-cols-2 sm:divide-y-0">
                {course.attendance.map((entry) => (
                  <li key={`${entry.date}-${entry.session}`} className="flex items-center justify-between gap-3 px-4 py-3 text-xs sm:border-b sm:border-slate-100">
                    <span className="min-w-0">
                      <span className="block font-medium text-slate-700">{entry.session}</span>
                      <span className="mt-1 block text-slate-500">{entry.date}</span>
                    </span>
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 font-medium ${
                      entry.status === 'Hadir' ? 'bg-green-50 text-green-700' : entry.status === 'Izin' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-600'
                    }`}>
                      {entry.status === 'Hadir' && <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />}
                      {entry.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </article>
  )
}

function ReportMetric({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof Star
  label: string
  value: string
  detail?: string
  tone: 'blue' | 'green' | 'purple' | 'orange'
}) {
  const tones = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-violet-50 text-violet-600',
    orange: 'bg-orange-50 text-orange-600',
  }
  return (
    <article className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="mt-0.5 text-lg font-bold text-slate-900">{value}</p>
        {detail && <p className="text-[10px] text-slate-400">{detail}</p>}
      </div>
    </article>
  )
}

function ProfileMetric({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: typeof BookOpen
  value: number
  label: string
  tone: 'blue' | 'purple'
}) {
  const colors = tone === 'blue' ? 'bg-blue-50 text-blue-600' : 'bg-violet-50 text-violet-600'
  return (
    <div className="flex min-w-24 flex-col items-center rounded-lg border border-slate-200 px-3 py-2.5">
      <Icon className={`h-5 w-5 ${colors.split(' ')[1]}`} aria-hidden />
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
      <p className="text-[10px] text-slate-500">{label}</p>
    </div>
  )
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="break-words font-medium text-slate-800">{value}</dd>
    </div>
  )
}
