import { MENTOR_COURSES } from './courseData'

export type Audience = 'Siswa' | 'Karyawan'
export type LearnerStatus = 'Aktif' | 'Kurang aktif' | 'Tidak aktif'

export interface LearnerPreview {
  id: number
  name: string
  audience: Audience
  courseId: number
  status: LearnerStatus
}

export interface LearnerCourseProgress {
  title: string
  assignmentsDone: number
  assignmentsTotal: number
  progress: number
  attendancePresent: number
  attendanceTotal: number
  tasks: LearnerTaskReport[]
  attendance: LearnerAttendanceReport[]
}

export type LearnerTaskStatus = 'Selesai' | 'Dikumpulkan' | 'Terlambat' | 'Sedang dikerjakan' | 'Belum dikerjakan'

export interface LearnerTaskReport {
  title: string
  type: string
  deadline: string
  submittedAt: string | null
  status: LearnerTaskStatus
  score: number | null
}

export interface LearnerAttendanceReport {
  date: string
  session: string
  status: 'Hadir' | 'Izin' | 'Tidak hadir'
}

export interface LearnerProfilePreview {
  fullName: string
  email: string
  institution: string
  program: string
  bio: string
  studyHours: number
  courses: LearnerCourseProgress[]
}

export const LEARNER_PREVIEW: LearnerPreview[] = [
  { id: 1, name: 'Syamsul Amilien', audience: 'Karyawan', courseId: 5, status: 'Aktif' },
  { id: 2, name: 'Dentri Aprilia', audience: 'Karyawan', courseId: 1, status: 'Aktif' },
  { id: 3, name: 'Sinta Ratnasari', audience: 'Siswa', courseId: 4, status: 'Kurang aktif' },
  { id: 4, name: 'Lisa Amelia', audience: 'Siswa', courseId: 4, status: 'Aktif' },
  { id: 5, name: 'Yudha Pratama', audience: 'Karyawan', courseId: 2, status: 'Tidak aktif' },
  { id: 6, name: 'Auditya Wira A', audience: 'Siswa', courseId: 3, status: 'Aktif' },
  { id: 7, name: 'Alya Putri', audience: 'Karyawan', courseId: 1, status: 'Aktif' },
  { id: 8, name: 'Dina Maharani', audience: 'Karyawan', courseId: 2, status: 'Kurang aktif' },
  { id: 9, name: 'Nadia Safitri', audience: 'Siswa', courseId: 3, status: 'Aktif' },
  { id: 10, name: 'Rizky Pratama', audience: 'Karyawan', courseId: 1, status: 'Aktif' },
  { id: 11, name: 'Fajar Ramadhan', audience: 'Siswa', courseId: 4, status: 'Tidak aktif' },
  { id: 12, name: 'Putri Maharani', audience: 'Karyawan', courseId: 5, status: 'Kurang aktif' },
]

