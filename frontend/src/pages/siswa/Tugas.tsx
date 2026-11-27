import { ArrowLeft, ChevronRight, Clock, FileText, History, Search, Star, User } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorState, Spinner } from '../../components/ui/States'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { apiErrorMessage } from './apiErrorMessage'
import { formatDate } from '../../lib/format'
import { useApiData } from '../../lib/useApiData'
import { TASK_STATUS, subjectColor, timeFormat, type TaskStatus } from './shared'
import {
  fetchStudentAssignment,
  fetchStudentAssignments,
  submitStudentAssignment,
  type AnswerPayload,
  type StudentAssignment,
  type StudentAssignmentDetail,
} from './studentApi'

type Filter = 'all' | TaskStatus

interface Task {
  id: number
  subject: string
  kind: string | null
  title: string
  description: string
  deadline: string | null
  mentor: string
  xp: number
  status: TaskStatus
  submittedAt?: string | null
  score?: number | null
}

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

/** Response API tugas → bentuk kartu yang sudah ada. */
function toTask(assignment: StudentAssignment): Task {
  return {
    id: assignment.id,
    subject: assignment.course_title ?? 'Kursus',
    kind: assignment.kind_label,
    title: assignment.title,
    description: assignment.description ?? '',
    deadline: assignment.due_at,
    mentor: assignment.mentor_name ?? 'Mentor',
    xp: assignment.xp_points,
    status: assignment.submission.status,
    submittedAt: assignment.submission.submitted_at,
    score: assignment.submission.score,
  }
}

export default function SiswaTugas() {
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [activeId, setActiveId] = useState<number | null>(null)
  const list = useApiData(fetchStudentAssignments, [])

  const tasks = useMemo(() => (list.data ?? []).map(toTask), [list.data])

  const keyword = query.trim().toLowerCase()
  const visible = tasks
    .filter((task) => filter === 'all' || task.status === filter)
    .filter((task) => task.title.toLowerCase().includes(keyword) || task.subject.toLowerCase().includes(keyword))

  return (
    <>
      <Link to="/siswa" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Kembali ke Dashboard
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

      {list.loading && !list.data && <Spinner label="Memuat tugas…" />}
      {list.error && <ErrorState error={list.error} onRetry={list.reload} />}

      {list.data && visible.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center text-slate-500">
          Tidak ada tugas yang cocok.
        </p>
      ) : (
        <ul className="mt-8 space-y-5">
          {visible.map((task) => (
            <TaskCard key={task.id} task={task} onOpen={() => setActiveId(task.id)} />
          ))}
        </ul>
      )}

      {activeId !== null && (
        <AssignmentDialog
          assignmentId={activeId}
          onClose={() => setActiveId(null)}
          onChanged={() => list.reload()}
        />
      )}
    </>
  )
}

