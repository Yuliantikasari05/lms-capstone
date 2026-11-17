import { MENTOR_COURSES, courseAudience, type MentorCoursePreview } from './courseData'

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
  id: string
  courseId: number
  moduleId?: number
  title: string
  description: string
  status: SessionStatus
  participants: number
  mentorName: string
  cancellationReason?: string
}

export function sessionTypeForCourse(course: MentorCoursePreview): MentorSessionType | null {
  switch (course.type) {
    case 'academic': return 'Kelas reguler'
    case 'training': return 'Pelatihan'
    case 'webinar': return 'Webinar'
    case 'institution': return null
  }
}

function createInitialSessions(): MentorSession[] {
  const statuses: SessionStatus[] = ['Sedang berlangsung', 'Terjadwal', 'Draft', 'Dibatalkan']
  let sessionIndex = 0

  return MENTOR_COURSES.filter((course) => sessionTypeForCourse(course) !== null).flatMap((course) =>
    Array.from({ length: course.sessions }, (_, index) => {
      const currentIndex = sessionIndex
      sessionIndex += 1
      const date = new Date(2026, 10, 17 + currentIndex)
      const dateValue = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      const mode: SessionMode = currentIndex % 2 === 0 ? 'Online' : 'Offline'
      return {
        id: `session-${course.id}-${index + 1}`,
        courseId: course.id,
        moduleId: course.modules[0]?.id,
        title: `Sesi bimbingan ${index + 1} · ${course.title}`,
        description: '',
        date: dateValue,
        startTime: '13:00',
        endTime: '15:00',
        type: sessionTypeForCourse(course) ?? SESSION_TYPES[0],
        mode,
        location: mode === 'Offline' ? 'Ruang bimbingan 1' : '',
        meetingLink: mode === 'Online' ? 'https://meet.google.com/abc-defg-hij' : '',
        status: statuses[currentIndex % statuses.length],
        participants: course.students,
        mentorName: 'Yuli Antika Sari',
      }
    }),
  )
}

let sessions = createInitialSessions()
const listeners = new Set<() => void>()

export function getMentorSessions(): MentorSession[] {
  return sessions
}

export function subscribeMentorSessions(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function notifySessionsChanged() {
  listeners.forEach((listener) => listener())
}

export function saveMentorSession(session: MentorSession) {
  const index = sessions.findIndex((item) => item.id === session.id)
  sessions = index === -1
    ? [session, ...sessions]
    : sessions.map((item) => item.id === session.id ? session : item)
  notifySessionsChanged()
}

export function deleteMentorSession(id: string) {
  sessions = sessions.filter((session) => session.id !== id)
  notifySessionsChanged()
}

export function findMentorCourse(courseId: number): MentorCoursePreview | undefined {
  return MENTOR_COURSES.find((course) => course.id === courseId)
}

export function sessionAudience(courseId: number): string {
  const course = findMentorCourse(courseId)
  return course ? courseAudience(course.type) : 'peserta'
}
