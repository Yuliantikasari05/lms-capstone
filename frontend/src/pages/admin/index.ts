import type { ComponentType } from 'react'
import type { ExtraRoute } from '../../config/navigation'
import ProfilePage from '../shared/ProfilePage'
import AdminDashboard from './AdminDashboard'
import AdminGamifikasi from './Gamifikasi'
import AdminLembagaBimbingan from './LembagaBimbingan'
import AdminManajemenKupon from './ManajemenKupon'
import CoursesPage from './CoursesPage'
import AdminPengaturan from './Pengaturan'
import UsersPage from './UsersPage'

/** Halaman untuk setiap menu Admin. Kunci = `key` menu di config/navigation.ts. */
export const adminPages: Record<string, ComponentType> = {
  dashboard: AdminDashboard,
  users: UsersPage,
  courses: CoursesPage,
  coupons: AdminManajemenKupon,
  gamification: AdminGamifikasi,
  institutions: AdminLembagaBimbingan,
  settings: AdminPengaturan,
}

/** Halaman Admin di luar menu. Profil dibuka dari menu akun di kanan atas. */
export const adminRoutes: ExtraRoute[] = [{ path: 'profile', Page: ProfilePage }]
