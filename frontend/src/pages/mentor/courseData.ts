import type { CourseType, MaterialType } from '../../features/courses/types'

export interface CourseMaterialPreview {
  id: string
  title: string
  description: string
  type: MaterialType
  durationMinutes: number | null
  xpPoints: number
  /** Tautan sumber belajar (opsional, dari API kursus). */
  externalUrl?: string | null
  /** URL berkas privat materi (opsional, butuh sesi login). */
  fileUrl?: string | null
}

export interface CourseModulePreview {
  id: number
  title: string
  description: string
  materials: CourseMaterialPreview[]
  activities?: CourseActivityPreview[]
  supportingMaterials?: SupportingMaterialPreview[]
}

export interface CourseActivityPreview {
  id: string
  title: string
  type: 'kuis' | 'tugas'
  xpPoints: number
}

export interface SupportingMaterialPreview {
  id: string
  name: string
  format: string
  size: string
}

export interface DiscussionReplyPreview {
  id: number
  name: string
  role: 'Mentor' | 'Siswa' | 'Karyawan'
  message: string
  isOwn?: boolean
}

export interface CourseDiscussionPreview {
  id: number
  name: string
  role: 'Mentor' | 'Siswa' | 'Karyawan'
  title: string
  message: string
  date: string
  likes?: number
  replies: DiscussionReplyPreview[]
  isOwn?: boolean
}

export interface CourseReviewPreview {
  id: number
  name: string
  rating: number
  message: string
  date: string
  likes: number
}

export interface MentorCoursePreview {
  id: number
  title: string
  description: string
  type: CourseType
  /** null = kursus belum punya ulasan (data ulasan belum tersedia dari API). */
  rating: number | null
  students: number
  sessions: number
  modules: CourseModulePreview[]
  discussions: CourseDiscussionPreview[]
  reviews?: CourseReviewPreview[]
}

const material = (
  id: string,
  title: string,
  description: string,
  type: MaterialType = 'video',
  durationMinutes: number | null = 15,
  xpPoints = 0,
): CourseMaterialPreview => ({ id, title, description, type, durationMinutes, xpPoints })

