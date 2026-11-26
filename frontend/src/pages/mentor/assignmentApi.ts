import type { Course, CourseType } from '../../features/courses/types'
import { api } from '../../lib/api'
import type { Paginated } from '../../types'

/** Tipe & pemetaan data tugas/kuis/ujian dari API (docs/api-tugas.md). */

export type QuestionKind = 'Tugas' | 'Kuis' | 'Ujian'
export type QuestionFormat = 'Mix' | 'Essay' | 'Pilihan ganda' | 'Upload file'
export type QuestionType = Exclude<QuestionFormat, 'Mix'>
export type ApprovalStatus = 'Tersedia' | 'Menunggu persetujuan' | 'Ditolak' | 'Draf'

export interface AssignmentQuestionPreview {
  id: number
  type: QuestionType
  prompt: string
  options: { id: number; text: string }[]
  correctOptionIds: number[]
  points: number
}

export interface AssignmentPreview {
  id: number
  title: string
  courseId: number
  courseTitle: string
  kind: QuestionKind
  format: QuestionFormat
  approval: ApprovalStatus
  active: boolean
  description: string
  startsAt: string
  dueAt: string
  allowLate: boolean
  latePenalty: number | null
  maxScore: number | null
  questions: AssignmentQuestionPreview[]
}

export interface SubmissionQuestionPreview {
  id: number
  type: QuestionType
  prompt: string
  points: number
  maxPoints: number
  answer: string
  options?: { label: string; text: string; correct?: boolean; selected?: boolean }[]
  fileName?: string
}

export interface SubmissionPreview {
  id: number
  audience: 'Siswa' | 'Karyawan'
  studentName: string
  assignmentTitle: string
  courseTitle: string
  submittedAt: string
  status: 'Belum dinilai' | 'Sudah dinilai'
  score: number | null
  feedback: string
  questions: SubmissionQuestionPreview[]
}

export interface MentorCourseOption {
  id: number
  title: string
  type: CourseType
}

interface ApiQuestion {
  id: number
  type: 'multiple_choice' | 'essay' | 'file_upload'
  type_label: string
  prompt: string
  options: { id: number; text: string }[]
  correct_option_ids: number[]
  points: number
}

interface ApiAssignment {
  id: number
  course_id: number
  course?: { id: number; title: string }
  title: string
  description: string | null
  kind: 'task' | 'quiz' | 'exam'
  format: QuestionFormat | null
  status: 'draft' | 'pending' | 'approved' | 'rejected'
  is_active: boolean
  starts_at: string | null
  due_at: string | null
  allow_late: boolean
  late_penalty: number | null
  max_score: number | null
  questions?: ApiQuestion[]
}

interface ApiAnswer {
  question_id: number
  answer_text: string | null
  selected_option_ids: number[]
  file_name: string | null
  points_awarded: number | null
  question?: ApiQuestion
}

interface ApiSubmission {
  id: number
  submitted_at: string
  status: 'submitted' | 'graded'
  score: number | null
  feedback: string | null
  user: { id: number; name: string } | null
  assignment: { id: number; title: string; course_id: number; course_title: string | null; course_type: CourseType | null } | null
  answers: ApiAnswer[]
}

const KIND_LABELS: Record<ApiAssignment['kind'], QuestionKind> = {
  task: 'Tugas',
  quiz: 'Kuis',
  exam: 'Ujian',
}

const KIND_VALUES: Record<QuestionKind, ApiAssignment['kind']> = {
  Tugas: 'task',
  Kuis: 'quiz',
  Ujian: 'exam',
}

const STATUS_LABELS: Record<ApiAssignment['status'], ApprovalStatus> = {
  approved: 'Tersedia',
  pending: 'Menunggu persetujuan',
  rejected: 'Ditolak',
  draft: 'Draf',
}

