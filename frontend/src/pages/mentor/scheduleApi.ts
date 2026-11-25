import type { ClassSession, Course, CourseType } from '../../features/courses/types'
import { api } from '../../lib/api'
import type { Paginated } from '../../types'
import {
  sessionTypeForCourseType,
  type MentorSession,
  type SessionMode,
  type SessionScheduleDetails,
  type SessionStatus,
} from './sessionData'

/** Pemetaan data sesi bimbingan dari API (docs/api-kursus.md). */

interface ApiSession extends ClassSession {
  mode: 'online' | 'offline'
  mode_label: string
  location: string | null
  schedule_status: 'draft' | 'scheduled' | 'cancelled'
  schedule_status_label: string
  cancellation_reason: string | null
  mentor_name: string | null
  participants: number | null
}

export interface ScheduleCourse {
  id: number
  title: string
  type: CourseType
  participants: number
}

const pad = (value: number) => String(value).padStart(2, '0')

function localDate(iso: string): string {
  const date = new Date(iso)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function localTime(iso: string): string {
  const date = new Date(iso)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function displayStatus(session: ApiSession): SessionStatus {
  if (session.schedule_status === 'cancelled') return 'Dibatalkan'
  if (session.schedule_status === 'draft') return 'Draft'
  // Sesi "scheduled" yang sedang berjalan ditampilkan sebagai Sedang berlangsung.
  return session.status === 'ongoing' ? 'Sedang berlangsung' : 'Terjadwal'
}

function toSession(session: ApiSession, course: Course | undefined): MentorSession {
  return {
    id: session.id,
    courseId: session.course_id,
    title: session.title,
    description: session.description ?? '',
    date: localDate(session.starts_at),
    startTime: localTime(session.starts_at),
    endTime: localTime(session.ends_at),
    type: course ? sessionTypeForCourseType(course.type) ?? 'Kelas reguler' : 'Kelas reguler',
    mode: session.mode === 'offline' ? 'Offline' : 'Online',
    location: session.location ?? '',
    meetingLink: session.meeting_url ?? '',
    status: displayStatus(session),
    participants: session.participants ?? course?.participants_count ?? 0,
    mentorName: session.mentor_name ?? course?.mentor?.name ?? 'Mentor',
    ...(session.cancellation_reason ? { cancellationReason: session.cancellation_reason } : {}),
  }
}

async function fetchCourses(): Promise<Course[]> {
  return (await api.get<Paginated<Course>>('/courses', { params: { per_page: 100 } })).data.data
}

export async function fetchScheduleCourses(): Promise<ScheduleCourse[]> {
  const courses = await fetchCourses()

  return courses
    .filter((course) => course.type !== 'institution')
    .map((course) => ({
      id: course.id,
      title: course.title,
      type: course.type,
      participants: course.participants_count ?? 0,
    }))
}

/** Semua sesi dari kursus yang diampu Mentor (satu permintaan per kursus). */
export async function fetchMentorSessions(): Promise<MentorSession[]> {
  const courses = await fetchCourses()

  const perCourse = await Promise.all(courses
    .filter((course) => course.type !== 'institution')
    .map(async (course) => {
      const sessions = (
        await api.get<{ data: ApiSession[] }>(`/courses/${course.id}/sessions`)
      ).data.data

      return sessions.map((session) => toSession(session, course))
    }))

  return perCourse.flat().sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))
}

function sessionBody(title: string, details: SessionScheduleDetails) {
  return {
    title,
    description: null,
    starts_at: `${details.date}T${details.startTime}:00`,
    ends_at: `${details.date}T${details.endTime}:00`,
    mode: details.mode === 'Offline' ? 'offline' : 'online',
    location: details.mode === 'Offline' ? details.location || null : null,
    // Sesi Offline tidak memakai link; permintaan tidak mengirim field ini sama sekali.
    ...(details.mode === 'Offline' ? {} : { meeting_url: details.meetingLink }),
  }
}

export async function createMentorSession(input: {
  courseId: number
  title: string
  details: SessionScheduleDetails
  status: 'Draft' | 'Terjadwal'
}): Promise<void> {
  await api.post(`/courses/${input.courseId}/sessions`, {
    ...sessionBody(input.title, input.details),
    status: input.status === 'Draft' ? 'draft' : 'scheduled',
  })
}

export async function updateMentorSession(input: {
  id: number
  courseId: number
  title: string
  details: SessionScheduleDetails
  status: 'Draft' | 'Terjadwal'
}): Promise<void> {
  await api.patch(`/sessions/${input.id}`, {
    ...sessionBody(input.title, input.details),
    status: input.status === 'Draft' ? 'draft' : 'scheduled',
  })
}

export async function deleteMentorSession(id: number): Promise<void> {
  await api.delete(`/sessions/${id}`)
}

export async function cancelMentorSession(id: number, reason: string): Promise<void> {
  await api.patch(`/sessions/${id}`, {
    status: 'cancelled',
    cancellation_reason: reason,
  })
}

/** Tipe sesi dari jenis kursus (dipakai halaman untuk label filter/tipe). */
export function sessionModeOf(mode: SessionMode): 'online' | 'offline' {
  return mode === 'Offline' ? 'offline' : 'online'
}
