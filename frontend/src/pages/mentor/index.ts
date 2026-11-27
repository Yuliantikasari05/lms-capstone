import type { ComponentType } from 'react'
import type { ExtraRoute } from '../../config/navigation'
import MentorDashboard from './Dashboard'
import MentorJadwalBimbingan from './JadwalBimbingan'
import MentorKurikulum from './Kurikulum'
import MentorKursusSaya from './KursusSaya'
import MentorProfile from './MentorProfile'
import MentorSecurity from './MentorSecurity'
import MentorCourseDetail from './CourseDetail'
import CurriculumDiscussions from './CurriculumDiscussions'
import MentorNotifikasi from './Notifikasi'
import MentorTugas from './Tugas'
import MentorUser from './User'
import MentorUserProfile from './UserProfile'

/** Halaman untuk setiap menu Mentor. Kunci = `key` menu di config/navigation.ts. */
export const mentorPages: Record<string, ComponentType> = {
  overview: MentorDashboard,
  courses: MentorKursusSaya,
  users: MentorUser,
  assignments: MentorTugas,
  curriculum: MentorKurikulum,
  schedule: MentorJadwalBimbingan,
  profile: MentorProfile,
}

export const mentorRoutes: ExtraRoute[] = [
  { path: 'courses/:courseId', Page: MentorCourseDetail },
  { path: 'curriculum/discussions/:courseId', Page: CurriculumDiscussions },
  { path: 'users/:userId', Page: MentorUserProfile },
  { path: 'notifications', Page: MentorNotifikasi },
  { path: 'profile', Page: MentorProfile },
  { path: 'security', Page: MentorSecurity },
]
