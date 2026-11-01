import type { ComponentType } from 'react'
import AdminDashboard from './AdminDashboard'
import AdminGamifikasi from './Gamifikasi'
import AdminLembagaBimbingan from './LembagaBimbingan'
import AdminManajemenKupon from './ManajemenKupon'
import AdminManajemenKursus from './ManajemenKursus'
import AdminPengaturan from './Pengaturan'
import UsersPage from './UsersPage'

/** Halaman untuk setiap menu Admin. Kunci = `key` menu di config/navigation.ts. */
export const adminPages: Record<string, ComponentType> = {
  dashboard: AdminDashboard,
  users: UsersPage,
  courses: AdminManajemenKursus,
  coupons: AdminManajemenKupon,
  gamification: AdminGamifikasi,
  institutions: AdminLembagaBimbingan,
  settings: AdminPengaturan,
}
