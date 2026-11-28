import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock3,
  Download,
  FileText,
  Layers3,
  Link2,
  Play,
  Star,
  ThumbsUp,
  Video,
  Zap,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { EmptyState, ErrorState, Spinner } from '../../components/ui/States'
import type { Course, CourseModule } from '../../features/courses/types'
import { api } from '../../lib/api'
import { useApiData } from '../../lib/useApiData'
import { CourseDiscussions } from '../../features/discussions/CourseDiscussions'
import type { CourseMaterialPreview, CourseModulePreview, CourseReviewPreview, MentorCoursePreview, SupportingMaterialPreview } from './courseData'
import {
  courseAudience,
  courseDurationMinutes,
  courseMaterialCount,
  courseAllowsXp,
  courseXpBreakdown,
  courseTypeLabel,
  moduleXpTotal,
} from './courseData'
import { toCoursePreview } from './courseApi'

type DetailTab = 'curriculum' | 'discussions' | 'reviews' | 'modules'

const TABS: { key: DetailTab; label: string }[] = [
  { key: 'curriculum', label: 'Kurikulum' },
  { key: 'discussions', label: 'Diskusi' },
  { key: 'reviews', label: 'Ulasan siswa' },
  { key: 'modules', label: 'Modul' },
]

function durationLabel(minutes: number | null): string {
  if (minutes === null) return 'Durasi belum ditentukan'
  return minutes < 60 ? `${minutes} menit` : `${Math.floor(minutes / 60)} jam${minutes % 60 ? ` ${minutes % 60} menit` : ''}`
}

function materialIcon(type: CourseMaterialPreview['type']) {
  switch (type) {
    case 'video':
      return Video
    case 'pdf':
    case 'document':
      return FileText
    case 'link':
      return Link2
  }
}

function allMaterials(modules: CourseModulePreview[]) {
  return modules.flatMap((module) => module.materials.map((material) => ({ module, material })))
}

function CurriculumTab({
  modules,
  selectedMaterialId,
  onSelectMaterial,
}: {
  modules: CourseModulePreview[]
  selectedMaterialId: string
  onSelectMaterial: (id: string) => void
}) {
  const selected = allMaterials(modules).find(({ material }) => material.id === selectedMaterialId) ?? allMaterials(modules)[0]
  const [expandedModules, setExpandedModules] = useState<number[]>(() => modules.map((module) => module.id))
  const selectedIndex = allMaterials(modules).findIndex(({ material }) => material.id === selected?.material.id)

  if (!selected) {
    return <EmptyState title="Kurikulum belum tersedia" description="Materi untuk kursus ini belum ditambahkan." />
  }

  const selectRelative = (offset: number) => {
    const next = allMaterials(modules)[selectedIndex + offset]
    if (next) onSelectMaterial(next.material.id)
  }

  const MediaIcon = materialIcon(selected.material.type)
  const mediaUrl = selected.material.fileUrl ?? selected.material.externalUrl ?? null

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(18rem,0.9fr)]">
      <div className="space-y-4">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 p-6 text-center text-white">
            <div className="max-w-sm">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/15">
                <MediaIcon className="h-8 w-8" aria-hidden />
              </span>
              <p className="mt-4 text-sm font-semibold">Pratinjau {selected.material.type === 'video' ? 'video' : 'materi'}</p>
              <p className="mt-1 text-xs text-white/70">
                {mediaUrl ? 'Materi dapat dibuka pada tab baru.' : 'Materi ini belum memiliki berkas atau tautan.'}
              </p>
              {mediaUrl && (
                <a
                  href={mediaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-800"
                >
                  <Play className="h-4 w-4 fill-current" aria-hidden />
                  {selected.material.type === 'video' ? 'Tonton materi' : 'Buka materi'}
                </a>
              )}
            </div>
          </div>
          <div className="p-4 sm:p-5">
            <p className="text-xs font-medium text-brand-700">{selected.module.title}</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">{selected.material.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{selected.material.description}</p>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><MediaIcon className="h-4 w-4" aria-hidden />{selected.material.type.toUpperCase()}</span>
              <span className="flex items-center gap-1.5"><Clock3 className="h-4 w-4" aria-hidden />{durationLabel(selected.material.durationMinutes)}</span>
              {selected.material.xpPoints > 0 && <span className="flex items-center gap-1.5"><Zap className="h-4 w-4 text-amber-500" aria-hidden />{selected.material.xpPoints} XP</span>}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-slate-900">Tentang materi ini</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{selected.material.description}</p>
          <div className="mt-4 flex justify-between gap-3">
            <button
              type="button"
              onClick={() => selectRelative(-1)}
              disabled={selectedIndex <= 0}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Materi sebelumnya
            </button>
            <button
              type="button"
              onClick={() => selectRelative(1)}
              disabled={selectedIndex >= allMaterials(modules).length - 1}
              className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Materi berikutnya
            </button>
          </div>
        </section>
      </div>

      <aside className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <header className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Konten kursus</h2>
          <p className="mt-1 text-xs text-slate-500">{allMaterials(modules).length} materi pembelajaran · {modules.length} modul utama</p>
        </header>
        <div className="max-h-[70vh] overflow-y-auto">
          {modules.map((module, moduleIndex) => {
            const expanded = expandedModules.includes(module.id)
            return (
              <section key={module.id} className="border-b border-slate-200 last:border-b-0">
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setExpandedModules((current) => expanded ? current.filter((id) => id !== module.id) : [...current, module.id])}
                  className="flex w-full items-center justify-between gap-3 bg-white px-4 py-3 text-left hover:bg-slate-50"
                >
                  <span>
                    <span className="block text-[10px] font-bold uppercase text-slate-700">Modul {moduleIndex + 1}: {module.title}</span>
                    <span className="mt-1 block text-[10px] text-slate-500">{module.materials.length} submateri</span>
                  </span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${expanded ? '' : '-rotate-90'}`} aria-hidden />
                </button>
                {expanded && module.materials.map((material) => {
                  const Icon = materialIcon(material.type)
                  const active = selected.material.id === material.id
                  return (
                    <button
                      type="button"
                      key={material.id}
                      onClick={() => onSelectMaterial(material.id)}
                      aria-current={active ? 'true' : undefined}
                      className={`flex w-full items-center gap-3 border-t border-slate-100 px-4 py-3 text-left transition-colors ${
                        active ? 'border-l-4 border-l-brand-500 bg-brand-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${active ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className={`block text-xs font-medium ${active ? 'text-brand-700' : 'text-slate-700'}`}>{material.title}</span>
                        <span className="mt-1 block text-[10px] text-slate-500">{durationLabel(material.durationMinutes)}</span>
                      </span>
                    </button>
                  )
                })}
              </section>
            )
          })}
        </div>
      </aside>
    </div>
  )
}

