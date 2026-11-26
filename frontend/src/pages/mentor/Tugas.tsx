import { ArrowLeft, CircleHelp, Eye, FileText, GripVertical, Pencil, Plus, Search, ShieldCheck, Trash2, Upload, X, type LucideIcon } from 'lucide-react'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Modal } from '../../components/ui/Modal'
import { ErrorState, Spinner } from '../../components/ui/States'
import { toApiError } from '../../lib/api'
import { useApiData } from '../../lib/useApiData'
import { AssignmentSubmissions } from './AssignmentSubmissions'
import {
  createAssignment,
  deleteAssignment,
  fetchAssignmentCourses,
  fetchAssignments,
  setAssignmentActive,
  updateAssignment,
  type AssignmentPreview,
  type MentorCourseOption,
  type QuestionKind,
} from './assignmentApi'
import { courseAudience } from './courseData'

type Audience = 'Siswa' | 'Karyawan'
type QuestionFormat = 'Mix' | 'Essay' | 'Pilihan ganda' | 'Upload file'
type EvaluationType = 'Tugas/Kuis' | 'Ujian'
type QuestionType = 'Pilihan ganda' | 'Essay' | 'Upload file'

interface QuestionOption {
  id: number
  text: string
}

interface QuestionDraft {
  id: number
  type: QuestionType
  prompt: string
  options: QuestionOption[]
  correctOptionIds: number[]
  multiSelect: boolean
  maxWords: number
  allowedFileTypes: string[]
  maxFileSizeMb: number
  maxFiles: number
  score: number
}

const PAGE_SIZE = 4
const QUESTION_KINDS: QuestionKind[] = ['Tugas', 'Kuis', 'Ujian']
const QUESTION_OPTIONS: { label: QuestionType; Icon: LucideIcon }[] = [
  { label: 'Pilihan ganda', Icon: CircleHelp },
  { label: 'Essay', Icon: FileText },
  { label: 'Upload file', Icon: Upload },
]

const AUDIENCE_STYLE: Record<Audience, string> = {
  Siswa: 'bg-blue-50 text-blue-700',
  Karyawan: 'bg-violet-50 text-violet-700',
}

const KIND_STYLE: Record<QuestionKind, string> = {
  Tugas: 'bg-slate-100 text-slate-700',
  Kuis: 'bg-indigo-50 text-indigo-700',
  Ujian: 'bg-amber-50 text-amber-700',
}

const FORMAT_STYLE: Record<QuestionFormat, string> = {
  Mix: 'bg-slate-100 text-slate-700',
  Essay: 'bg-slate-100 text-slate-700',
  'Pilihan ganda': 'bg-slate-100 text-slate-700',
  'Upload file': 'bg-slate-100 text-slate-700',
}

