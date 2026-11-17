export type MentorNotificationCategory = 'assessment' | 'review' | 'discussion' | 'submission' | 'roster'

export interface MentorNotification {
  id: string
  category: MentorNotificationCategory
  title: string
  message: string
  actorName: string
  actorRole: 'Admin' | 'Siswa' | 'Karyawan' | 'Sistem'
  createdAt: string
  isRead: boolean
  actionLabel: string
  href: string
}

let notifications: MentorNotification[] = [
  {
    id: 'exam-approved',
    category: 'assessment',
    title: 'Ujian disetujui',
    message: 'Soal ujian Anda sudah disetujui oleh admin dan siap digunakan.',
    actorName: 'Admin LMS',
    actorRole: 'Admin',
    createdAt: '2026-11-17T10:20:00',
    isRead: false,
    actionLabel: 'Lihat tugas',
    href: '/mentor/assignments',
  },
  {
    id: 'exam-needs-revision',
    category: 'assessment',
    title: 'Ujian perlu diperbaiki',
    message: 'Admin menolak pengajuan ujian “Ujian Materi 3” dan memberikan catatan perbaikan.',
    actorName: 'Admin LMS',
    actorRole: 'Admin',
    createdAt: '2026-11-17T10:05:00',
    isRead: false,
    actionLabel: 'Lihat catatan',
    href: '/mentor/assignments',
  },
  {
    id: 'new-review',
    category: 'review',
    title: 'Ulasan baru dari siswa',
    message: 'Nadia Safitri memberikan ulasan untuk kursus Bahasa Indonesia Lanjutan.',
    actorName: 'Nadia Safitri',
    actorRole: 'Siswa',
    createdAt: '2026-11-17T09:45:00',
    isRead: false,
    actionLabel: 'Lihat ulasan',
    href: '/mentor/courses/3?tab=reviews',
  },
  {
    id: 'new-discussion',
    category: 'discussion',
    title: 'Pertanyaan baru di diskusi',
    message: 'Rizky Pratama mengajukan pertanyaan di diskusi Fullstack web developer professional.',
    actorName: 'Rizky Pratama',
    actorRole: 'Karyawan',
    createdAt: '2026-11-17T09:10:00',
    isRead: false,
    actionLabel: 'Lihat diskusi',
    href: '/mentor/curriculum/discussions/1',
  },
  {
    id: 'submission-pending',
    category: 'submission',
    title: 'Tugas menunggu penilaian',
    message: 'Auditya Wira A mengumpulkan tugas Bahasa Indonesia Lanjutan yang perlu Anda periksa.',
    actorName: 'Auditya Wira A',
    actorRole: 'Siswa',
    createdAt: '2026-11-16T15:30:00',
    isRead: false,
    actionLabel: 'Beri penilaian',
    href: '/mentor/assignments',
  },
  {
    id: 'roster-updated',
    category: 'roster',
    title: 'Daftar peserta diperbarui',
    message: 'Admin memperbarui daftar peserta pada kursus Fullstack web developer professional.',
    actorName: 'Admin LMS',
    actorRole: 'Admin',
    createdAt: '2026-11-16T12:05:00',
    isRead: true,
    actionLabel: 'Lihat kursus',
    href: '/mentor/courses/1',
  },
]

const listeners = new Set<() => void>()

export function getMentorNotifications(): MentorNotification[] {
  return notifications
}

export function subscribeMentorNotifications(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function notifyListeners() {
  listeners.forEach((listener) => listener())
}

export function markMentorNotificationRead(id: string) {
  notifications = notifications.map((notification) =>
    notification.id === id ? { ...notification, isRead: true } : notification,
  )
  notifyListeners()
}

export function markAllMentorNotificationsRead() {
  notifications = notifications.map((notification) => ({ ...notification, isRead: true }))
  notifyListeners()
}

export function deleteMentorNotification(id: string) {
  notifications = notifications.filter((notification) => notification.id !== id)
  notifyListeners()
}

export function clearMentorNotifications() {
  notifications = []
  notifyListeners()
}

export function formatNotificationDate(value: string) {
  const date = new Date(value)
  const formattedDate = date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
  const formattedTime = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${formattedDate}, ${formattedTime}`
}