function ReviewsTab({ reviews }: { reviews: CourseReviewPreview[] }) {
  const [likedReviews, setLikedReviews] = useState<number[]>([])
  const [likeCounts, setLikeCounts] = useState(() => Object.fromEntries(reviews.map((review) => [review.id, review.likes])))

  if (reviews.length === 0) {
    return <EmptyState title="Belum ada ulasan siswa" description="Ulasan kursus akan tampil di sini setelah siswa mengirimkan ulasan." />
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <header className="border-b border-slate-100 p-4">
        <h2 className="font-semibold text-slate-900">Ulasan siswa</h2>
        <p className="mt-1 text-xs text-slate-500">Baca masukan siswa dan beri apresiasi pada ulasan yang membantu.</p>
      </header>
      <ul className="divide-y divide-slate-100">
        {reviews.map((review) => {
          const liked = likedReviews.includes(review.id)
          return (
            <li key={review.id} className="p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                  {review.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('')}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800">{review.name}</p>
                    <span className="text-xs text-slate-500">{review.date}</span>
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-600">
                    <Star className="h-3.5 w-3.5 fill-current" aria-hidden />{review.rating}/5
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{review.message}</p>
                  <button
                    type="button"
                    aria-pressed={liked}
                    onClick={() => {
                      setLikedReviews((current) => liked ? current.filter((id) => id !== review.id) : [...current, review.id])
                      setLikeCounts((current) => ({ ...current, [review.id]: (current[review.id] ?? 0) + (liked ? -1 : 1) }))
                    }}
                    className={`mt-3 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ${liked ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-100'}`}
                  >
                    <ThumbsUp className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} aria-hidden />
                    Suka · {likeCounts[review.id] ?? review.likes}
                  </button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function ModulesTab({
  modules,
  downloadNoticeId,
  onDownload,
}: {
  modules: CourseModulePreview[]
  downloadNoticeId: string | null
  onDownload: (material: SupportingMaterialPreview) => void
}) {
  const [expandedModules, setExpandedModules] = useState<number[]>([])

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {modules.map((module, index) => {
        const totalXp = moduleXpTotal(module)
        const expanded = expandedModules.includes(module.id)
        return (
          <article key={module.id} className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Layers3 className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-700">Modul {index + 1}</p>
                <h2 className="mt-1 font-semibold text-slate-900">{module.title}</h2>
              </div>
            </div>
            {module.description && <p className="mt-3 text-sm leading-6 text-slate-600">{module.description}</p>}
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1"><BookOpen className="h-4 w-4" aria-hidden />{module.materials.length} submateri</span>
              {totalXp > 0 && <span className="flex items-center gap-1"><Zap className="h-4 w-4 text-amber-500" aria-hidden />Potensi {totalXp} XP</span>}
            </div>
            {(module.activities ?? []).filter((activity) => activity.xpPoints > 0).length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3">
                {(module.activities ?? []).filter((activity) => activity.xpPoints > 0).map((activity) => (
                  <li key={activity.id} className="flex justify-between gap-3 text-xs text-slate-500">
                    <span>{activity.title} · {activity.type}</span><span className="shrink-0">{activity.xpPoints} XP</span>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpandedModules((current) => expanded ? current.filter((id) => id !== module.id) : [...current, module.id])}
              className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"
            >
              {expanded ? 'Tutup submateri' : 'Lihat submateri'}
              <ChevronRight className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`} aria-hidden />
            </button>
            {expanded && (
              <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                <section>
                  <h3 className="text-xs font-semibold text-slate-800">Submateri</h3>
                  <ul className="mt-2 divide-y divide-slate-100">
                    {module.materials.map((material) => {
                      const Icon = materialIcon(material.type)
                      return (
                        <li key={material.id} className="flex items-start gap-2 py-2">
                          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-800">{material.title}</p>
                            <p className="mt-1 text-[10px] text-slate-500">{material.type.toUpperCase()} · {durationLabel(material.durationMinutes)}{material.xpPoints > 0 ? ` · ${material.xpPoints} XP` : ''}</p>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </section>
                <section className="border-t border-slate-100 pt-3">
                  <h3 className="text-xs font-semibold text-slate-800">Materi pendukung</h3>
                  {module.supportingMaterials?.length ? (
                    <ul className="mt-2 space-y-2">
                      {module.supportingMaterials.map((material) => (
                        <li key={material.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <FileText className="h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium text-slate-800">{material.name}</p>
                              <p className="mt-1 text-[10px] text-slate-500">{material.format} · {material.size}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => onDownload(material)}
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            <Download className="h-3.5 w-3.5" aria-hidden />Unduh
                          </button>
                          {downloadNoticeId === material.id && (
                            <p role="status" aria-live="polite" className="w-full text-[10px] text-amber-800">
                              File belum tersedia untuk diunduh pada prototipe ini.
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">Belum ada materi pendukung untuk modul ini.</p>
                  )}
                </section>
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}

export default function MentorCourseDetail() {
  const { courseId } = useParams<{ courseId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const [downloadNoticeId, setDownloadNoticeId] = useState<string | null>(null)

  // Kursus dan isi kurikulumnya diambil langsung dari API yang sama dengan halaman Admin.
  const detail = useApiData<MentorCoursePreview>(async () => {
    const [courseRes, modulesRes] = await Promise.all([
      api.get<{ data: Course }>(`/courses/${courseId}`),
      api.get<{ data: CourseModule[] }>(`/courses/${courseId}/modules`),
    ])
    return toCoursePreview(courseRes.data.data, modulesRes.data.data)
  }, [courseId])

  const course = detail.data
  const requestedTab = searchParams.get('tab') as DetailTab | null
  const tab = TABS.some((item) => item.key === requestedTab) ? requestedTab! : 'curriculum'
  const firstMaterialId = course ? allMaterials(course.modules)[0]?.material.id : undefined
  const selectedMaterialId = searchParams.get('material') ?? firstMaterialId ?? ''
  const durationMinutes = useMemo(() => course ? courseDurationMinutes(course) : 0, [course])

  if (detail.loading && !course) return <Spinner label="Memuat kursus…" />
  if (detail.error) {
    return (
      <div className="space-y-4">
        <Link to="/mentor/courses" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-brand-700">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Kembali ke Kursus Saya
        </Link>
        {detail.error.kind === 'not_found' ? (
          <EmptyState title="Kursus tidak ditemukan" description="Kursus mungkin sudah dihapus atau bukan kursus yang Anda ampu." />
        ) : (
          <ErrorState error={detail.error} onRetry={detail.reload} />
        )}
      </div>
    )
  }
  if (!course) return null

  const setTab = (nextTab: DetailTab) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', nextTab)
    setSearchParams(next, { replace: true })
  }

  const selectMaterial = (materialId: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', 'curriculum')
    next.set('material', materialId)
    setSearchParams(next)
  }

  const xpBreakdown = courseXpBreakdown(course)
  const visibleTabs = TABS.filter((item) => item.key !== 'reviews' || (course.reviews?.length ?? 0) > 0)

  return (
    <div className="space-y-5">
      <Link to="/mentor/courses" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Kembali ke Kursus Saya
      </Link>

      <header className="rounded-2xl bg-gradient-to-r from-orange-700 to-orange-600 p-6 text-white shadow-md sm:p-8">
        <span className="inline-flex rounded-md bg-white/25 px-3 py-1 text-xs font-medium">{courseTypeLabel(course.type)}</span>
        <h1 className="mt-3 text-2xl font-bold sm:text-3xl">{course.title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-white/80 sm:text-base">{course.description}</p>
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3 text-sm">
          <span className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-xs font-bold">{course.modules.length}</span>{course.modules.length} modul</span>
          <span className="flex items-center gap-2"><Star className="h-4 w-4 fill-current" aria-hidden />{course.rating === null ? 'Belum ada ulasan' : `${course.rating.toFixed(1)}/5.0`}</span>
          <span className="flex items-center gap-2"><Clock3 className="h-4 w-4" aria-hidden />{Math.ceil(durationMinutes / 60)} jam</span>
          <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4" aria-hidden />{course.sessions} sesi</span>
          <span className="flex items-center gap-2"><BookOpen className="h-4 w-4" aria-hidden />{course.students} {courseAudience(course.type)}</span>
        </div>
      </header>

      <div className="flex items-center justify-between gap-3">
        <nav aria-label="Bagian detail kursus" className="flex gap-1 overflow-x-auto border-b border-slate-200">
          {visibleTabs.map((item) => (
            <button
              type="button"
              key={item.key}
              onClick={() => setTab(item.key)}
              aria-current={tab === item.key ? 'page' : undefined}
              className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold ${
                tab === item.key ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <span className="hidden shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-medium text-emerald-700 sm:inline-flex">
          Data langsung dari server
        </span>
      </div>

      {tab === 'curriculum' && (
        <CurriculumTab
          modules={course.modules}
          selectedMaterialId={selectedMaterialId}
          onSelectMaterial={selectMaterial}
        />
      )}
      <div className={tab === 'discussions' ? '' : 'hidden'}>
        <CourseDiscussions courseId={course.id} />
      </div>
      {tab === 'reviews' && <ReviewsTab key={course.id} reviews={course.reviews ?? []} />}
      {tab === 'modules' && (
        <div className="space-y-4">
          <section className="grid gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
              <BookOpen className="h-5 w-5 text-brand-600" aria-hidden />
              <div><p className="text-xs text-slate-500">Total modul</p><p className="font-semibold text-slate-900">{course.modules.length}</p></div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
              <Layers3 className="h-5 w-5 text-brand-600" aria-hidden />
              <div><p className="text-xs text-slate-500">Total materi</p><p className="font-semibold text-slate-900">{courseMaterialCount(course)}</p></div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
              <Zap className="h-5 w-5 text-amber-500" aria-hidden />
              <div>
                <p className="text-xs text-slate-500">Potensi XP siswa</p>
                <p className="font-semibold text-slate-900">{courseAllowsXp(course) ? `${xpBreakdown.total} XP` : 'Tidak berlaku'}</p>
              </div>
            </div>
          </section>
          {courseAllowsXp(course) ? (
            <p className="rounded-lg bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
              Total merupakan akumulasi potensi XP dari materi ({xpBreakdown.materials}), kuis ({xpBreakdown.quizzes}), dan tugas ({xpBreakdown.assignments}). Angka ini hanya contoh pratinjau; XP berlaku untuk kursus siswa, bukan pelatihan/webinar karyawan.
            </p>
          ) : (
            <p className="rounded-lg bg-slate-100 px-4 py-3 text-xs leading-5 text-slate-600">
              XP tidak diterapkan pada pelatihan atau webinar karyawan sesuai aturan kursus saat ini.
            </p>
          )}
          <ModulesTab
            modules={course.modules}
            downloadNoticeId={downloadNoticeId}
            onDownload={(material) => setDownloadNoticeId(material.id)}
          />
        </div>
      )}
    </div>
  )
}
