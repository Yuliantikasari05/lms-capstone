/** Tipe data modul kursus. Bentuknya mengikuti response backend (docs/api-kursus.md). */

export type CourseType = 'academic' | 'training' | 'webinar' | 'institution'
export type CourseStatus = 'draft' | 'active' | 'inactive'
export type MaterialType = 'video' | 'pdf' | 'document' | 'link'

/** Apa yang boleh dilakukan pengguna saat ini pada sebuah kursus (backend tetap yang menentukan). */
export interface CourseAbilities {
  update: boolean
  delete: boolean
  assign_mentor: boolean
  manage_content: boolean
  manage_enrollments: boolean
}

export interface Course {
  id: number
  type: CourseType
  type_label: string
  title: string
  description: string | null
  status: CourseStatus
  status_label: string
  mentor: { id: number; name: string; deleted: boolean } | null
  created_by: number | null
  modules_count?: number
  sessions_count?: number
  participants_count?: number
  abilities: CourseAbilities | null
  created_at: string | null
  updated_at: string | null
}

export interface Material {
  id: number
  module_id: number
  title: string
  description: string | null
  type: MaterialType
  type_label: string
  external_url: string | null
  has_file: boolean
  file: { name: string | null; size: number | null; mime_type: string | null } | null
  duration_minutes: number | null
  xp_points: number
  position: number
}

export interface CourseModule {
  id: number
  course_id: number
  title: string
  position: number
  materials?: Material[]
  materials_count?: number
}

export type SessionTimeStatus = 'upcoming' | 'ongoing' | 'finished'

export interface ClassSession {
  id: number
  course_id: number
  title: string
  type: 'class' | 'training' | 'webinar'
  type_label: string
  instructor: { id: number; name: string } | null
  starts_at: string
  ends_at: string
  status: SessionTimeStatus
  /** Hanya ada untuk yang berhak mengelola kursus. */
  meeting_url?: string
}

export interface Enrollment {
  id: number
  course_id: number
  user: { id: number; name: string; email: string; status: string; deleted: boolean } | null
  status: 'active' | 'cancelled'
  source: string
  enrolled_by: string | null
  enrolled_at: string | null
  cancelled_at: string | null
}

export interface EnrollmentCandidate {
  id: number
  name: string
  email: string
}

export interface MentorOption {
  id: number
  name: string
  email: string
}