export const MENTOR_COURSES: MentorCoursePreview[] = [
  {
    id: 1,
    title: 'Fullstack web developer professional',
    description: 'Kuasai logika backend, arsitektur sistem, dan frontend modern.',
    type: 'training',
    rating: 5.0,
    students: 25,
    sessions: 2,
    modules: [
      {
        id: 1,
        title: 'Introduction to Fullstack',
        description: 'Kenali alur kerja fullstack dan teknologi yang akan digunakan.',
        materials: [
          material('1-1', 'Welcome & course roadmap', 'Pengenalan kursus dan gambaran materi yang akan dipelajari.', 'video', 15),
          material('1-2', 'Setting up your environment', 'Persiapan VS Code, XAMPP, Node.js, dan tools pengembangan.', 'document', 30),
          material('1-3', 'How the web works', 'Memahami browser, server, HTTP, dan alur request-response.', 'video', 45),
        ],
        activities: [{ id: '1-q1', title: 'Kuis pengenalan web', type: 'kuis', xpPoints: 0 }],
        supportingMaterials: [
          { id: 'sm-1', name: 'Introduction to fullstack-slides.pdf', format: 'PDF', size: '2.5 MB' },
        ],
      },
      {
        id: 2,
        title: 'Database Design',
        description: 'Rancang struktur data dan relasi untuk aplikasi.',
        materials: [
          material('2-1', 'Database fundamentals', 'Pengenalan database relasional dan konsep tabel.', 'video', 30),
          material('2-2', 'Entity relationship diagram', 'Menyusun entitas, atribut, dan relasi dalam ERD.', 'document', 45),
          material('2-3', 'SQL essentials', 'Latihan query SQL dasar untuk membaca dan mengubah data.', 'video', 75),
        ],
        activities: [{ id: '2-a1', title: 'Latihan rancangan basis data', type: 'tugas', xpPoints: 0 }],
        supportingMaterials: [
          { id: 'sm-2', name: 'Database design-worksheet.pdf', format: 'PDF', size: '1.8 MB' },
        ],
      },
      {
        id: 3,
        title: 'Laravel Basics',
        description: 'Bangun fondasi aplikasi backend menggunakan Laravel.',
        materials: [
          material('3-1', 'Laravel project structure', 'Mengenal struktur folder dan komponen utama Laravel.', 'video', 30),
          material('3-2', 'Routing and controllers', 'Menghubungkan request dengan controller dan response.', 'video', 45),
          material('3-3', 'Models and migrations', 'Membuat model dan mengelola perubahan skema database.', 'video', 60),
          material('3-4', 'Validation and requests', 'Memvalidasi input dengan Form Request.', 'document', 45),
        ],
        supportingMaterials: [
          { id: 'sm-3', name: 'Laravel basics-cheatsheet.pdf', format: 'PDF', size: '1.2 MB' },
        ],
      },
      {
        id: 4,
        title: 'API Development',
        description: 'Susun API yang konsisten dan integrasikan dengan frontend.',
        materials: [
          material('4-1', 'REST API fundamentals', 'Memahami resource, HTTP methods, dan status response.', 'video', 45),
          material('4-2', 'Building API resources', 'Membentuk response API yang konsisten.', 'video', 45),
          material('4-3', 'Authentication and authorization', 'Melindungi endpoint dan mengatur hak akses.', 'video', 90),
        ],
        supportingMaterials: [
          { id: 'sm-4', name: 'API development-reference.pdf', format: 'PDF', size: '2.1 MB' },
        ],
      },
    ],
    discussions: [
      {
        id: 1,
        name: 'Alya Putri',
        role: 'Karyawan',
        title: 'Urutan belajar backend dan frontend',
        message: 'Apakah sebaiknya menyelesaikan seluruh modul backend sebelum mulai mengerjakan frontend?',
        date: '18 Nov 2026',
        likes: 5,
        replies: [
          { id: 1, name: 'Yuli Antika Sari', role: 'Mentor', message: 'Sebaiknya pahami dasar backend terlebih dahulu, lalu lanjutkan frontend. Setelah itu, kita integrasikan keduanya.' },
          { id: 2, name: 'Rizky Pratama', role: 'Karyawan', message: 'Setuju, saya juga merasa lebih mudah memahami alurnya setelah mencoba API sederhana.' },
        ],
      },
      {
        id: 2,
        name: 'Rizky Pratama',
        role: 'Karyawan',
        title: 'Persiapan environment',
        message: 'Saya menggunakan Laragon. Apakah langkah setup-nya sama dengan XAMPP?',
        date: '17 Nov 2026',
        likes: 2,
        replies: [],
      },
      {
        id: 3,
        name: 'Alya Putri',
        role: 'Karyawan',
        title: 'Membaca dokumentasi API',
        message: 'Bagian mana dari dokumentasi API yang sebaiknya dibaca lebih dahulu?',
        date: '16 Nov 2026',
        likes: 3,
        replies: [],
      },
    ],
  },
  {
    id: 2,
    title: 'Cyber security fundamental',
    description: 'Pelajari dasar keamanan jaringan, enkripsi, dan ethical hacking.',
    type: 'webinar',
    rating: 4.2,
    students: 7,
    sessions: 1,
    modules: [
      {
        id: 1,
        title: 'Dasar Keamanan Informasi',
        description: 'Prinsip dasar melindungi informasi dan aset digital.',
        materials: [
          material('1-1', 'CIA triad', 'Memahami confidentiality, integrity, dan availability.', 'video', 20),
          material('1-2', 'Threats and vulnerabilities', 'Mengenali ancaman dan kerentanan sistem.', 'document', 15),
        ],
      },
      {
        id: 2,
        title: 'Keamanan Jaringan',
        description: 'Kenali komponen jaringan dan cara mengamankannya.',
        materials: [
          material('2-1', 'Network security basics', 'Pengenalan protokol dan lapisan keamanan jaringan.', 'video', 25),
          material('2-2', 'Common network attacks', 'Memahami contoh serangan jaringan untuk tujuan pencegahan.', 'video', 25),
        ],
      },
      {
        id: 3,
        title: 'Enkripsi dan Proteksi Data',
        description: 'Pelajari dasar enkripsi serta pengelolaan data yang aman.',
        materials: [
          material('3-1', 'Encryption fundamentals', 'Konsep enkripsi simetris dan asimetris.', 'video', 30),
          material('3-2', 'Protecting sensitive data', 'Praktik perlindungan data sensitif.', 'document', 15),
        ],
      },
    ],
    discussions: [
      {
        id: 1,
        name: 'Dina Maharani',
        role: 'Karyawan',
        title: 'Perbedaan hashing dan enkripsi',
        message: 'Kapan kita sebaiknya memakai hashing dibanding enkripsi?',
        date: '16 Nov 2026',
        replies: [],
      },
    ],
  },
  {
    id: 3,
    title: 'Bahasa Indonesia Lanjutan',
    description: 'Tingkatkan kemampuan memahami teks, menulis, dan berkomunikasi.',
    type: 'academic',
    rating: 4.7,
    students: 3,
    sessions: 1,
    modules: [
      {
        id: 1,
        title: 'Pemahaman Teks Lanjutan',
        description: 'Menganalisis struktur, gagasan, dan informasi dalam teks.',
        materials: [
          material('1-1', 'Mengenali gagasan utama', 'Menemukan gagasan utama dan pendukung.', 'video', 15, 10),
          material('1-2', 'Menganalisis struktur teks', 'Membedah bagian dan tujuan sebuah teks.', 'pdf', 20, 10),
        ],
        activities: [{ id: '1-q1', title: 'Kuis pemahaman teks', type: 'kuis', xpPoints: 20 }],
      },
      {
        id: 2,
        title: 'Menulis dan Menyunting',
        description: 'Menyusun tulisan yang jelas dan sesuai kaidah.',
        materials: [
          material('2-1', 'Menyusun paragraf efektif', 'Menyusun paragraf dengan ide yang runtut.', 'video', 20, 10),
          material('2-2', 'Menyunting tulisan', 'Memeriksa ejaan, tanda baca, dan pilihan kata.', 'document', 15, 10),
        ],
        activities: [{ id: '2-a1', title: 'Tugas menyunting teks', type: 'tugas', xpPoints: 40 }],
      },
      {
        id: 3,
        title: 'Presentasi dan Diskusi',
        description: 'Menyampaikan pendapat dengan runtut dan santun.',
        materials: [
          material('3-1', 'Teknik presentasi', 'Mempersiapkan materi dan menyampaikan presentasi.', 'video', 25, 10),
        ],
        activities: [{ id: '3-q1', title: 'Kuis komunikasi efektif', type: 'kuis', xpPoints: 20 }],
      },
    ],
    discussions: [
      {
        id: 1,
        name: 'Nadia Safitri',
        role: 'Siswa',
        title: 'Cara menentukan gagasan utama',
        message: 'Apakah gagasan utama selalu berada di kalimat pertama paragraf?',
        date: '15 Nov 2026',
        likes: 5,
        replies: [],
      },
      {
        id: 2,
        name: 'Bima Prakoso',
        role: 'Siswa',
        title: 'Menentukan kalimat pendukung',
        message: 'Bagaimana cara membedakan kalimat pendukung dan contoh dalam paragraf?',
        date: '14 Nov 2026',
        likes: 2,
        replies: [],
      },
      {
        id: 3,
        name: 'Citra Lestari',
        role: 'Siswa',
        title: 'Latihan menyunting tulisan',
        message: 'Apakah ada urutan pemeriksaan yang disarankan saat menyunting tulisan?',
        date: '13 Nov 2026',
        likes: 1,
        replies: [],
      },
    ],
    reviews: [
      { id: 1, name: 'Nadia Safitri', rating: 5, message: 'Materinya runtut dan contoh teksnya membantu saya memahami gagasan utama.', date: '15 Nov 2026', likes: 3 },
      { id: 2, name: 'Bima Prakoso', rating: 4, message: 'Latihannya bermanfaat. Saya ingin lebih banyak contoh untuk bagian penyuntingan.', date: '14 Nov 2026', likes: 1 },
      { id: 3, name: 'Citra Lestari', rating: 5, message: 'Penjelasan singkat dan mudah diikuti.', date: '12 Nov 2026', likes: 2 },
    ],
  },
  {
    id: 4,
    title: 'Matematika Dasar SMP',
    description: 'Penguatan konsep bilangan, aljabar, dan geometri untuk siswa SMP.',
    type: 'academic',
    rating: 4.8,
    students: 18,
    sessions: 4,
    modules: [
      { id: 1, title: 'Bilangan dan Operasinya', description: 'Operasi bilangan dan penerapannya.', materials: [material('1-1', 'Bilangan bulat', 'Operasi hitung bilangan bulat.', 'video', 15, 10), material('1-2', 'Pecahan', 'Operasi dan perbandingan pecahan.', 'pdf', 20, 10)], activities: [{ id: '1-q1', title: 'Kuis operasi bilangan', type: 'kuis', xpPoints: 20 }] },
      { id: 2, title: 'Aljabar Dasar', description: 'Variabel, bentuk aljabar, dan persamaan.', materials: [material('2-1', 'Mengenal variabel', 'Menggunakan variabel dalam bentuk aljabar.', 'video', 20, 10), material('2-2', 'Persamaan sederhana', 'Menyelesaikan persamaan satu variabel.', 'pdf', 20, 10)], activities: [{ id: '2-a1', title: 'Tugas persamaan sederhana', type: 'tugas', xpPoints: 30 }] },
    ],
    discussions: [
      {
        id: 1,
        name: 'Daffa Ramadhan',
        role: 'Siswa',
        title: 'Cara cepat membandingkan pecahan',
        message: 'Apakah ada cara praktis untuk membandingkan pecahan dengan penyebut berbeda?',
        date: '15 Nov 2026',
        likes: 4,
        replies: [],
      },
      {
        id: 2,
        name: 'Salsa Putri',
        role: 'Siswa',
        title: 'Memahami soal cerita aljabar',
        message: 'Bagaimana mengubah informasi di soal cerita menjadi persamaan?',
        date: '14 Nov 2026',
        likes: 2,
        replies: [],
      },
      {
        id: 3,
        name: 'Rafi Hidayat',
        role: 'Siswa',
        title: 'Latihan operasi bilangan',
        message: 'Saya ingin memastikan urutan operasi hitung pada soal campuran.',
        date: '13 Nov 2026',
        likes: 1,
        replies: [],
      },
    ],
    reviews: [
      { id: 1, name: 'Daffa Ramadhan', rating: 5, message: 'Contoh dan latihan membantu saya lebih percaya diri mengerjakan soal.', date: '15 Nov 2026', likes: 4 },
      { id: 2, name: 'Salsa Putri', rating: 5, message: 'Penjelasan aljabarnya mudah dipahami.', date: '14 Nov 2026', likes: 2 },
      { id: 3, name: 'Rafi Hidayat', rating: 4, message: 'Materinya bagus dan latihan bisa dikerjakan bertahap.', date: '13 Nov 2026', likes: 1 },
    ],
  },
  {
    id: 5,
    title: 'Excel untuk Karyawan',
    description: 'Pelatihan rumus dasar, pengolahan data, hingga tabel pivot.',
    type: 'training',
    rating: 4.6,
    students: 14,
    sessions: 3,
    modules: [
      { id: 1, title: 'Pengenalan Excel', description: 'Mengenal workbook, worksheet, dan antarmuka Excel.', materials: [material('1-1', 'Workspace Excel', 'Navigasi dan pengaturan dasar workbook.', 'video', 15), material('1-2', 'Mengelola data', 'Memasukkan dan merapikan data.', 'document', 15)] },
      { id: 2, title: 'Rumus dan Fungsi', description: 'Gunakan rumus untuk mempercepat pekerjaan.', materials: [material('2-1', 'Rumus dasar', 'Operasi dan referensi sel.', 'video', 20), material('2-2', 'Fungsi SUM dan IF', 'Menggunakan fungsi untuk perhitungan dan kondisi.', 'video', 25)] },
    ],
    discussions: [],
  },
]

