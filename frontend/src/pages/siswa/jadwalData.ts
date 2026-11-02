import { daysFromNow, type TaskStatus } from './shared'

export type ScheduleType = 'bimbingan' | 'materi' | 'tugas'

export interface ScheduleItem {
  id: number
  type: ScheduleType
  /** Label kecil di atas judul, contoh "Ujian", "Tugas", "Sesi Bimbingan". */
  label: string
  title: string
  /** Baris kecil di bawah judul: mapel atau nama mentor. */
  subtitle: string
  subject: string
  start: string
  end?: string
  /** Khusus tugas. */
  status?: TaskStatus
  /** Khusus sesi bimbingan: sesi online langsung. */
  live?: boolean
}

/*
 * DATA CONTOH (statis), tanggalnya relatif terhadap hari ini. Endpoint jadwal belum ada.
 * Saat API tersedia, ganti SCHEDULE dengan data dari backend dengan bentuk yang sama.
 */
export const SCHEDULE: ScheduleItem[] = [
  {
    id: 1,
    type: 'tugas',
    label: 'Ujian',
    title: 'Tugas Materi 1 Dasar Bahasa Indonesia',
    subtitle: 'Bahasa Indonesia',
    subject: 'Bahasa Indonesia',
    start: daysFromNow(0, 20, 30),
    status: 'belum',
  },
  {
    id: 2,
    type: 'tugas',
    label: 'Tugas',
    title: 'Tugas Materi 1 Matematika',
    subtitle: 'Matematika',
    subject: 'Matematika',
    start: daysFromNow(0, 8, 30),
    status: 'dikumpulkan',
  },
  {
    id: 3,
    type: 'tugas',
    label: 'Tugas',
    title: 'Tugas Materi 1 Sejarah',
    subtitle: 'Sejarah',
    subject: 'Sejarah',
    start: daysFromNow(0, 12, 30),
    status: 'selesai',
  },
  {
    id: 4,
    type: 'bimbingan',
    label: 'Sesi Bimbingan',
    title: 'Bahasa Indonesia',
    subtitle: 'Fauzan S. Pd',
    subject: 'Bahasa Indonesia',
    start: daysFromNow(1, 7, 0),
    end: daysFromNow(1, 8, 30),
    live: true,
  },
  {
    id: 5,
    type: 'bimbingan',
    label: 'Sesi Bimbingan',
    title: 'Matematika',
    subtitle: 'Pardjo S. Pd',
    subject: 'Matematika',
    start: daysFromNow(1, 10, 0),
    end: daysFromNow(1, 12, 30),
    live: true,
  },
  {
    id: 6,
    type: 'materi',
    label: 'Materi',
    title: 'Bahasa Indonesia Menengah',
    subtitle: 'Wira Admaja S. Pd',
    subject: 'Bahasa Indonesia',
    start: daysFromNow(3, 9, 0),
  },
]
