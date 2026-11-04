import type { Course, CourseStatus, CourseType, MaterialType, SessionTimeStatus } from './types'

/** Jenis yang boleh dibuat lewat form Admin. Program Lembaga dibuat oleh Lembaga (tahap berikutnya). */
export const CREATABLE_TYPES: { value: CourseType; label: string }[] = [
  { value: 'academic', label: 'Akademik (untuk Siswa)' },
  { value: 'training', label: 'Pelatihan (untuk Karyawan)' },
  { value: 'webinar', label: 'Webinar (untuk Karyawan)' },
]

export const TYPE_FILTER_OPTIONS: { value: CourseType; label: string }[] = [
  { value: 'academic', label: 'Akademik' },
  { value: 'training', label: 'Pelatihan' },
  { value: 'webinar', label: 'Webinar' },
  { value: 'institution', label: 'Program Lembaga' },
]

export const STATUS_OPTIONS: { value: CourseStatus; label: string }[] = [
  { value: 'draft', label: 'Draf' },
  { value: 'active', label: 'Aktif' },
  { value: 'inactive', label: 'Nonaktif' },
]

export const COURSE_STATUS_TONE = { draft: 'neutral', active: 'success', inactive: 'danger' } as const

/** Pita warna kartu menurut jenis kursus. */
export const TYPE_BAND: Record<CourseType, string> = {
  academic: 'from-indigo-200 to-indigo-400',
  training: 'from-emerald-200 to-emerald-400',
  webinar: 'from-sky-200 to-teal-500',
  institution: 'from-amber-200 to-amber-400',
}

export const MATERIAL_TYPE_OPTIONS: { value: MaterialType; label: string; hint: string }[] = [
  { value: 'video', label: 'Video', hint: 'Unggah file MP4/WebM atau tempel tautan (YouTube, Drive).' },
  { value: 'pdf', label: 'PDF', hint: 'Unggah file PDF.' },
  { value: 'document', label: 'Dokumen', hint: 'Word, PowerPoint, Excel, TXT, atau CSV.' },
  { value: 'link', label: 'Tautan', hint: 'Tautan ke sumber belajar di luar sistem.' },
]

export const FILE_ACCEPT: Record<MaterialType, string> = {
  video: '.mp4,.webm,video/mp4,video/webm',
  pdf: '.pdf,application/pdf',
  document: '.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv',
  link: '',
}

/** Batas pemeriksaan cepat di browser. Batas sebenarnya ditentukan server (LMS_UPLOAD_MAX_KB). */
export const MAX_UPLOAD_MB = 50

/** Peserta kursus akademik/program lembaga adalah Siswa; pelatihan/webinar adalah Karyawan. */
export function participantLabel(type: CourseType): string {
  return type === 'training' || type === 'webinar' ? 'Karyawan' : 'Siswa'
}

/** XP hanya untuk kursus akademik dan program lembaga. */
export function allowsXp(type: CourseType): boolean {
  return type === 'academic' || type === 'institution'
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const DAY = new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
const TIME = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })

/** "Sen, 3 Nov 2026 · 09.00–11.00" (zona waktu browser). */
export function formatSessionRange(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '—'
  return `${DAY.format(start)} · ${TIME.format(start)}–${TIME.format(end)}`
}

export const SESSION_STATUS: Record<SessionTimeStatus, { label: string; tone: 'info' | 'success' | 'neutral' }> = {
  upcoming: { label: 'Akan datang', tone: 'info' },
  ongoing: { label: 'Berlangsung', tone: 'success' },
  finished: { label: 'Selesai', tone: 'neutral' },
}

/** ISO 8601 -> nilai <input type="datetime-local"> dalam zona waktu browser ("2026-11-03T09:00"). */
export function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Nilai <input type="datetime-local"> -> ISO 8601 UTC. Server mengubahnya ke zona waktu aplikasi. */
export function fromDatetimeLocal(value: string): string {
  return new Date(value).toISOString()
}

export function canManageContent(course: Course): boolean {
  return !!course.abilities?.manage_content
}
