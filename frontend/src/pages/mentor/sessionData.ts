import type { CourseType } from '../../features/courses/types'

/** Tipe dan helper tampilan sesi bimbingan. Data sesi berasal dari API (lihat scheduleApi.ts). */

export const SESSION_TYPES = ['Kelas reguler', 'Pelatihan', 'Webinar'] as const
export type MentorSessionType = typeof SESSION_TYPES[number]
export type SessionMode = 'Online' | 'Offline'
export type SessionStatus = 'Sedang berlangsung' | 'Terjadwal' | 'Draft' | 'Dibatalkan'

export interface SessionScheduleDetails {
  date: string
  startTime: string
  endTime: string
  type: MentorSessionType
  mode: SessionMode
  location: string
  meetingLink: string
}

export interface MentorSession extends SessionScheduleDetails {
  id: number
  courseId: number
  title: string
  description: string
  status: SessionStatus
  participants: number
  mentorName: string
  cancellationReason?: string
}

export function sessionTypeForCourseType(type: CourseType): MentorSessionType | null {
  switch (type) {
    case 'academic': return 'Kelas reguler'
    case 'training': return 'Pelatihan'
    case 'webinar': return 'Webinar'
    case 'institution': return null
  }
}
