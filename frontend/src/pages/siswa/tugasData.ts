import { daysFromNow, type TaskStatus } from './shared'

export interface Task {
  id: number
  subject: string
  /** Jenis penilaian; null bila tidak ditampilkan. */
  kind: 'Tugas' | 'Ujian' | null
  title: string
  description: string
  deadline: string
  mentor: string
  xp: number
  status: TaskStatus
  /** Tanggal pengumpulan, untuk status dikumpulkan/selesai. */
  submittedAt?: string
  /** Nilai dari Mentor (0-100), hanya untuk status selesai. */
  score?: number
}

/*
 * DATA CONTOH (statis). Endpoint tugas belum ada.
 * Saat API tersedia, ganti TASKS dengan data dari backend dengan bentuk yang sama.
 */
export const TASKS: Task[] = [
  {
    id: 1,
    subject: 'Bahasa Indonesia',
    kind: 'Ujian',
    title: 'Tugas Materi 1 Dasar Bahasa Indonesia',
    description: 'Kerjakan Tugas ini secara cermat!',
    deadline: daysFromNow(4),
    mentor: 'Wira Admaja Sp.d',
    xp: 250,
    status: 'belum',
  },
  {
    id: 2,
    subject: 'Matematika',
    kind: 'Tugas',
    title: 'Tugas Materi 1 Matematika',
    description: 'Kerjakan Tugas ini secara cermat!',
    deadline: daysFromNow(4),
    mentor: 'Wira Admaja Sp.d',
    xp: 250,
    status: 'dikumpulkan',
    submittedAt: '2026-10-28T10:00:00',
  },
  {
    id: 3,
    subject: 'Sejarah',
    kind: 'Tugas',
    title: 'Tugas Materi 1 Sejarah',
    description: 'Kerjakan Tugas ini secara cermat!',
    deadline: daysFromNow(4),
    mentor: 'Wira Admaja Sp.d',
    xp: 250,
    status: 'selesai',
    submittedAt: '2026-10-28T10:00:00',
    score: 88.5,
  },
  {
    id: 4,
    subject: 'Bahasa Indonesia',
    kind: null,
    title: 'Tugas Materi 1 Dasar Bahasa Indonesia',
    description: 'Kerjakan Tugas ini secara cermat!',
    deadline: daysFromNow(4),
    mentor: 'Wira Admaja Sp.d',
    xp: 250,
    status: 'belum',
  },
  {
    id: 5,
    subject: 'Matematika',
    kind: 'Tugas',
    title: 'Kuis Aljabar Dasar',
    description: 'Kerjakan Tugas ini secara cermat!',
    deadline: daysFromNow(-10),
    mentor: 'Wira Admaja Sp.d',
    xp: 250,
    status: 'selesai',
    submittedAt: '2026-10-20T09:00:00',
    score: 90,
  },
  {
    id: 6,
    subject: 'Bahasa Indonesia',
    kind: 'Tugas',
    title: 'Tugas Menulis Paragraf',
    description: 'Kerjakan Tugas ini secara cermat!',
    deadline: daysFromNow(-15),
    mentor: 'Wira Admaja Sp.d',
    xp: 250,
    status: 'selesai',
    submittedAt: '2026-10-15T14:00:00',
    score: 85,
  },
]