function TaskCard({ task, onOpen }: { task: Task; onOpen: () => void }) {
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
                {task.deadline ? `${formatDate(task.deadline)} - ${timeFormat.format(new Date(task.deadline))}` : 'Tanpa tenggat'}
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
          {task.xp > 0 && (
            <span className="flex items-center gap-2 text-blue-700">
              <Star className="h-6 w-6 fill-current" aria-hidden />+ {task.xp} XP
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col items-start gap-5 lg:items-end">
        <span className={`w-48 rounded-lg py-1.5 text-center ${status.badge}`}>{status.label}</span>
        <span className={`flex items-center gap-2 whitespace-nowrap ${pending ? 'text-red-600' : 'text-slate-300'}`}>
          <Clock className="h-5 w-5" aria-hidden />
          {pending
            ? task.deadline ? remainingLabel(task.deadline) : 'Tanpa tenggat'
            : task.score !== null && task.score !== undefined
              ? `Nilai ${task.score}`
              : `Dikumpulkan ${formatDate(task.submittedAt)}`}
        </span>
        <button
          type="button"
          onClick={onOpen}
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

/** Dialog pengerjaan tugas: soal dari API, jawaban dikirim ke backend (dinilai Mentor). */
function AssignmentDialog({
  assignmentId,
  onClose,
  onChanged,
}: {
  assignmentId: number
  onClose: () => void
  onChanged: () => void
}) {
  const [detail, setDetail] = useState<StudentAssignmentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<number, { text: string; selected: number[] }>>({})
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchStudentAssignment(assignmentId)
      .then((data) => {
        if (cancelled) return
        setDetail(data)
        setError(null)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(apiErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [assignmentId])

  const submitted = detail?.submission !== null && detail?.submission !== undefined
  const questions = detail?.questions ?? []

  const toggleOption = (questionId: number, optionId: number, multi: boolean) => {
    setAnswers((current) => {
      const existing = current[questionId] ?? { text: '', selected: [] }
      const selected = multi
        ? existing.selected.includes(optionId)
          ? existing.selected.filter((id) => id !== optionId)
          : [...existing.selected, optionId]
        : [optionId]

      return { ...current, [questionId]: { ...existing, selected } }
    })
  }

  const setText = (questionId: number, text: string) => {
    setAnswers((current) => ({ ...current, [questionId]: { text, selected: current[questionId]?.selected ?? [] } }))
  }

  const submit = async () => {
    setSaving(true)
    setError(null)
    try {
      const payload: AnswerPayload[] = questions.map((question) => ({
        question_id: question.id,
        answer_text: question.type === 'essay' ? answers[question.id]?.text ?? '' : undefined,
        selected_option_ids: question.type === 'multiple_choice' ? answers[question.id]?.selected ?? [] : undefined,
      }))
      await submitStudentAssignment(assignmentId, payload)
      setNotice('Tugas berhasil dikumpulkan.')
      onChanged()
      const refreshed = await fetchStudentAssignment(assignmentId)
      setDetail(refreshed)
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      title={detail?.title ?? 'Memuat tugas…'}
      description={detail ? `${detail.kind_label} · ${detail.course_title ?? ''}` : undefined}
      onClose={onClose}
      size="lg"
      dismissible={!saving}
      footer={
        submitted ? (
          <Button variant="secondary" onClick={onClose}>Tutup</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={saving}>Batal</Button>
            <Button onClick={submit} disabled={saving || loading || questions.length === 0}>
              {saving ? 'Mengumpulkan…' : 'Kumpulkan'}
            </Button>
          </>
        )
      }
    >
      {loading && <Spinner label="Memuat soal…" />}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
      {notice && <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status">{notice}</p>}

      {detail && (
        <div className="space-y-4">
          {detail.description && <p className="text-sm text-slate-600">{detail.description}</p>}

          {submitted && detail.submission && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">
                {detail.submission.status === 'selesai' ? `Nilai ${detail.submission.score ?? '—'}` : 'Menunggu penilaian Mentor'}
              </p>
              <p className="mt-1 text-xs text-slate-500">Dikumpulkan {formatDate(detail.submission.submitted_at)}</p>
              {detail.submission.feedback && <p className="mt-2">Feedback: {detail.submission.feedback}</p>}
            </div>
          )}

          {questions.map((question) => {
            const answer = answers[question.id] ?? { text: '', selected: [] }
            const saved = detail.submission?.answers.find((item) => item.question_id === question.id)

            return (
              <div key={question.id} className="rounded-xl border border-slate-200 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">
                    Soal {question.position} · {question.type_label}
                  </p>
                  <span className="text-xs text-slate-500">{question.points} poin</span>
                </div>
                <p className="mt-1 text-sm text-slate-700">{question.prompt}</p>

                {question.type === 'multiple_choice' && (
                  <ul className="mt-3 space-y-2">
                    {question.options.map((option) => (
                      <li key={option.id}>
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type={question.multi_select ? 'checkbox' : 'radio'}
                            name={`question-${question.id}`}
                            checked={
                              submitted
                                ? (saved?.selected_option_ids ?? []).includes(option.id)
                                : answer.selected.includes(option.id)
                            }
                            disabled={submitted}
                            onChange={() => toggleOption(question.id, option.id, question.multi_select)}
                            className="h-4 w-4 accent-blue-600"
                          />
                          {option.text}
                        </label>
                      </li>
                    ))}
                  </ul>
                )}

                {(question.type === 'essay' || question.type === 'file_upload') && (
                  <textarea
                    value={submitted ? saved?.answer_text ?? '' : answer.text}
                    onChange={(event) => setText(question.id, event.target.value)}
                    disabled={submitted}
                    rows={3}
                    maxLength={question.max_words ? question.max_words * 8 : 5000}
                    placeholder={question.type === 'file_upload' ? 'Unggah berkas belum didukung. Tulis jawaban Anda di sini.' : 'Tulis jawaban…'}
                    className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none disabled:bg-slate-50"
                  />
                )}
              </div>
            )
          })}

          {questions.length === 0 && !loading && <p className="text-sm text-slate-500">Tugas ini belum memiliki soal.</p>}
        </div>
      )}
    </Modal>
  )
}