const PROFILE_PREVIEW: Record<number, LearnerProfilePreview> = {
  6: {
    fullName: 'Auditya Wira Atmaja',
    email: 'audityawira@example.test',
    institution: 'SMP Negeri 1 Papua',
    program: 'Kelas 9 SMP',
    bio: 'Hai, salam kenal semuanya! 👋',
    studyHours: 23,
    courses: [
      {
        title: 'Bahasa Indonesia',
        assignmentsDone: 3,
        assignmentsTotal: 4,
        progress: 85,
        attendancePresent: 4,
        attendanceTotal: 5,
        tasks: [
          { title: 'Dasar Bahasa Indonesia', type: 'Pilihan ganda', deadline: '10 Jun 2026, 23:59', submittedAt: '7 Jun 2026, 13:19', status: 'Selesai', score: 90 },
          { title: 'Bahasa Indonesia Menengah', type: 'Esai', deadline: '12 Jun 2026, 23:59', submittedAt: '10 Jun 2026, 13:19', status: 'Dikumpulkan', score: 82 },
          { title: 'Bahasa Indonesia Lanjutan', type: 'Upload file', deadline: '14 Jun 2026, 23:59', submittedAt: '16 Jun 2026, 13:19', status: 'Terlambat', score: 70 },
          { title: 'Pengenalan Puisi', type: 'Video', deadline: '14 Jun 2026, 23:59', submittedAt: null, status: 'Sedang dikerjakan', score: null },
        ],
        attendance: [
          { date: '3 Jun 2026', session: 'Mengenal teks', status: 'Hadir' },
          { date: '5 Jun 2026', session: 'Gagasan utama', status: 'Hadir' },
          { date: '8 Jun 2026', session: 'Struktur paragraf', status: 'Izin' },
          { date: '10 Jun 2026', session: 'Menulis efektif', status: 'Hadir' },
          { date: '12 Jun 2026', session: 'Diskusi kelas', status: 'Hadir' },
        ],
      },
      {
        title: 'Matematika',
        assignmentsDone: 3,
        assignmentsTotal: 4,
        progress: 60,
        attendancePresent: 3,
        attendanceTotal: 4,
        tasks: [
          { title: 'Operasi bilangan', type: 'Kuis', deadline: '11 Jun 2026, 23:59', submittedAt: '10 Jun 2026, 14:00', status: 'Selesai', score: 88 },
          { title: 'Pecahan dan desimal', type: 'Latihan', deadline: '14 Jun 2026, 23:59', submittedAt: '13 Jun 2026, 15:10', status: 'Dikumpulkan', score: 78 },
          { title: 'Persamaan sederhana', type: 'Esai', deadline: '17 Jun 2026, 23:59', submittedAt: '19 Jun 2026, 09:00', status: 'Terlambat', score: 65 },
          { title: 'Latihan aljabar', type: 'Kuis', deadline: '20 Jun 2026, 23:59', submittedAt: null, status: 'Belum dikerjakan', score: null },
        ],
        attendance: [
          { date: '4 Jun 2026', session: 'Operasi bilangan', status: 'Hadir' },
          { date: '9 Jun 2026', session: 'Pecahan', status: 'Tidak hadir' },
          { date: '13 Jun 2026', session: 'Aljabar', status: 'Hadir' },
          { date: '18 Jun 2026', session: 'Persamaan', status: 'Hadir' },
        ],
      },
      {
        title: 'Sejarah Indonesia',
        assignmentsDone: 3,
        assignmentsTotal: 4,
        progress: 10,
        attendancePresent: 2,
        attendanceTotal: 4,
        tasks: [
          { title: 'Masa kerajaan Nusantara', type: 'Pilihan ganda', deadline: '12 Jun 2026, 23:59', submittedAt: '11 Jun 2026, 10:00', status: 'Selesai', score: 92 },
          { title: 'Tokoh kemerdekaan', type: 'Esai', deadline: '16 Jun 2026, 23:59', submittedAt: '18 Jun 2026, 10:20', status: 'Terlambat', score: 72 },
          { title: 'Garis waktu sejarah', type: 'Upload file', deadline: '20 Jun 2026, 23:59', submittedAt: '19 Jun 2026, 16:00', status: 'Dikumpulkan', score: 84 },
          { title: 'Refleksi pembelajaran', type: 'Esai', deadline: '22 Jun 2026, 23:59', submittedAt: null, status: 'Sedang dikerjakan', score: null },
        ],
        attendance: [
          { date: '6 Jun 2026', session: 'Kerajaan Nusantara', status: 'Hadir' },
          { date: '11 Jun 2026', session: 'Kolonialisme', status: 'Tidak hadir' },
          { date: '15 Jun 2026', session: 'Perjuangan kemerdekaan', status: 'Izin' },
          { date: '19 Jun 2026', session: 'Sejarah modern', status: 'Hadir' },
        ],
      },
      {
        title: 'Ilmu Pengetahuan Alam',
        assignmentsDone: 3,
        assignmentsTotal: 4,
        progress: 35,
        attendancePresent: 4,
        attendanceTotal: 4,
        tasks: [
          { title: 'Sistem organ manusia', type: 'Kuis', deadline: '13 Jun 2026, 23:59', submittedAt: '12 Jun 2026, 11:15', status: 'Selesai', score: 86 },
          { title: 'Ekosistem', type: 'Upload file', deadline: '17 Jun 2026, 23:59', submittedAt: '16 Jun 2026, 15:45', status: 'Dikumpulkan', score: 80 },
          { title: 'Perubahan wujud benda', type: 'Pilihan ganda', deadline: '21 Jun 2026, 23:59', submittedAt: '23 Jun 2026, 08:00', status: 'Terlambat', score: 68 },
          { title: 'Praktikum sederhana', type: 'Laporan', deadline: '25 Jun 2026, 23:59', submittedAt: null, status: 'Belum dikerjakan', score: null },
        ],
        attendance: [
          { date: '7 Jun 2026', session: 'Sistem organ', status: 'Hadir' },
          { date: '12 Jun 2026', session: 'Ekosistem', status: 'Hadir' },
          { date: '17 Jun 2026', session: 'Materi dan energi', status: 'Hadir' },
          { date: '22 Jun 2026', session: 'Praktikum IPA', status: 'Hadir' },
        ],
      },
    ],
  },
}