const QUESTION_TYPE_LABELS: Record<ApiQuestion['type'], QuestionType> = {
  multiple_choice: 'Pilihan ganda',
  essay: 'Essay',
  file_upload: 'Upload file',
}

const QUESTION_TYPE_VALUES: Record<QuestionType, ApiQuestion['type']> = {
  'Pilihan ganda': 'multiple_choice',
  Essay: 'essay',
  'Upload file': 'file_upload',
}

function toQuestion(question: ApiQuestion): AssignmentQuestionPreview {
  return {
    id: question.id,
    type: QUESTION_TYPE_LABELS[question.type],
    prompt: question.prompt,
    options: question.options ?? [],
    correctOptionIds: question.correct_option_ids ?? [],
    points: question.points,
  }
}

function dateInput(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function toAssignment(assignment: ApiAssignment): AssignmentPreview {
  return {
    id: assignment.id,
    title: assignment.title,
    courseId: assignment.course_id,
    courseTitle: assignment.course?.title ?? '—',
    kind: KIND_LABELS[assignment.kind],
    // Format dihitung backend dari tipe soal; tugas tanpa soal belum punya format.
    format: assignment.format ?? 'Mix',
    approval: STATUS_LABELS[assignment.status],
    active: assignment.is_active,
    description: assignment.description ?? '',
    startsAt: dateInput(assignment.starts_at),
    dueAt: dateInput(assignment.due_at),
    allowLate: assignment.allow_late,
    latePenalty: assignment.late_penalty,
    maxScore: assignment.max_score,
    questions: (assignment.questions ?? []).map(toQuestion),
  }
}

export async function fetchAssignmentCourses(): Promise<MentorCourseOption[]> {
  const courses = (await api.get<Paginated<Course>>('/courses', { params: { per_page: 100 } })).data.data

  return courses
    .filter((course) => course.type !== 'institution')
    .map((course) => ({ id: course.id, title: course.title, type: course.type }))
}

export async function fetchAssignments(): Promise<AssignmentPreview[]> {
  const assignments = (
    await api.get<Paginated<ApiAssignment>>('/assignments', { params: { per_page: 100 } })
  ).data.data

  return assignments.map(toAssignment)
}

export async function setAssignmentActive(id: number, active: boolean): Promise<void> {
  await api.patch(`/assignments/${id}/activation`, { is_active: active })
}

export interface AssignmentQuestionInput {
  type: QuestionType
  prompt: string
  options: { id: number; text: string }[]
  correctOptionIds: number[]
  multiSelect: boolean
  maxWords: number
  allowedFileTypes: string[]
  maxFileSizeMb: number
  maxFiles: number
  score: number
}

export interface AssignmentInput {
  title: string
  description: string
  kind: QuestionKind
  startsAt: string
  dueAt: string
  allowLate: boolean
  latePenalty: number | null
  maxScore: number | null
  questions: AssignmentQuestionInput[]
}

function assignmentBody(input: AssignmentInput) {
  return {
    title: input.title,
    description: input.description || null,
    kind: KIND_VALUES[input.kind],
    starts_at: input.startsAt || null,
    due_at: input.dueAt || null,
    allow_late: input.allowLate,
    late_penalty: input.allowLate ? input.latePenalty : null,
    max_score: input.maxScore,
    questions: input.questions.map((question) => ({
      type: QUESTION_TYPE_VALUES[question.type],
      prompt: question.prompt,
      options: question.type === 'Pilihan ganda' ? question.options.filter((option) => option.text.trim() !== '') : [],
      correct_option_ids: question.type === 'Pilihan ganda' ? question.correctOptionIds : [],
      multi_select: question.multiSelect,
      max_words: question.type === 'Essay' ? question.maxWords : null,
      allowed_file_types: question.type === 'Upload file' ? question.allowedFileTypes : [],
      max_file_size_mb: question.type === 'Upload file' ? question.maxFileSizeMb : null,
      max_files: question.type === 'Upload file' ? question.maxFiles : null,
      points: question.score,
    })),
  }
}

export async function createAssignment(courseId: number, input: AssignmentInput): Promise<void> {
  await api.post(`/courses/${courseId}/assignments`, assignmentBody(input))
}

export async function updateAssignment(id: number, input: AssignmentInput): Promise<void> {
  await api.patch(`/assignments/${id}`, assignmentBody(input))
}

export async function deleteAssignment(id: number): Promise<void> {
  await api.delete(`/assignments/${id}`)
}

function formatSubmittedAt(iso: string): string {
  const date = new Date(iso)
  const day = date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  return `${day}, ${time}`
}

function toSubmissionQuestion(answer: ApiAnswer): SubmissionQuestionPreview {
  const question = answer.question
  if (!question) {
    return { id: answer.question_id, type: 'Essay', prompt: '', points: answer.points_awarded ?? 0, maxPoints: 0, answer: answer.answer_text ?? '' }
  }

  const type = QUESTION_TYPE_LABELS[question.type]
  const selected = answer.selected_option_ids ?? []
  const correct = question.correct_option_ids ?? []

  if (type === 'Pilihan ganda') {
    const options = (question.options ?? []).map((option, index) => ({
      label: String.fromCharCode(65 + index),
      text: option.text,
      correct: correct.includes(option.id),
      selected: selected.includes(option.id),
    }))

    return {
      id: question.id,
      type,
      prompt: question.prompt,
      points: answer.points_awarded ?? 0,
      maxPoints: question.points,
      answer: options.filter((option) => option.selected).map((option) => option.label).join(', ') || '—',
      options,
    }
  }

  if (type === 'Upload file') {
    return {
      id: question.id,
      type,
      prompt: question.prompt,
      points: answer.points_awarded ?? 0,
      maxPoints: question.points,
      answer: answer.file_name ?? 'Berkas peserta',
      fileName: answer.file_name ?? 'Berkas peserta',
    }
  }

  return {
    id: question.id,
    type,
    prompt: question.prompt,
    points: answer.points_awarded ?? 0,
    maxPoints: question.points,
    answer: answer.answer_text ?? '',
  }
}

function toSubmission(submission: ApiSubmission): SubmissionPreview {
  const courseType = submission.assignment?.course_type ?? 'academic'

  return {
    id: submission.id,
    audience: courseType === 'training' || courseType === 'webinar' ? 'Karyawan' : 'Siswa',
    studentName: submission.user?.name ?? 'Peserta',
    assignmentTitle: submission.assignment?.title ?? 'Tugas',
    courseTitle: submission.assignment?.course_title ?? '—',
    submittedAt: formatSubmittedAt(submission.submitted_at),
    status: submission.status === 'graded' ? 'Sudah dinilai' : 'Belum dinilai',
    score: submission.score,
    feedback: submission.feedback ?? '',
    questions: submission.answers.map(toSubmissionQuestion),
  }
}

/** Semua pengumpulan dari tugas yang diampu Mentor (satu permintaan per tugas). */
export async function fetchSubmissions(): Promise<SubmissionPreview[]> {
  const assignments = (await api.get<Paginated<ApiAssignment>>('/assignments', { params: { per_page: 100 } })).data.data

  const perAssignment = await Promise.all(assignments.map(async (assignment) => {
    const submissions = (
      await api.get<Paginated<ApiSubmission>>(`/assignments/${assignment.id}/submissions`, { params: { per_page: 100 } })
    ).data.data

    return submissions.map(toSubmission)
  }))

  return perAssignment.flat().sort((a, b) => a.studentName.localeCompare(b.studentName, 'id-ID'))
}

export async function gradeSubmission(
  id: number,
  input: { score: number; feedback: string; answers: { question_id: number; points_awarded: number }[] },
): Promise<void> {
  await api.patch(`/submissions/${id}`, {
    score: input.score,
    feedback: input.feedback || null,
    answers: input.answers,
  })
}