export function courseTypeLabel(type: CourseType): string {
  switch (type) {
    case 'academic':
      return 'Kelas'
    case 'training':
      return 'Pelatihan'
    case 'webinar':
      return 'Webinar'
    case 'institution':
      return 'Program Lembaga'
  }
}

export function courseAudience(type: CourseType): 'siswa' | 'karyawan' {
  return type === 'training' || type === 'webinar' ? 'karyawan' : 'siswa'
}

export function courseMaterialCount(course: MentorCoursePreview): number {
  return course.modules.reduce((total, module) => total + module.materials.length, 0)
}

export function courseDurationMinutes(course: MentorCoursePreview): number {
  return course.modules.reduce(
    (total, module) => total + module.materials.reduce((sum, item) => sum + (item.durationMinutes ?? 0), 0),
    0,
  )
}

export function courseAllowsXp(course: MentorCoursePreview): boolean {
  return course.type === 'academic' || course.type === 'institution'
}

export function moduleXpTotal(module: CourseModulePreview): number {
  return module.materials.reduce((sum, item) => sum + item.xpPoints, 0)
    + (module.activities ?? []).reduce((sum, activity) => sum + activity.xpPoints, 0)
}

export function courseXpBreakdown(course: MentorCoursePreview): { materials: number; quizzes: number; assignments: number; total: number } {
  if (!courseAllowsXp(course)) {
    return { materials: 0, quizzes: 0, assignments: 0, total: 0 }
  }

  const breakdown = course.modules.reduce(
    (total, module) => {
      total.materials += module.materials.reduce((sum, item) => sum + item.xpPoints, 0)
      for (const activity of module.activities ?? []) {
        if (activity.type === 'kuis') total.quizzes += activity.xpPoints
        else total.assignments += activity.xpPoints
      }
      return total
    },
    { materials: 0, quizzes: 0, assignments: 0 },
  )

  return { ...breakdown, total: breakdown.materials + breakdown.quizzes + breakdown.assignments }
}