export function getLearnerProfile(learner: LearnerPreview): LearnerProfilePreview {
  const knownProfile = PROFILE_PREVIEW[learner.id]
  if (knownProfile) return knownProfile

  const course = MENTOR_COURSES.find((item) => item.id === learner.courseId)
  const slug = learner.name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '')
  const progress = learner.status === 'Aktif' ? 75 : learner.status === 'Kurang aktif' ? 50 : 25
  const courseTitle = course?.title ?? 'Program belum ditentukan'
  return {
    fullName: learner.name,
    email: `${slug}@example.test`,
    institution: learner.audience === 'Siswa' ? 'Sekolah contoh' : 'Instansi contoh',
    program: courseTitle,
    bio: 'Belum ada bio peserta.',
    studyHours: learner.status === 'Aktif' ? 12 : 4,
    courses: course ? [{
      title: course.title,
      assignmentsDone: 3,
      assignmentsTotal: 4,
      progress,
      attendancePresent: learner.status === 'Aktif' ? 4 : learner.status === 'Kurang aktif' ? 2 : 1,
      attendanceTotal: 4,
      tasks: [
        { title: `${courseTitle} - Tugas 1`, type: 'Kuis', deadline: '10 Jun 2026, 23:59', submittedAt: '9 Jun 2026, 14:00', status: 'Selesai', score: 85 },
        { title: `${courseTitle} - Tugas 2`, type: 'Esai', deadline: '14 Jun 2026, 23:59', submittedAt: '13 Jun 2026, 16:00', status: 'Dikumpulkan', score: 78 },
        { title: `${courseTitle} - Tugas 3`, type: 'Upload file', deadline: '18 Jun 2026, 23:59', submittedAt: '20 Jun 2026, 09:00', status: 'Terlambat', score: 68 },
        { title: `${courseTitle} - Tugas 4`, type: 'Latihan', deadline: '22 Jun 2026, 23:59', submittedAt: null, status: learner.status === 'Aktif' ? 'Sedang dikerjakan' : 'Belum dikerjakan', score: null },
      ],
      attendance: [
        { date: '5 Jun 2026', session: 'Pertemuan 1', status: 'Hadir' },
        { date: '10 Jun 2026', session: 'Pertemuan 2', status: learner.status === 'Tidak aktif' ? 'Tidak hadir' : 'Hadir' },
        { date: '15 Jun 2026', session: 'Pertemuan 3', status: learner.status === 'Aktif' ? 'Hadir' : 'Izin' },
        { date: '20 Jun 2026', session: 'Pertemuan 4', status: learner.status === 'Aktif' ? 'Hadir' : 'Tidak hadir' },
      ],
    }] : [],
  }
}
