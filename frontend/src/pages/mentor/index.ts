import type { ComponentType } from 'react'
import ProfilePage from '../shared/ProfilePage'
import MentorDashboard from './Dashboard'
import MentorJadwalBimbingan from './JadwalBimbingan'
import MentorKurikulum from './Kurikulum'
import MentorKursusSaya from './KursusSaya'
import MentorNotifikasi from './Notifikasi'
import MentorTugas from './Tugas'
import MentorUser from './User'

/** Halaman untuk setiap menu Mentor. Kunci = `key` menu di config/navigation.ts. */
export const mentorPages: Record<string, ComponentType> = {
  overview: MentorDashboard,
  courses: MentorKursusSaya,
  users: MentorUser,
  assignments: MentorTugas,
  curriculum: MentorKurikulum,
  schedule: MentorJadwalBimbingan,
  notifications: MentorNotifikasi,
  profile: ProfilePage,
}
