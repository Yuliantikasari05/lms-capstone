import { API_BASE_URL, api } from '../../lib/api'

/*
 * Penghubung halaman Siswa ke API belajar (backend/routes/api/learning.php).
 * Semua bentuk data di sini mengikuti response backend; halaman memetakannya ke
 * bentuk tampilan yang sudah ada agar markup tidak berubah.
 */

export interface StudentSummaryProgress {
  course_id: number
  course_title: string
  modules_done: number
  modules_total: number
  materials_done: number
  materials_total: number
  percent: number
}

export interface StudentSession {
  id: number
  title: string
  description: string | null
  course_id: number
  course_title: string | null
  mentor_name: string | null
  starts_at: string
  ends_at: string | null
  mode: 'online' | 'offline'
  location: string | null
  schedule_status: string
  time_status: 'upcoming' | 'ongoing' | 'finished'
  can_join: boolean
  joined: boolean
}

export interface StudentLeaderboardRow {
  rank: number
  user_id: number
  name: string
  xp: number
  is_me: boolean
}

export interface StudentSummary {
  progress: StudentSummaryProgress | null
  streak: { days: number }
  level: { total_xp: number; level: string | null; xp_to_next: number | null; next_level: string | null }
  upcoming_sessions: StudentSession[]
  leaderboard: StudentLeaderboardRow[]
  courses_total: number
  courses_completed: number
  assignments_pending: number
  active_days_this_month: number
}

export interface StudentCourse {
  id: number
  title: string
  description: string | null
  type: string
  type_label: string
  source: 'reguler' | 'lembaga'
  owner: string
  modules_count: number
  materials_count: number
  materials_done: number
  progress: number
  sessions_count: number
  total_xp: number
  earned_xp: number
  study_minutes_this_month: number
  published_at: string | null
  modules: { id: number; title: string; materials_count: number; completed: boolean }[]
}

export interface StudentMaterial {
  id: number
  title: string
  description: string | null
  type: 'video' | 'pdf' | 'document' | 'link'
  type_label: string
  duration_minutes: number | null
  xp_points: number
  completed: boolean
  completed_at: string | null
  has_file: boolean
  external_url: string | null
}

export interface StudentCourseModule {
  id: number
  title: string
  description: string | null
  materials: StudentMaterial[]
  completed: boolean
}

export interface StudentCourseDetail {
  id: number
  title: string
  description: string | null
  type: string
  type_label: string
  source: 'reguler' | 'lembaga'
  owner: string
  progress: number
  materials_done: number
  materials_total: number
  modules_done: number
  modules_total: number
  total_xp: number
  earned_xp: number
  study_minutes_this_month: number
  modules: StudentCourseModule[]
  sessions: StudentSession[]
}

export interface StudentSubmissionState {
  status: 'belum' | 'dikumpulkan' | 'selesai'
  label: string
  submitted_at: string | null
  score: number | null
  is_late: boolean
  feedback: string | null
}

export interface StudentAssignment {
  id: number
  title: string
  description: string | null
  kind: 'task' | 'quiz' | 'exam'
  kind_label: string
  course_id: number
  course_title: string | null
  mentor_name: string | null
  starts_at: string | null
  due_at: string | null
  allow_late: boolean
  xp_points: number
  max_score: number | null
  questions_count?: number
  submission: StudentSubmissionState
}

export interface StudentQuestion {
  id: number
  type: 'multiple_choice' | 'essay' | 'file_upload'
  type_label: string
  prompt: string
  options: { id: number; text: string }[]
  multi_select: boolean
  max_words: number | null
  points: number
  position: number
}

export interface StudentAssignmentDetail extends Omit<StudentAssignment, 'submission'> {
  late_penalty: number | null
  questions: StudentQuestion[]
  submission: (StudentSubmissionState & {
    id: number
    answers: { question_id: number; answer_text: string | null; selected_option_ids: number[]; points_awarded: number | null }[]
  }) | null
}

export interface StudentScheduleAssignment {
  id: number
  type: 'tugas'
  title: string
  kind: string
  kind_label: string
  course_id: number
  course_title: string | null
  due_at: string
  submission: StudentSubmissionState
}

export interface StudentSchedule {
  sessions: StudentSession[]
  assignments: StudentScheduleAssignment[]
}

export interface StudentReportSubject {
  course_id: number
  subject: string
  progress: number
  submitted: number
  total: number
  average: number | null
  minutes: number
}

