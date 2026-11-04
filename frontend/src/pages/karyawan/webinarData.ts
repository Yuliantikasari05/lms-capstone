import type { CourseMaterial, TrainingModule } from './pelatihanData'

/** Waktu N hari dari hari ini (jam lokal). Dipakai data contoh agar tanggalnya selalu relevan. */
function daysFromNow(days: number, hours: number, minutes: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  date.setHours(hours, minutes, 0, 0)
  return date.toISOString()
}

export interface Webinar {
  id: number
  title: string
  tagline: string
  /** Kategori, tampil sebagai label di kartu dan halaman detail. */
  category: string
  speaker: string
  speakerTitle: string
  price: number
  rating: number
  /** Sudah dibayar. Materi dan sesi hanya terbuka setelah webinar dibayar. */
  purchased: boolean
  /** Syarat nilai dan kehadiran terpenuhi; tombol Ajukan sertifikat baru aktif bila true. Nanti dihitung backend. */
  certificateEligible: boolean
  start: string
  end: string
  modules: TrainingModule[]
  materials: CourseMaterial[]
}

/*
 * DATA CONTOH (statis), tanggalnya relatif terhadap hari ini. Akses Karyawan ke API kursus belum ada.
 * Saat API tersedia, ganti WEBINARS dengan data dari backend dengan bentuk yang sama.
 */
export const WEBINARS: Webinar[] = [
  {
    id: 1,
    title: 'Strategi Leadership',
    tagline: 'Susun strategi memimpin tim di tengah perubahan.',
    category: 'Kepemimpinan',
    speaker: 'Dr. Kabulator Sensor',
    speakerTitle: 'Grandmaster',
    price: 150000,
    rating: 4.9,
    purchased: false,
    certificateEligible: false,
    start: daysFromNow(1, 10, 0),
    end: daysFromNow(1, 11, 30),
    modules: [
      { id: 1, title: 'Dasar strategi kepemimpinan', durationMinutes: 30, status: 'locked' },
      { id: 2, title: 'Studi kasus perusahaan', durationMinutes: 60, status: 'locked' },
    ],
    materials: [
      { id: 1, name: 'Strategi-leadership-slides.pdf', sizeMb: 2.5 },
      { id: 2, name: 'Studi-kasus-leadership.pdf', sizeMb: 1.8 },
    ],
  },
  {
    id: 2,
    title: 'Advanced Data Compliance',
    tagline: 'Pahami kepatuhan data untuk kebutuhan perusahaan.',
    category: 'Teknisi',
    speaker: 'Dr. Kabulator Sensor',
    speakerTitle: 'Grandmaster',
    price: 150000,
    rating: 4.8,
    purchased: false,
    certificateEligible: false,
    start: daysFromNow(4, 10, 0),
    end: daysFromNow(4, 12, 0),
    modules: [
      { id: 1, title: 'Regulasi perlindungan data', durationMinutes: 45, status: 'locked' },
      { id: 2, title: 'Audit kepatuhan data', durationMinutes: 75, status: 'locked' },
    ],
    materials: [{ id: 1, name: 'Data-compliance-slides.pdf', sizeMb: 3.2 }],
  },
  {
    id: 3,
    title: 'Kepemimpinan Digital',
    tagline: 'Pimpin tim dengan memanfaatkan teknologi digital.',
    category: 'Kepemimpinan',
    speaker: 'Ahmad Dani',
    speakerTitle: 'HR',
    price: 150000,
    rating: 4.9,
    purchased: true,
    certificateEligible: false,
    start: daysFromNow(7, 9, 0),
    end: daysFromNow(7, 10, 30),
    modules: [
      { id: 1, title: 'Pengenalan Leadership', durationMinutes: 30, status: 'current' },
      { id: 2, title: 'Leadership di era digital', durationMinutes: 65, status: 'current' },
    ],
    materials: [
      { id: 1, name: 'Pengenalan-leadership-slides.pdf', sizeMb: 2.5 },
      { id: 2, name: 'Leadership-digital-slides.pdf', sizeMb: 2.5 },
      { id: 3, name: 'Panduan-kepemimpinan-digital.pdf', sizeMb: 2.5 },
    ],
  },
]

/** Tombol Bergabung aktif mulai 15 menit sebelum sesi dimulai sampai sesi selesai. */
export function canJoin(webinar: Webinar, now = Date.now()): boolean {
  return now >= Date.parse(webinar.start) - 15 * 60 * 1000 && now <= Date.parse(webinar.end)
}

const wibTime = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })

/** Contoh: "10:00 - 11:30 WIB". */
export function timeRange(webinar: Webinar): string {
  return `${wibTime.format(new Date(webinar.start))} - ${wibTime.format(new Date(webinar.end))} WIB`
}
