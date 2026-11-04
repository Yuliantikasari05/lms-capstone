import { ArrowLeft, Award, Eye, EyeOff, Pencil, UserCog } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Notice } from '../../../components/ui/Notice'
import { EmptyState, ErrorState, Spinner } from '../../../components/ui/States'
import { AssignMentorModal } from '../../../features/courses/components/AssignMentorModal'
import { ComingSoonTab } from '../../../features/courses/components/ComingSoonTab'
import { CourseFormModal } from '../../../features/courses/components/CourseFormModal'
import { ModulesTab } from '../../../features/courses/components/ModulesTab'
import { ParticipantsTab } from '../../../features/courses/components/ParticipantsTab'
import { SessionsTab } from '../../../features/courses/components/SessionsTab'
import type { Course } from '../../../features/courses/types'
import { COURSE_STATUS_TONE, participantLabel } from '../../../features/courses/utils'
import { api } from '../../../lib/api'
import { useApiData } from '../../../lib/useApiData'
import { COURSES_PATH } from './CoursesListPage'

type TabKey = 'modules' | 'sessions' | 'participants' | 'discussions' | 'exams'

const TABS: { key: TabKey; label: string; managementOnly?: boolean }[] = [
  { key: 'modules', label: 'Modul' },
  { key: 'sessions', label: 'Sesi' },
  { key: 'participants', label: 'Peserta', managementOnly: true },
  { key: 'discussions', label: 'Diskusi' },
  { key: 'exams', label: 'Ujian' },
]

/** Detail kursus (hi-fi 3.14 bagian 2): ringkasan dan tab Modul, Sesi, Peserta, Diskusi, Ujian. */
export default function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>()
  const [params, setParams] = useSearchParams()

  const course = useApiData<Course>(async () => (await api.get<{ data: Course }>(`/courses/${courseId}`)).data.data, [courseId])
  const data = course.data

  const preview = params.get('preview') === '1'
  const requested = params.get('tab') as TabKey | null

  const [editing, setEditing] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (notice?.tone !== 'success') return
    const timer = window.setTimeout(() => setNotice(null), 6000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const visibleTabs = TABS.filter((t) => !(preview && t.managementOnly))
  const tab: TabKey = visibleTabs.some((t) => t.key === requested) ? (requested as TabKey) : 'modules'

  const setTab = (key: TabKey) => {
    const next = new URLSearchParams(params)
    next.set('tab', key)
    setParams(next, { replace: true })
  }

  const setPreview = (on: boolean) => {
    const next = new URLSearchParams(params)
    if (on) next.set('preview', '1')
    else next.delete('preview')
    setParams(next, { replace: true })
  }

  if (course.loading && !data) return <Spinner label="Memuat kursus…" />
  if (course.error) {
    const notFound = course.error.name === 'ApiError' && (course.error as { kind?: string }).kind === 'not_found'
    return (
      <div className="space-y-4">
        <Link to={COURSES_PATH} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Daftar kursus
        </Link>
        {notFound ? <EmptyState title="Kursus tidak ditemukan" description="Kursus mungkin sudah dihapus." /> : <ErrorState error={course.error} onRetry={course.reload} />}
      </div>
    )
  }
  if (!data) return null

  const abilities = data.abilities
  const contentReadOnly = preview || !abilities?.manage_content
  const participantsReadOnly = preview || !abilities?.manage_enrollments
  const label = participantLabel(data.type)

  return (
    <div>
      <Link to={COURSES_PATH} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-600 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Daftar kursus
      </Link>

      {preview && (
        <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm text-sky-800">
          <span>Mode preview: tampilan isi kursus tanpa kontrol pengelolaan.</span>
          <Button variant="secondary" onClick={() => setPreview(false)} icon={<EyeOff className="h-4 w-4" aria-hidden />}>
            Keluar preview
          </Button>
        </div>
      )}

      {notice && (
        <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.text}
        </Notice>
      )}

      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Badge tone={COURSE_STATUS_TONE[data.status]}>{data.status_label}</Badge>
            <Badge tone="neutral">{data.type_label}</Badge>
          </div>
          <h1 className="text-2xl font-semibold text-ink-900">{data.title}</h1>
          {data.description && <p className="mt-1 max-w-2xl text-sm text-slate-600">{data.description}</p>}
          <p className="mt-2 text-sm text-slate-700">
            <span className="text-slate-500">Mentor:</span> {data.mentor ? data.mentor.name : <span className="text-slate-400">Belum ada Mentor</span>}
            {data.mentor?.deleted && <span className="ml-1 text-xs text-red-600">(akun dihapus)</span>}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {data.participants_count ?? 0} {label} · {data.modules_count ?? 0} Modul · {data.sessions_count ?? 0} Sesi
          </p>
        </div>

        {!preview && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setPreview(true)} icon={<Eye className="h-4 w-4" aria-hidden />}>
              Preview
            </Button>
            <Button variant="secondary" disabled title="Tersedia di tahap sertifikat" icon={<Award className="h-4 w-4" aria-hidden />}>
              Atur Sertifikat
            </Button>
            {abilities?.assign_mentor && (
              <Button variant="secondary" onClick={() => setAssigning(true)} icon={<UserCog className="h-4 w-4" aria-hidden />}>
                Ganti Mentor
              </Button>
            )}
            {abilities?.update && (
              <Button onClick={() => setEditing(true)} icon={<Pencil className="h-4 w-4" aria-hidden />}>
                Ubah
              </Button>
            )}
          </div>
        )}
      </header>

      {!abilities?.update && !preview && (
        <p className="mb-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">Kursus ini hanya dapat dilihat. {data.type === 'institution' ? 'Program Lembaga diubah oleh lembaganya.' : ''}</p>
      )}

      <div role="tablist" aria-label="Bagian kursus" className="mb-5 flex gap-1 overflow-x-auto border-b border-slate-200">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls="course-tabpanel"
            onClick={() => setTab(t.key)}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key ? 'border-ink-900 text-ink-900' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div id="course-tabpanel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === 'modules' && <ModulesTab course={data} readOnly={contentReadOnly} onChanged={course.reload} />}
        {tab === 'sessions' && <SessionsTab course={data} readOnly={contentReadOnly} onChanged={course.reload} />}
        {tab === 'participants' && <ParticipantsTab course={data} readOnly={participantsReadOnly} onChanged={course.reload} />}
        {tab === 'discussions' && <ComingSoonTab title="Diskusi belum tersedia" description="Forum diskusi kursus akan hadir setelah cakupannya ditetapkan." />}
        {tab === 'exams' && <ComingSoonTab title="Ujian belum tersedia" description="Review pengajuan ujian dari Mentor akan hadir di tahap penilaian." />}
      </div>

      {editing && (
        <CourseFormModal
          mode="edit"
          course={data}
          onClose={() => setEditing(false)}
          onSaved={(message) => {
            setEditing(false)
            setNotice({ tone: 'success', text: message })
            course.reload()
          }}
        />
      )}
      {assigning && (
        <AssignMentorModal
          course={data}
          onClose={() => setAssigning(false)}
          onSaved={(message) => {
            setAssigning(false)
            setNotice({ tone: 'success', text: message })
            course.reload()
          }}
        />
      )}
    </div>
  )
}
