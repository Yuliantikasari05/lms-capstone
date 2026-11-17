export type QuestionKind = 'Tugas' | 'Kuis' | 'Ujian'
export type QuestionFormat = 'Mix' | 'Essay' | 'Pilihan ganda' | 'Upload file'
export type ApprovalStatus = 'Tersedia' | 'Menunggu persetujuan'

export interface AssignmentPreview {
  id: number
  title: string
  courseId: number
  kind: QuestionKind
  format: QuestionFormat
  approval: ApprovalStatus
  active: boolean
}

export const INITIAL_ASSIGNMENTS: AssignmentPreview[] = [
  { id: 1, title: 'Tugas 1: Ejaan dalam bahasa Indonesia', courseId: 3, kind: 'Tugas', format: 'Mix', approval: 'Tersedia', active: true },
  { id: 2, title: 'Kuis 3: Membuat API Google Meet', courseId: 1, kind: 'Kuis', format: 'Essay', approval: 'Tersedia', active: true },
  { id: 3, title: 'Ujian Materi 3 Fullstack', courseId: 1, kind: 'Ujian', format: 'Mix', approval: 'Menunggu persetujuan', active: false },
  { id: 4, title: 'Tugas 1: Ejaan dalam bahasa Indonesia', courseId: 3, kind: 'Tugas', format: 'Pilihan ganda', approval: 'Tersedia', active: false },
  { id: 5, title: 'Kuis: Struktur basis data', courseId: 1, kind: 'Kuis', format: 'Pilihan ganda', approval: 'Tersedia', active: true },
  { id: 6, title: 'Tugas: Analisis keamanan jaringan', courseId: 2, kind: 'Tugas', format: 'Upload file', approval: 'Tersedia', active: false },
  { id: 7, title: 'Ujian akhir: Operasi bilangan', courseId: 4, kind: 'Ujian', format: 'Mix', approval: 'Menunggu persetujuan', active: false },
  { id: 8, title: 'Kuis: Rumus dan fungsi Excel', courseId: 5, kind: 'Kuis', format: 'Pilihan ganda', approval: 'Tersedia', active: true },
  { id: 9, title: 'Ujian: Ejaan dan tanda baca', courseId: 3, kind: 'Ujian', format: 'Mix', approval: 'Tersedia', active: true },
  { id: 10, title: 'Ujian: Dasar pengembangan web', courseId: 1, kind: 'Ujian', format: 'Mix', approval: 'Tersedia', active: true },
]

let assignments = INITIAL_ASSIGNMENTS
const assignmentListeners = new Set<() => void>()

export function getAssignments() {
  return assignments
}

export function subscribeAssignments(listener: () => void) {
  assignmentListeners.add(listener)
  return () => assignmentListeners.delete(listener)
}

export function setAssignmentActive(id: number, active: boolean) {
  assignments = assignments.map((assignment) =>
    assignment.id === id ? { ...assignment, active } : assignment,
  )
  assignmentListeners.forEach((listener) => listener())
}
