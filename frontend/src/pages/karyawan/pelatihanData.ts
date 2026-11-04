/*
 * DATA CONTOH (statis) untuk halaman Pelatihan dan detailnya. Akses Karyawan ke API kursus belum ada.
 * Saat API tersedia, ganti TRAININGS dengan data dari backend dengan bentuk yang sama.
 */

export interface TrainingModule {
  id: number
  title: string
  durationMinutes: number
  /** done = sudah selesai, current = siap dikerjakan, locked = belum terbuka. */
  status: 'done' | 'current' | 'locked'
}

export interface CourseMaterial {
  id: number
  name: string
  sizeMb: number
}

export interface DiscussionReply {
  id: number
  author: string
  date: string
  body: string
  /** Balasan milik pengguna yang login: hanya ini yang boleh diubah dan dihapus Karyawan. */
  isMine: boolean
}

export interface Discussion {
  id: number
  title: string
  author: string
  date: string
  body: string
  likes: number
  comments: number
  replies: DiscussionReply[]
}

export interface Training {
  id: number
  title: string
  description: string
  /** Kalimat di bawah judul pada halaman detail. */
  tagline: string
  /** Tingkat pelatihan, tampil sebagai label di halaman detail. */
  level: string
  mentor: string
  price: number
  rating: number
  hours: number
  /** Sudah dibayar. Materi hanya terbuka setelah pelatihan dibayar. */
  purchased: boolean
  /** Syarat nilai dan kehadiran terpenuhi; tombol Ajukan sertifikat baru aktif bila true. Nanti dihitung backend. */
  certificateEligible: boolean
  /** Persentase kemajuan; 0 bila belum dibayar. */
  progress: number
  /** Tanggal terbit, dipakai filter "Terbaru". */
  publishedAt: string
  modules: TrainingModule[]
  /** Total waktu belajar bulan ini (menit), untuk Laporan. */
  studyMinutes: number
  /** Tugas yang sudah dikumpulkan dan jumlah seluruh tugas, untuk Laporan. */
  tasksDone: number
  tasksTotal: number
  /** Rata-rata nilai tugas dan ujian; kosong bila belum ada nilai. */
  averageScore?: number
  /** Materi pendukung di tab Resource. */
  materials: CourseMaterial[]
  /** Pertanyaan di tab Diskusi. */
  discussions: Discussion[]
}