export default function MentorTugas() {
  const assignmentsState = useApiData(fetchAssignments, [])
  const coursesState = useApiData(fetchAssignmentCourses, [])
  const assignments = useMemo(() => assignmentsState.data ?? [], [assignmentsState.data])
  const courses = useMemo(() => coursesState.data ?? [], [coursesState.data])
  const courseById = useMemo(() => new Map(courses.map((course) => [course.id, course])), [courses])
  const [audience, setAudience] = useState<'all' | Audience>('all')
  const [kind, setKind] = useState<'all' | QuestionKind>('all')
  const [status, setStatus] = useState<'all' | 'active' | 'inactive' | 'approval'>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [notice, setNotice] = useState<string | null>(null)
  const [noticeTone, setNoticeTone] = useState<'info' | 'error'>('info')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<AssignmentPreview | null>(null)
  const [activeSection, setActiveSection] = useState<'master' | 'students' | 'employees'>('master')
  const [previewAssignment, setPreviewAssignment] = useState<AssignmentPreview | null>(null)

  const filteredAssignments = useMemo(() => assignments.filter((assignment) => {
    const course = courseById.get(assignment.courseId)
    const taskAudience = course ? (courseAudience(course.type) === 'siswa' ? 'Siswa' : 'Karyawan') : 'Siswa'
    const matchesSearch = `${assignment.title} ${course?.title ?? ''}`.toLowerCase().includes(search.trim().toLowerCase())
    return matchesSearch
      && (audience === 'all' || taskAudience === audience)
      && (kind === 'all' || assignment.kind === kind)
      && (status === 'all'
        || (status === 'active' && assignment.active)
        || (status === 'inactive' && !assignment.active && assignment.approval === 'Tersedia')
        || (status === 'approval' && assignment.approval === 'Menunggu persetujuan')
        || (status === 'approval' && assignment.approval === 'Ditolak'))
  }), [assignments, audience, courseById, kind, search, status])

  const totalPages = Math.max(1, Math.ceil(filteredAssignments.length / PAGE_SIZE))
  const visibleAssignments = filteredAssignments.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const resetFilters = () => {
    setAudience('all')
    setKind('all')
    setStatus('all')
    setSearch('')
    setPage(1)
  }

  const toggleAssignment = async (assignment: AssignmentPreview) => {
    if (assignment.approval === 'Menunggu persetujuan') return
    try {
      await setAssignmentActive(assignment.id, !assignment.active)
      setNoticeTone('info')
      setNotice(`Soal "${assignment.title}" ${assignment.active ? 'dinonaktifkan' : 'diaktifkan'}.`)
      assignmentsState.reload()
    } catch (error) {
      setNoticeTone('error')
      setNotice(toApiError(error).message)
    }
  }

  const handleDelete = async (assignment: AssignmentPreview) => {
    if (!window.confirm(`Hapus "${assignment.title}"? Tugas ini tidak lagi tampil untuk peserta.`)) return

    try {
      await deleteAssignment(assignment.id)
      setNoticeTone('info')
      setNotice(`Tugas "${assignment.title}" dihapus.`)
      assignmentsState.reload()
    } catch (error) {
      setNoticeTone('error')
      setNotice(toApiError(error).message)
    }
  }

  const showActionNotice = (action: 'preview' | 'edit' | 'delete', assignment: AssignmentPreview) => {
    if (action === 'preview') {
      setPreviewAssignment(assignment)
      return
    }
    if (action === 'edit') {
      setEditing(assignment)
      setCreating(false)
      return
    }
    void handleDelete(assignment)
  }

  return (
    <div className="space-y-5">
      <nav aria-label="Submenu tugas" className="flex gap-6 border-b border-slate-200">
        <button type="button" onClick={() => { setActiveSection('master'); setCreating(false); setEditing(null) }} aria-current={activeSection === 'master' ? 'page' : undefined} className={`border-b-2 px-1 py-3 text-sm font-semibold ${activeSection === 'master' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
          Master tugas
        </button>
        <button type="button" onClick={() => { setActiveSection('students'); setCreating(false); setEditing(null) }} aria-current={activeSection === 'students' ? 'page' : undefined} className={`border-b-2 px-1 py-3 text-sm font-semibold ${activeSection === 'students' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
          Tugas siswa
        </button>
        <button type="button" onClick={() => { setActiveSection('employees'); setCreating(false); setEditing(null) }} aria-current={activeSection === 'employees' ? 'page' : undefined} className={`border-b-2 px-1 py-3 text-sm font-semibold ${activeSection === 'employees' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
          Tugas karyawan
        </button>
      </nav>

      {assignmentsState.loading && !assignmentsState.data && <Spinner label="Memuat tugas…" />}
      {assignmentsState.error && <ErrorState error={assignmentsState.error} onRetry={assignmentsState.reload} />}

      {activeSection === 'master' ? (
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <header className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-5">
          <div>
            <h1 className="text-base font-semibold text-slate-900">Master tugas</h1>
            <p className="mt-1 text-xs text-slate-500">Kelola soal untuk siswa dan karyawan.</p>
          </div>
          {!creating && !editing && (
            <button
              type="button"
              onClick={() => { setCreating(true); setEditing(null) }}
              className="inline-flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-100"
            >
              <Plus className="h-4 w-4" aria-hidden />Tugas baru
            </button>
          )}
        </header>

        {creating || editing ? (
          <NewAssignmentForm
            assignment={editing ?? undefined}
            courses={courses}
            onBack={() => { setCreating(false); setEditing(null) }}
            onSaved={(message) => {
              setCreating(false)
              setEditing(null)
              setNoticeTone('info')
              setNotice(message)
              assignmentsState.reload()
            }}
          />
        ) : (
        <>
        <div className="flex flex-col gap-3 px-4 py-4 sm:px-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid gap-2 sm:grid-cols-3">
            <label>
              <span className="sr-only">Filter kategori pengguna</span>
              <select value={audience} onChange={(event) => { setAudience(event.target.value as 'all' | Audience); setPage(1) }} className="w-full min-w-36 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-brand-500">
                <option value="all">Semua user</option>
                <option value="Siswa">Siswa</option>
                <option value="Karyawan">Karyawan</option>
              </select>
            </label>
            <label>
              <span className="sr-only">Filter tipe soal</span>
              <select value={kind} onChange={(event) => { setKind(event.target.value as 'all' | QuestionKind); setPage(1) }} className="w-full min-w-36 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-brand-500">
                <option value="all">Semua tipe soal</option>
                {QUESTION_KINDS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label>
              <span className="sr-only">Filter status soal</span>
              <select value={status} onChange={(event) => { setStatus(event.target.value as typeof status); setPage(1) }} className="w-full min-w-36 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-brand-500">
                <option value="all">Semua status</option>
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
                <option value="approval">Menunggu persetujuan</option>
              </select>
            </label>
          </div>
          <label className="relative block xl:w-72">
            <span className="sr-only">Cari nama tugas</span>
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1) }}
              placeholder="Cari nama tugas"
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-xs outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>
        </div>

        {notice && (
          <div role="status" aria-live="polite" className={`mx-4 mb-3 flex items-start justify-between gap-3 rounded-lg px-3 py-2 text-xs sm:mx-5 ${noticeTone === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-800'}`}>
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice(null)} aria-label="Tutup pemberitahuan" className="font-semibold hover:underline">Tutup</button>
          </div>
        )}

        <div className="space-y-3 px-4 pb-4 sm:px-5">
          {visibleAssignments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center">
              <FileText className="mx-auto h-8 w-8 text-slate-300" aria-hidden />
              <p className="mt-2 text-sm font-medium text-slate-700">Tugas tidak ditemukan</p>
              <p className="mt-1 text-xs text-slate-500">Ubah filter atau kata pencarian.</p>
              <button type="button" onClick={resetFilters} className="mt-3 text-xs font-semibold text-brand-700 hover:underline">Reset filter</button>
            </div>
          ) : visibleAssignments.map((assignment) => (
            <AssignmentRow
              key={assignment.id}
              assignment={assignment}
              course={courseById.get(assignment.courseId)}
              onToggle={() => toggleAssignment(assignment)}
              onAction={showActionNotice}
            />
          ))}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:px-5">
          <span>
            Menampilkan {filteredAssignments.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, filteredAssignments.length)} dari {filteredAssignments.length} tugas
          </span>
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Halaman sebelumnya" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-40">‹</button>
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
            <button type="button" aria-label="Halaman berikutnya" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)} className="rounded border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-40">›</button>
          </div>
        </footer>
        </>
        )}
      </section>
      ) : null}
      <div hidden={activeSection !== 'students'}>
        <AssignmentSubmissions audience="Siswa" />
      </div>
      <div hidden={activeSection !== 'employees'}>
        <AssignmentSubmissions audience="Karyawan" />
      </div>

      <p className="text-center text-[11px] text-slate-400">Soal dan status tersimpan di server.</p>
      <QuestionPreviewDialog assignment={previewAssignment} onClose={() => setPreviewAssignment(null)} />
    </div>
  )
}

