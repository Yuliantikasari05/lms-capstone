/*
 * Tipe tampilan halaman Materi. Datanya berasal dari API belajar Siswa
 * (lihat studentApi.ts); file ini hanya menyimpan bentuk dan helper tampilan.
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
  /** null = kursus belum punya ulasan (data ulasan belum tersedia dari API). */
  rating: number | null
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

/** Kursus yang sudah diikuti Siswa (semua kursus pada halaman ini berasal dari enrollment aktif). */
export function isEnrolled(course: Course): boolean {
  return course.source === 'reguler' || course.purchased === true
}

/** Format rating Indonesia: 4.5 → "4,5", 5 → "5", null → "—" (belum ada ulasan). */
export function formatRating(rating: number | null): string {
  if (rating === null) return '—'
  return rating.toLocaleString('id-ID', { maximumFractionDigits: 1 })
}
