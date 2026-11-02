/*
 * DATA CONTOH (statis) untuk halaman Materi dan detailnya. Endpoint kursus belum ada.
 * Saat API tersedia, ganti COURSES dengan data dari backend dengan bentuk yang sama.
 */

export interface CourseModule {
  id: number
  title: string
  type: 'video' | 'pdf'
  /** done = sudah selesai, current = sedang/siap dikerjakan, todo = belum dibuka. */
  status: 'done' | 'current' | 'todo'
}

export interface Course {
  id: number
  title: string
  /** Mata pelajaran, untuk mengelompokkan laporan per mapel. */
  subject: string
  /** Total waktu belajar bulan ini (menit). */
  studyMinutes: number
  /** Deskripsi singkat di kartu. */
  description: string
  /** Kalimat di bawah judul pada halaman detail. */
  tagline: string
  /** Nama Mentor, atau nama lembaga untuk program Lembaga Bimbingan. */
  owner: string
  rating: number
  /** Persentase progres. null = belum dimulai atau belum dibeli. */
  progress: number | null
  source: 'reguler' | 'lembaga'
  /** Khusus program Lembaga: sudah dibeli atau belum. */
  purchased?: boolean
  /** Tanggal terbit, dipakai filter "Terbaru". */
  publishedAt: string
  totalXp: number
  modules: CourseModule[]
}

export const COURSES: Course[] = [
  {
    id: 1,
    title: 'Bahasa Indonesia Lanjutan',
    subject: 'Bahasa Indonesia',
    studyMinutes: 750,
    description: 'Deskripsi Materi',
    tagline: 'Kuasai Bahasa Indonesia yang baik dan benar.',
    owner: 'Wira Admaja S. Pd',
    rating: 5,
    progress: 85,
    source: 'reguler',
    publishedAt: '2026-09-01',
    totalXp: 1000,
    modules: [
      { id: 1, title: 'Dasar Bahasa Indonesia', type: 'video', status: 'done' },
      { id: 2, title: 'Bahasa Indonesia Menengah', type: 'pdf', status: 'current' },
      { id: 3, title: 'Bahasa Indonesia Lanjutan', type: 'pdf', status: 'done' },
    ],
  },
  {
    id: 2,
    title: 'Matematika',
    subject: 'Matematika',
    studyMinutes: 0,
    description: 'Deskripsi Materi',
    tagline: 'Pahami konsep matematika dari dasar.',
    owner: 'Wira Admaja S. Pd',
    rating: 5,
    progress: null,
    source: 'reguler',
    publishedAt: '2026-10-20',
    totalXp: 1500,
    modules: [
      { id: 1, title: 'Bilangan', type: 'video', status: 'current' },
      { id: 2, title: 'Aljabar', type: 'pdf', status: 'todo' },
      { id: 3, title: 'Geometri', type: 'pdf', status: 'todo' },
      { id: 4, title: 'Statistika', type: 'video', status: 'todo' },
      { id: 5, title: 'Peluang', type: 'pdf', status: 'todo' },
    ],
  },
  {
    id: 3,
    title: 'Bahasa Inggris',
    subject: 'Bahasa Inggris',
    studyMinutes: 600,
    description: 'Deskripsi Materi',
    tagline: 'Latih kemampuan bahasa Inggris sehari-hari.',
    owner: 'Wira Admaja S. Pd',
    rating: 5,
    progress: 85,
    source: 'reguler',
    publishedAt: '2026-08-15',
    totalXp: 400,
    modules: [{ id: 1, title: 'Grammar Dasar', type: 'video', status: 'current' }],
  },
  {
    id: 4,
    title: 'Pendidikan Pancasila',
    subject: 'Pendidikan Pancasila',
    studyMinutes: 1170,
    description: 'Deskripsi Materi',
    tagline: 'Nilai-nilai Pancasila dalam kehidupan sehari-hari.',
    owner: 'Wira Admaja S. Pd',
    rating: 5,
    progress: 100,
    source: 'reguler',
    publishedAt: '2026-07-10',
    totalXp: 600,
    modules: [
      { id: 1, title: 'Sejarah Pancasila', type: 'video', status: 'done' },
      { id: 2, title: 'Pancasila sebagai Dasar Negara', type: 'pdf', status: 'done' },
    ],
  },
  {
    id: 5,
    title: 'Materi UTBK',
    subject: 'UTBK',
    studyMinutes: 0,
    description: 'Deskripsi Materi',
    tagline: '3 Modul materi utbk terbaik yang pernah ada',
    owner: 'Ruang Guru',
    rating: 4.5,
    progress: null,
    source: 'lembaga',
    purchased: false,
    publishedAt: '2026-10-25',
    totalXp: 1000,
    modules: [
      { id: 1, title: 'Tes Potensi Skolastik (TPS)', type: 'video', status: 'todo' },
      { id: 2, title: 'Tes Literasi', type: 'pdf', status: 'todo' },
      { id: 3, title: 'Penalaran Matematika', type: 'pdf', status: 'todo' },
    ],
  },
]

/** Kursus yang sudah diikuti Siswa (bukan program Lembaga yang belum dibeli). */
export function isEnrolled(course: Course): boolean {
  return course.source === 'reguler' || course.purchased === true
}

/** Format rating Indonesia: 4.5 → "4,5", 5 → "5". */
export function formatRating(rating: number): string {
  return rating.toLocaleString('id-ID', { maximumFractionDigits: 1 })
}