function QuestionPreviewDialog({
  assignment,
  onClose,
}: {
  assignment: AssignmentPreview | null
  onClose: () => void
}) {
  const questions = assignment?.questions ?? []

  return (
    <Modal
      open={assignment !== null}
      title={assignment?.title ?? 'Pratinjau soal'}
      description={`${assignment?.kind ?? ''} · ${assignment?.courseTitle ?? ''}`}
      onClose={onClose}
      size="lg"
    >
      <div className="space-y-3">
        {questions.length === 0 && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-[10px] text-slate-500">Belum ada soal pada tugas ini.</p>
        )}
        {questions.map((question, index) => (
          <article key={question.id} className="rounded-xl border border-slate-200 p-4">
            <header className="flex items-center justify-between gap-3">
              <h3 className="text-xs font-semibold text-slate-900">Soal {index + 1} · {question.type}</h3>
              <span className="text-[10px] text-slate-500">{question.points} poin</span>
            </header>
            <p className="mt-3 text-xs leading-5 text-slate-700">{question.prompt}</p>
            {question.options.length > 0 && (
              <ul className="mt-3 space-y-2">
                {question.options.map((option, optionIndex) => (
                  <li key={option.id} className="rounded-lg border border-slate-200 px-3 py-2 text-[11px] text-slate-600">
                    <strong className="mr-2">{String.fromCharCode(65 + optionIndex)}.</strong>{option.text}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[10px] text-slate-500">
              {question.type === 'Essay'
                ? 'Jawaban ditulis pada kolom essay.'
                : question.type === 'Upload file'
                  ? 'Peserta mengunggah berkas sesuai instruksi soal.'
                  : 'Peserta memilih satu jawaban yang benar.'}
            </p>
          </article>
        ))}
      </div>
    </Modal>
  )
}

function NewAssignmentForm({
  assignment,
  courses,
  onBack,
  onSaved,
}: {
  assignment?: AssignmentPreview
  courses: MentorCourseOption[]
  onBack: () => void
  onSaved: (message: string) => void
}) {
  const initialCourse = courses.find((course) => course.id === assignment?.courseId)
  const [evaluation, setEvaluation] = useState<EvaluationType | ''>(
    assignment ? (assignment.kind === 'Ujian' ? 'Ujian' : 'Tugas/Kuis') : '',
  )
  const [audience, setAudience] = useState<'' | Audience>(
    initialCourse ? (courseAudience(initialCourse.type) === 'siswa' ? 'Siswa' : 'Karyawan') : '',
  )
  const [courseId, setCourseId] = useState(assignment ? String(assignment.courseId) : '')
  const [questions, setQuestions] = useState<QuestionDraft[]>(() => (assignment?.questions ?? []).map((question) => ({
    id: question.id,
    type: question.type,
    prompt: question.prompt,
    options: question.options,
    correctOptionIds: question.correctOptionIds,
    multiSelect: false,
    maxWords: 50,
    allowedFileTypes: ['PDF'],
    maxFileSizeMb: 20,
    maxFiles: 2,
    score: question.points,
  })))
  const [allowLate, setAllowLate] = useState(assignment?.allowLate ?? false)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const filteredCourses = audience
    ? courses.filter((course) => (courseAudience(course.type) === 'siswa' ? 'Siswa' : 'Karyawan') === audience)
    : courses

  const addQuestion = (type: QuestionType) => {
    const id = Date.now() + questions.length
    const question: QuestionDraft = {
      id,
      type,
      prompt: '',
      options: type === 'Pilihan ganda'
        ? [{ id: id + 1, text: '' }, { id: id + 2, text: '' }, { id: id + 3, text: '' }]
        : [],
      correctOptionIds: type === 'Pilihan ganda' ? [id + 1] : [],
      multiSelect: false,
      maxWords: 50,
      allowedFileTypes: ['PDF'],
      maxFileSizeMb: 20,
      maxFiles: 2,
      score: 10,
    }
    setQuestions((current) => [...current, question])
  }

  const updateQuestion = (updatedQuestion: QuestionDraft) => {
    setQuestions((current) => current.map((question) => question.id === updatedQuestion.id ? updatedQuestion : question))
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (questions.length === 0) {
      setNotice('Tambahkan minimal satu soal sebelum menyimpan.')
      return
    }
    if (!courseId) {
      setNotice('Pilih kursus terlebih dahulu.')
      return
    }

    const form = event.currentTarget
    const value = (id: string) => (form.querySelector<HTMLInputElement>(`#${id}`)?.value ?? '').trim()
    const input = {
      title: value('assignment-title'),
      description: value('assignment-instructions'),
      kind: (evaluation === 'Ujian' ? 'Ujian' : 'Tugas') as 'Tugas' | 'Ujian',
      startsAt: value('assignment-start'),
      dueAt: value('assignment-deadline'),
      allowLate,
      latePenalty: allowLate ? Number(value('assignment-penalty')) || null : null,
      maxScore: Number(value('assignment-max-score')) || null,
      questions,
    }

    setSaving(true)
    setNotice(null)

    try {
      if (assignment) {
        await updateAssignment(assignment.id, input)
        onSaved(`Tugas "${input.title}" diperbarui.`)
      } else {
        await createAssignment(Number(courseId), input)
        onSaved(evaluation === 'Ujian'
          ? `Ujian "${input.title}" dikirim ke Admin untuk persetujuan.`
          : `Tugas "${input.title}" tersimpan.`)
      }
    } catch (error) {
      setNotice(toApiError(error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 hover:text-brand-700">
          <ArrowLeft className="h-4 w-4" aria-hidden />Kembali
        </button>
        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-60">
            <FileText className="h-4 w-4" aria-hidden />
            {saving ? 'Menyimpan…' : evaluation === 'Ujian' ? 'Simpan & Ajukan persetujuan' : 'Simpan'}
          </button>
        </div>
      </div>

      {notice && <p role="status" aria-live="polite" className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">{notice}</p>}

      <div className="mentor-assignment-layout">
        <div className="min-w-0 space-y-4">
          <FormField label="Judul tugas" htmlFor="assignment-title">
            <input id="assignment-title" required defaultValue={assignment?.title ?? ''} placeholder="Tuliskan judul tugas Anda" className={FORM_INPUT} />
          </FormField>
          <FormField label="Deskripsi / instruksi tugas" htmlFor="assignment-instructions">
            <textarea id="assignment-instructions" required rows={4} defaultValue={assignment?.description ?? ''} placeholder="Tuliskan instruksi umum yang akan dibaca peserta sebelum mengerjakan tugas ini..." className={`${FORM_INPUT} resize-y`} />
          </FormField>

          <section aria-label="Pembuatan soal" className="space-y-3">
            {questions.map((question, index) => (
              <QuestionCard
                key={question.id}
                question={question}
                index={index}
                onChange={updateQuestion}
                onDelete={() => setQuestions((current) => current.filter((item) => item.id !== question.id))}
              />
            ))}
            <div className="grid grid-cols-3 gap-2 rounded-xl border border-dashed border-slate-300 p-3">
              {QUESTION_OPTIONS.map(({ label, Icon }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => addQuestion(label)}
                  className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-lg border border-transparent p-3 text-xs font-medium text-slate-500 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
                >
                  <Icon className="h-5 w-5" aria-hidden />{label}
                </button>
              ))}
            </div>
          </section>

          {evaluation === 'Ujian' && (
            <div className="flex gap-3 rounded-xl border border-violet-200 bg-violet-50 p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700">
                <ShieldCheck className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h3 className="text-xs font-semibold text-violet-900">Persetujuan Admin diperlukan</h3>
                <p className="mt-1 text-[11px] leading-5 text-violet-800">
                  Ujian yang Anda buat akan dikirim ke Admin untuk ditinjau. Soal baru muncul di halaman ujian setelah disetujui Admin.
                </p>
              </div>
            </div>
          )}
        </div>

        <aside className="min-w-0 space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-800">Pengaturan tugas</h2>
          <FormField label="Target user" htmlFor="assignment-audience">
            <select
              id="assignment-audience"
              required
              value={audience}
              onChange={(event) => {
                setAudience(event.target.value as '' | Audience)
                setCourseId('')
              }}
              className={FORM_INPUT}
            >
              <option value="">Pilih target</option>
              <option value="Siswa">Siswa</option>
              <option value="Karyawan">Karyawan</option>
            </select>
          </FormField>
          <FormField label="Kursus / kategori" htmlFor="assignment-course">
            <select id="assignment-course" required value={courseId} onChange={(event) => setCourseId(event.target.value)} className={FORM_INPUT}>
              <option value="">Pilih kursus</option>
              {filteredCourses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
            </select>
          </FormField>
          <FormField label="Tipe evaluasi" htmlFor="assignment-evaluation">
            <select
              id="assignment-evaluation"
              required
              value={evaluation}
              onChange={(event) => {
                setEvaluation(event.target.value as EvaluationType | '')
                setNotice(null)
              }}
              className={FORM_INPUT}
            >
              <option value="">Pilih tipe evaluasi</option>
              <option value="Tugas/Kuis">Tugas/Kuis</option>
              <option value="Ujian">Ujian</option>
            </select>
          </FormField>
          <FormField label="Tanggal mulai" htmlFor="assignment-start">
            <input id="assignment-start" type="date" required defaultValue={assignment?.startsAt ?? ''} className={FORM_INPUT} />
          </FormField>
          <FormField label="Deadline tugas" htmlFor="assignment-deadline">
            <input id="assignment-deadline" type="date" required defaultValue={assignment?.dueAt ?? ''} className={FORM_INPUT} />
          </FormField>
          <label className="flex items-center justify-between gap-3 py-1 text-xs text-slate-600">
            <span>Terima keterlambatan (nilai dikurangi)</span>
            <button
              type="button"
              role="switch"
              aria-checked={allowLate}
              aria-label="Terima pengumpulan terlambat"
              onClick={() => setAllowLate((current) => !current)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${allowLate ? 'bg-brand-600' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-[left] ${allowLate ? 'left-6' : 'left-1'}`} />
            </button>
          </label>
          <FormField label="Nilai maksimal" htmlFor="assignment-max-score">
            <input id="assignment-max-score" type="number" min="1" max="100" defaultValue={assignment?.maxScore ?? undefined} placeholder="Masukkan nilai" className={FORM_INPUT} />
          </FormField>
          {allowLate && (
            <FormField label="Pengurangan nilai keterlambatan" htmlFor="assignment-penalty">
              <input id="assignment-penalty" type="number" min="0" max="100" defaultValue={assignment?.latePenalty ?? undefined} placeholder="Masukkan nilai pengurangan" className={FORM_INPUT} />
            </FormField>
          )}
        </aside>
      </div>
    </form>
  )
}

function QuestionCard({
  question,
  index,
  onChange,
  onDelete,
}: {
  question: QuestionDraft
  index: number
  onChange: (question: QuestionDraft) => void
  onDelete: () => void
}) {
  const update = (changes: Partial<QuestionDraft>) => onChange({ ...question, ...changes })
  const addOption = () => update({ options: [...question.options, { id: Date.now() + question.options.length, text: '' }] })
  const updateOption = (optionId: number, text: string) => update({
    options: question.options.map((option) => option.id === optionId ? { ...option, text } : option),
  })
  const removeOption = (optionId: number) => update({
    options: question.options.filter((option) => option.id !== optionId),
    correctOptionIds: question.correctOptionIds.filter((id) => id !== optionId),
  })
  const selectCorrectOption = (optionId: number, selected: boolean) => {
    const correctOptionIds = question.multiSelect
      ? selected
        ? [...question.correctOptionIds, optionId]
        : question.correctOptionIds.filter((id) => id !== optionId)
      : selected ? [optionId] : []
    update({ correctOptionIds })
  }
  const changeType = (type: QuestionType) => {
    if (type === 'Pilihan ganda' && question.options.length === 0) {
      const optionId = Date.now()
      update({
        type,
        options: [{ id: optionId, text: '' }, { id: optionId + 1, text: '' }, { id: optionId + 2, text: '' }],
        correctOptionIds: [optionId],
      })
      return
    }
    update({ type })
  }

  return (
    <article className="space-y-3 rounded-xl border border-slate-200 border-l-4 border-l-brand-500 bg-white p-3">
      <header className="flex flex-wrap items-center gap-2">
        <GripVertical className="h-4 w-4 text-slate-400" aria-hidden />
        <span className="rounded-md bg-brand-50 px-2.5 py-1 text-[10px] font-semibold text-brand-700">Soal {index + 1}</span>
        <label className="ml-auto">
          <span className="sr-only">Tipe soal {index + 1}</span>
          <select
            value={question.type}
            onChange={(event) => changeType(event.target.value as QuestionType)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-700 outline-none focus:border-brand-500"
          >
            <option value="Pilihan ganda">Pilihan ganda</option>
            <option value="Essay">Essay</option>
            <option value="Upload file">Upload file</option>
          </select>
        </label>
      </header>

      {question.type === 'Pilihan ganda' && (
        <div className="space-y-2.5">
          <label className="sr-only" htmlFor={`question-prompt-${question.id}`}>Tulis soal pertanyaan</label>
          <textarea
            id={`question-prompt-${question.id}`}
            required
            value={question.prompt}
            onChange={(event) => update({ prompt: event.target.value })}
            rows={2}
            placeholder="Tulis soal pertanyaan"
            className={`${FORM_INPUT} resize-y`}
          />
          <p className="text-[10px] font-medium text-slate-600">Pilihan jawaban</p>
          <div className="space-y-2">
            {question.options.map((option, optionIndex) => {
              const isCorrect = question.correctOptionIds.includes(option.id)
              return (
                <div key={option.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
                  <label className="sr-only" htmlFor={`option-${option.id}`}>Opsi {optionIndex + 1}</label>
                  <input
                    id={`option-${option.id}`}
                    value={option.text}
                    onChange={(event) => updateOption(option.id, event.target.value)}
                    placeholder={`Opsi ${optionIndex + 1}`}
                    className={FORM_INPUT}
                  />
                  <label className="flex items-center gap-1 text-[9px] text-slate-500" title="Tandai sebagai jawaban benar">
                    <input
                      type={question.multiSelect ? 'checkbox' : 'radio'}
                      name={`correct-answer-${question.id}`}
                      checked={isCorrect}
                      onChange={(event) => selectCorrectOption(option.id, event.target.checked)}
                      aria-label={`Tandai opsi ${optionIndex + 1} sebagai jawaban benar`}
                      className="h-4 w-4 accent-brand-600"
                    />
                    <span className="hidden sm:inline">Benar</span>
                  </label>
                  <button type="button" onClick={() => removeOption(option.id)} aria-label={`Hapus opsi ${optionIndex + 1}`} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              )
            })}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button type="button" onClick={addOption} className="rounded-md bg-brand-50 px-2.5 py-1.5 text-[10px] font-semibold text-brand-700 hover:bg-brand-100">
              + Tambah opsi
            </button>
            <div className="flex items-center gap-3 text-[10px] text-slate-600">
              <button type="button" aria-pressed={!question.multiSelect} onClick={() => update({ multiSelect: false, correctOptionIds: question.correctOptionIds.slice(0, 1) })} className={!question.multiSelect ? 'font-semibold text-brand-700' : 'hover:text-slate-900'}>
                Satu jawaban
              </button>
              <button type="button" aria-pressed={question.multiSelect} onClick={() => update({ multiSelect: true })} className={question.multiSelect ? 'font-semibold text-brand-700' : 'hover:text-slate-900'}>
                Multi jawaban
              </button>
            </div>
          </div>
          <ScoreField question={question} onChange={update} />
        </div>
      )}

      {question.type === 'Essay' && (
        <div className="space-y-2.5">
          <label className="sr-only" htmlFor={`question-prompt-${question.id}`}>Tulis instruksi essay</label>
          <textarea
            id={`question-prompt-${question.id}`}
            required
            value={question.prompt}
            onChange={(event) => update({ prompt: event.target.value })}
            rows={2}
            placeholder="Tulis instruksi atau pertanyaan essay"
            className={`${FORM_INPUT} resize-y`}
          />
          <div className="rounded-md bg-slate-50 p-3 text-[10px] italic text-slate-500">Contoh tampilan: siswa akan menambahkan jawaban panjang di sini.</div>
          <FormField label="Maksimal jumlah kata" htmlFor={`max-words-${question.id}`}>
            <input id={`max-words-${question.id}`} type="number" min="1" value={question.maxWords} onChange={(event) => update({ maxWords: Number(event.target.value) })} className={FORM_INPUT} />
          </FormField>
          <ScoreField question={question} onChange={update} />
        </div>
      )}

      {question.type === 'Upload file' && (
        <div className="space-y-3">
          <label className="sr-only" htmlFor={`question-prompt-${question.id}`}>Tulis instruksi upload file</label>
          <input
            id={`question-prompt-${question.id}`}
            required
            value={question.prompt}
            onChange={(event) => update({ prompt: event.target.value })}
            placeholder="Tulis instruksi soal"
            className={FORM_INPUT}
          />
          <fieldset>
            <legend className="mb-2 text-[10px] font-medium text-slate-600">Format file yang diizinkan</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {['PDF', 'DOCX', 'Gambar (JPG/PNG)', 'ZIP'].map((fileType) => (
                <label key={fileType} className="inline-flex items-center gap-1.5 text-[10px] text-slate-600">
                  <input
                    type="checkbox"
                    checked={question.allowedFileTypes.includes(fileType)}
                    onChange={(event) => update({
                      allowedFileTypes: event.target.checked
                        ? [...question.allowedFileTypes, fileType]
                        : question.allowedFileTypes.filter((item) => item !== fileType),
                    })}
                    className="h-3.5 w-3.5 accent-brand-600"
                  />
                  {fileType}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Ukuran maksimal file (MB)" htmlFor={`max-file-size-${question.id}`}>
              <input id={`max-file-size-${question.id}`} type="number" min="1" value={question.maxFileSizeMb} onChange={(event) => update({ maxFileSizeMb: Number(event.target.value) })} className={FORM_INPUT} />
            </FormField>
            <FormField label="Jumlah file maksimal" htmlFor={`max-files-${question.id}`}>
              <input id={`max-files-${question.id}`} type="number" min="1" value={question.maxFiles} onChange={(event) => update({ maxFiles: Number(event.target.value) })} className={FORM_INPUT} />
            </FormField>
          </div>
          <ScoreField question={question} onChange={update} />
        </div>
      )}

      <footer className="flex items-center justify-between border-t border-slate-100 pt-2">
        <button type="button" onClick={onDelete} aria-label={`Hapus soal ${index + 1}`} title="Hapus soal" className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      </footer>
    </article>
  )
}

function ScoreField({
  question,
  onChange,
}: {
  question: QuestionDraft
  onChange: (changes: Partial<QuestionDraft>) => void
}) {
  return (
    <label className="flex items-center gap-2 text-[10px] text-slate-600">
      {question.type === 'Pilihan ganda' ? 'Poin jika menjawab benar' : 'Nilai maksimal'}
      <input
        type="number"
        min="0"
        value={question.score}
        onChange={(event) => onChange({ score: Number(event.target.value) })}
        aria-label={`Nilai soal ${question.id}`}
        className="w-16 rounded-md border border-slate-200 px-2 py-1 text-center text-xs outline-none focus:border-brand-500"
      />
      poin
    </label>
  )
}

const FORM_INPUT = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100'

function FormField({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-[11px] font-medium text-slate-700">{label}</label>
      {children}
    </div>
  )
}

function AssignmentRow({
  assignment,
  course,
  onToggle,
  onAction,
}: {
  assignment: AssignmentPreview
  course?: MentorCourseOption
  onToggle: () => void
  onAction: (action: 'preview' | 'edit' | 'delete', assignment: AssignmentPreview) => void
}) {
  const audience: Audience = course && courseAudience(course.type) === 'karyawan' ? 'Karyawan' : 'Siswa'
  const requiresApproval = assignment.approval === 'Menunggu persetujuan'
  const actionButtons = [
    { action: 'preview' as const, label: 'Preview', Icon: Eye },
    { action: 'edit' as const, label: 'Edit', Icon: Pencil },
    { action: 'delete' as const, label: 'Hapus', Icon: Trash2 },
  ]

  return (
    <article className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 sm:px-4">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${requiresApproval ? 'bg-slate-100 text-slate-400' : 'bg-violet-50 text-violet-600'}`}>
        <FileText className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 basis-52">
        <h2 className="truncate text-xs font-semibold text-slate-900">{assignment.title}</h2>
        <p className="mt-1 truncate text-[10px] text-slate-500">Kursus: {course?.title ?? '—'}</p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 sm:min-w-32">
        <span className={`rounded px-2 py-1 text-[9px] font-semibold ${AUDIENCE_STYLE[audience]}`}>{audience}</span>
        <span className={`rounded px-2 py-1 text-[9px] font-semibold ${KIND_STYLE[assignment.kind]}`}>{assignment.kind}</span>
        <span className={`rounded px-2 py-1 text-[9px] font-semibold ${FORMAT_STYLE[assignment.format]}`}>{assignment.format}</span>
        {requiresApproval && <span className="rounded bg-amber-50 px-2 py-1 text-[9px] font-semibold text-amber-700">{assignment.approval}</span>}
      </div>
      <div className="ml-auto flex items-center gap-2 sm:ml-0">
        {!requiresApproval && (
          <span className="inline-flex shrink-0 items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={assignment.active}
              aria-label={`${assignment.active ? 'Nonaktifkan' : 'Aktifkan'} ${assignment.title}`}
              onClick={onToggle}
              className={`relative flex h-7 w-12 items-center rounded-full p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 ${
                assignment.active ? 'bg-brand-600' : 'bg-slate-300'
              }`}
            >
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-[left] duration-200 ${assignment.active ? 'left-6' : 'left-1'}`} />
            </button>
            <span className={`w-12 text-[10px] font-semibold ${assignment.active ? 'text-brand-700' : 'text-slate-500'}`}>
              {assignment.active ? 'Aktif' : 'Nonaktif'}
            </span>
          </span>
        )}
        {actionButtons.map(({ action, label, Icon }) => (
          <button
            type="button"
            key={action}
            aria-label={`${label} ${assignment.title}`}
            title={label}
            onClick={() => onAction(action, assignment)}
            className={`rounded-md p-1.5 ${action === 'delete' ? 'text-slate-400 hover:bg-rose-50 hover:text-rose-600' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </button>
        ))}
      </div>
    </article>
  )
}