export interface StudentReportMonth {
  month: string
  label: string
  minutes: number
  hours: number
  active_days: number
}

export interface StudentReportTask {
  id: number
  title: string
  subject: string | null
  kind: string
  kind_label: string
  due_at: string | null
  xp_points: number
  state: StudentSubmissionState
}

export interface StudentReportSession {
  id: number
  title: string
  course_title: string | null
  mentor_name: string | null
  starts_at: string | null
  ends_at: string | null
  attended: boolean
}

export interface StudentReportAchievement {
  type: 'course_completed' | 'best_score' | 'first_submission'
  title: string
  achieved_at: string | null
}

export interface StudentReport {
  month: string
  month_label: string
  study_minutes: number
  study_hours: number
  active_days: number
  courses_count: number
  attendance_percent: number | null
  modules_done: number
  modules_total: number
  assignments_submitted: number
  assignments_total: number
  average_score: number | null
  xp_earned: number
  xp_total: number
  subjects: StudentReportSubject[]
  months: StudentReportMonth[]
  tasks: StudentReportTask[]
  sessions: StudentReportSession[]
  achievements: StudentReportAchievement[]
}

export type AnswerPayload = { question_id: number; answer_text?: string; selected_option_ids?: number[] }

const unwrap = <T>(response: { data: { data: T } }): T => response.data.data

export async function fetchStudentSummary(): Promise<StudentSummary> {
  return unwrap(await api.get<{ data: StudentSummary }>('/siswa/summary'))
}

export async function fetchStudentCourses(): Promise<StudentCourse[]> {
  return unwrap(await api.get<{ data: StudentCourse[] }>('/siswa/courses'))
}

export async function fetchStudentCourse(courseId: string | number): Promise<StudentCourseDetail> {
  return unwrap(await api.get<{ data: StudentCourseDetail }>(`/siswa/courses/${courseId}`))
}

export async function completeMaterial(materialId: number): Promise<{ completed: boolean; xp_awarded: number; total_xp: number }> {
  return unwrap(await api.post<{ data: { completed: boolean; xp_awarded: number; total_xp: number } }>(`/siswa/materials/${materialId}/complete`))
}

/** Sinyal waktu belajar: dipanggil sekali per menit selama halaman materi terbuka. */
export async function recordStudyMinute(materialId: number): Promise<number> {
  const data = unwrap(await api.post<{ data: { minutes_today: number } }>(`/siswa/materials/${materialId}/study`))
  return data.minutes_today
}

export async function fetchStudentAssignments(): Promise<StudentAssignment[]> {
  return unwrap(await api.get<{ data: StudentAssignment[] }>('/siswa/assignments'))
}

export async function fetchStudentAssignment(id: number): Promise<StudentAssignmentDetail> {
  return unwrap(await api.get<{ data: StudentAssignmentDetail }>(`/siswa/assignments/${id}`))
}

export async function submitStudentAssignment(id: number, answers: AnswerPayload[]): Promise<{ id: number; submitted_at: string }> {
  const response = await api.post<{ data: { id: number; submitted_at: string }; message?: string }>(`/siswa/assignments/${id}/submissions`, { answers })
  return response.data.data
}

export async function fetchStudentSchedule(): Promise<StudentSchedule> {
  return unwrap(await api.get<{ data: StudentSchedule }>('/siswa/schedule'))
}

export async function joinStudentSession(sessionId: number): Promise<{ meeting_url: string | null; location: string | null; mode: string; joined_at: string }> {
  return unwrap(await api.post<{ data: { meeting_url: string | null; location: string | null; mode: string; joined_at: string } }>(`/siswa/sessions/${sessionId}/join`))
}

export async function fetchStudentReport(month?: string): Promise<StudentReport> {
  return unwrap(await api.get<{ data: StudentReport }>('/siswa/report', { params: month ? { month } : undefined }))
}

export async function fetchStudentLeaderboard(period: 'week' | 'month' | 'all'): Promise<{ rows: StudentLeaderboardRow[]; me: StudentLeaderboardRow | null }> {
  const response = await api.get<{ data: StudentLeaderboardRow[]; meta: { period: string; me: StudentLeaderboardRow | null } }>('/siswa/leaderboard', {
    params: { period },
  })
  return { rows: response.data.data, me: response.data.meta.me }
}

/** Tautan berkas materi bersifat privat: selalu diambil lewat endpoint ber-otorisasi. */
export function studentMaterialFileUrl(materialId: number): string {
  return `${API_BASE_URL}/materials/${materialId}/file`
}
