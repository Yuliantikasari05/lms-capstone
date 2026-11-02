/** Gaya dan helper yang dipakai bersama oleh halaman-halaman Siswa (Tugas, Jadwal). */

export type TaskStatus = 'belum' | 'dikumpulkan' | 'selesai'

export const TASK_STATUS: Record<TaskStatus, { label: string; badge: string; action: string }> = {
  belum: { label: 'Belum Dikerjakan', badge: 'bg-orange-50 text-amber-700', action: 'Kerjakan' },
  dikumpulkan: { label: 'Dikumpulkan', badge: 'bg-indigo-100 text-blue-700', action: 'Lihat Detail' },
  selesai: { label: 'Selesai', badge: 'bg-emerald-200 text-emerald-700', action: 'Lihat Nilai' },
}

/** Warna ikon dan label per mata pelajaran. Mapel lain memakai warna abu-abu. */
const SUBJECT_COLOR: Record<string, { bg: string; text: string }> = {
  'Bahasa Indonesia': { bg: 'bg-purple-50', text: 'text-purple-600' },
  Matematika: { bg: 'bg-indigo-100', text: 'text-blue-700' },
  Sejarah: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  'Bahasa Inggris': { bg: 'bg-red-50', text: 'text-red-500' },
  'Pendidikan Pancasila': { bg: 'bg-amber-50', text: 'text-amber-600' },
}
const DEFAULT_SUBJECT_COLOR = { bg: 'bg-slate-100', text: 'text-slate-600' }

/** Kelas latar + teks untuk kotak ikon dan label mapel. */
export function subjectColor(subject: string): string {
  const color = SUBJECT_COLOR[subject] ?? DEFAULT_SUBJECT_COLOR
  return `${color.bg} ${color.text}`
}

/** Kelas warna teks saja, untuk label tanpa latar. */
export function subjectTextColor(subject: string): string {
  return (SUBJECT_COLOR[subject] ?? DEFAULT_SUBJECT_COLOR).text
}

/** Waktu N hari dari hari ini (jam lokal). Dipakai data contoh agar tanggalnya selalu relevan. */
export function daysFromNow(days: number, hours = 23, minutes = 59): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  date.setHours(hours, minutes, 0, 0)
  return date.toISOString()
}

/** Jam lokal format Indonesia, contoh "08.30". */
export const timeFormat = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' })