export const TRAININGS: Training[] = [
  {
    id: 1,
    title: 'Fullstack',
    description: 'Membangun aplikasi web dari tampilan sampai server.',
    tagline: 'Kuasai pengembangan aplikasi web dari awal sampai rilis.',
    level: 'Canggih',
    mentor: 'Prabiwo',
    price: 190000,
    rating: 4.9,
    hours: 10,
    purchased: true,
    certificateEligible: false,
    progress: 80,
    publishedAt: '2026-09-10',
    studyMinutes: 360,
    tasksDone: 3,
    tasksTotal: 4,
    averageScore: 80.6,
    materials: [
      { id: 1, name: 'Introduction-to-fullstack-slides.pdf', sizeMb: 2.5 },
      { id: 2, name: 'Database-design-slides.pdf', sizeMb: 1.8 },
      { id: 3, name: 'Laravel-basics-slides.pdf', sizeMb: 2.5 },
    ],
    discussions: [
      {
        id: 1,
        title: 'Bagaimana cara Design Yang Baik dan Benar?',
        author: 'admin musang',
        date: '2012-12-12',
        body: 'cara menghapus ke-perfeksionis-an diri gimana om?',
        likes: 1000000,
        comments: 500000,
        replies: [{ id: 1, author: 'masbre', date: '2012-12-12', body: 'Minum Air Tujuh Kembang Coba', isMine: true }],
      },
      {
        id: 2,
        title: 'Kapan sebaiknya memakai database relasional?',
        author: 'Rina Lestari',
        date: '2026-10-20',
        body: 'Untuk data transaksi, apakah selalu lebih baik memakai database relasional?',
        likes: 24,
        comments: 1,
        replies: [{ id: 1, author: 'Prabiwo', date: '2026-10-21', body: 'Untuk data yang saling berelasi dan butuh konsistensi, ya.', isMine: false }],
      },
      {
        id: 3,
        title: 'Materi Laravel basics dibuka kapan?',
        author: 'Bagas Pratama',
        date: '2026-10-25',
        body: 'Modulnya masih terkunci. Apakah harus menyelesaikan Database design dulu?',
        likes: 8,
        comments: 0,
        replies: [],
      },
    ],
    modules: [
      { id: 1, title: 'Introduction to fullstack', durationMinutes: 30, status: 'done' },
      { id: 2, title: 'Database design', durationMinutes: 65, status: 'current' },
      { id: 3, title: 'Laravel basics', durationMinutes: 15, status: 'locked' },
      { id: 4, title: 'React basics', durationMinutes: 45, status: 'locked' },
      { id: 5, title: 'Deployment', durationMinutes: 40, status: 'locked' },
    ],
  },
  {
    id: 2,
    title: 'Forensik',
    description: 'Dasar investigasi dan analisis bukti digital.',
    tagline: 'Pelajari cara menelusuri dan menganalisis bukti digital.',
    level: 'Menengah',
    mentor: 'Prabiwo',
    price: 190000,
    rating: 4.9,
    hours: 10,
    purchased: true,
    certificateEligible: false,
    progress: 80,
    publishedAt: '2026-08-20',
    studyMinutes: 240,
    tasksDone: 4,
    tasksTotal: 5,
    averageScore: 88.5,
    materials: [
      { id: 1, name: 'Pengantar-forensik-slides.pdf', sizeMb: 2.5 },
      { id: 2, name: 'Panduan-analisis-log.pdf', sizeMb: 1.8 },
    ],
    discussions: [],
    modules: [
      { id: 1, title: 'Pengantar forensik digital', durationMinutes: 30, status: 'done' },
      { id: 2, title: 'Akuisisi bukti', durationMinutes: 50, status: 'done' },
      { id: 3, title: 'Analisis log', durationMinutes: 60, status: 'done' },
      { id: 4, title: 'Analisis memori', durationMinutes: 45, status: 'done' },
      { id: 5, title: 'Penulisan laporan', durationMinutes: 25, status: 'current' },
    ],
  },
  {
    id: 3,
    title: 'Pelatihan Terbaru',
    description: 'Materi terbaru untuk mengembangkan kompetensi kerja.',
    tagline: 'Tingkatkan kompetensi dengan materi terbaru.',
    level: 'Dasar',
    mentor: 'Prabiwo',
    price: 190000,
    rating: 4.9,
    hours: 10,
    purchased: false,
    certificateEligible: false,
    progress: 0,
    publishedAt: '2026-10-28',
    studyMinutes: 0,
    tasksDone: 0,
    tasksTotal: 0,
    materials: [
      { id: 1, name: 'Pengenalan-slides.pdf', sizeMb: 2.5 },
    ],
    discussions: [],
    modules: [
      { id: 1, title: 'Pengenalan', durationMinutes: 20, status: 'locked' },
      { id: 2, title: 'Konsep utama', durationMinutes: 40, status: 'locked' },
      { id: 3, title: 'Studi kasus', durationMinutes: 35, status: 'locked' },
      { id: 4, title: 'Praktik', durationMinutes: 60, status: 'locked' },
      { id: 5, title: 'Evaluasi', durationMinutes: 15, status: 'locked' },
    ],
  },
  {
    id: 4,
    title: 'Proyek Pengembangan Mandiri',
    description: 'Rencanakan dan jalankan proyek pengembangan diri.',
    tagline: 'Susun rencana pengembangan dan terapkan dalam proyek nyata.',
    level: 'Menengah',
    mentor: 'Prabiwo',
    price: 190000,
    rating: 4.8,
    hours: 8,
    purchased: true,
    certificateEligible: false,
    progress: 67,
    publishedAt: '2026-10-05',
    studyMinutes: 240,
    tasksDone: 2,
    tasksTotal: 3,
    averageScore: 85,
    materials: [
      { id: 1, name: 'Template-rencana-proyek.pdf', sizeMb: 2.5 },
      { id: 2, name: 'Contoh-laporan-proyek.pdf', sizeMb: 1.8 },
    ],
    discussions: [],
    modules: [
      { id: 1, title: 'Menetapkan tujuan', durationMinutes: 30, status: 'done' },
      { id: 2, title: 'Menyusun rencana', durationMinutes: 40, status: 'done' },
      { id: 3, title: 'Menjalankan proyek', durationMinutes: 90, status: 'done' },
      { id: 4, title: 'Memantau kemajuan', durationMinutes: 45, status: 'done' },
      { id: 5, title: 'Evaluasi proyek', durationMinutes: 60, status: 'current' },
      { id: 6, title: 'Presentasi hasil', durationMinutes: 30, status: 'locked' },
    ],
  },
  {
    id: 5,
    title: 'Kepemimpinan Tim',
    description: 'Memimpin dan menggerakkan tim secara efektif.',
    tagline: 'Bangun kemampuan memimpin tim yang solid.',
    level: 'Dasar',
    mentor: 'Prabiwo',
    price: 190000,
    rating: 4.7,
    hours: 6,
    purchased: true,
    certificateEligible: true,
    progress: 100,
    publishedAt: '2026-07-15',
    studyMinutes: 120,
    tasksDone: 2,
    tasksTotal: 2,
    averageScore: 90,
    materials: [
      { id: 1, name: 'Peran-pemimpin-slides.pdf', sizeMb: 2.5 },
    ],
    discussions: [],
    modules: [
      { id: 1, title: 'Peran pemimpin', durationMinutes: 45, status: 'done' },
      { id: 2, title: 'Komunikasi tim', durationMinutes: 60, status: 'done' },
      { id: 3, title: 'Memberi umpan balik', durationMinutes: 40, status: 'done' },
    ],
  },
]

/** Format rating Indonesia: 4.9 → "4,9". */
export function formatRating(rating: number): string {
  return rating.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}
