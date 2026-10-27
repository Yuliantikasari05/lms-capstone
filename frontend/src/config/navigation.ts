import {
  Award,
  BookMarked,
  BookOpen,
  Building2,
  CalendarClock,
  ClipboardList,
  Compass,
  CreditCard,
  FileText,
  GraduationCap,
  Layers,
  LayoutDashboard,
  Settings,
  Ticket,
  Trophy,
  UserCircle,
  Users,
  Video,
  Bell,
  type LucideIcon,
} from 'lucide-react'
import type { RoleSlug } from '../types'

export interface NavItem {
  key: string
  label: string
  /** Segmen path relatif terhadap /{role}. String kosong = halaman utama (dashboard). */
  path: string
  icon: LucideIcon
}

export interface RoleConfig {
  label: string
  /** Admin memakai sidebar vertikal; role lain memakai navigasi horizontal. */
  layout: 'sidebar' | 'topnav'
  items: NavItem[]
  /** Kartu ringkasan dashboard untuk role non-Admin. Nilainya belum tersedia (belum ada modul). */
  summaryCards: string[]
  activityTitle: string
}

export const ROLE_CONFIG: Record<RoleSlug, RoleConfig> = {
  admin: {
    label: 'Admin',
    layout: 'sidebar',
    summaryCards: [],
    activityTitle: 'Login terbaru',
    items: [
      { key: 'dashboard', label: 'Dashboard', path: '', icon: LayoutDashboard },
      { key: 'users', label: 'Manajemen User', path: 'users', icon: Users },
      { key: 'courses', label: 'Manajemen Kursus', path: 'courses', icon: BookOpen },
      { key: 'coupons', label: 'Manajemen Kupon', path: 'coupons', icon: Ticket },
      { key: 'gamification', label: 'Gamifikasi', path: 'gamification', icon: Trophy },
      { key: 'institutions', label: 'Lembaga Bimbingan', path: 'institutions', icon: Building2 },
      { key: 'settings', label: 'Pengaturan', path: 'settings', icon: Settings },
    ],
  },
  mentor: {
    label: 'Mentor',
    layout: 'topnav',
    summaryCards: ['Kelas aktif', 'Jumlah siswa', 'Jadwal mendatang', 'Tugas perlu diperiksa'],
    activityTitle: 'Aktivitas terbaru',
    items: [
      { key: 'overview', label: 'Ringkasan', path: '', icon: LayoutDashboard },
      { key: 'courses', label: 'Kursus Saya', path: 'courses', icon: BookOpen },
      { key: 'users', label: 'User', path: 'users', icon: Users },
      { key: 'assignments', label: 'Tugas', path: 'assignments', icon: ClipboardList },
      { key: 'curriculum', label: 'Kurikulum', path: 'curriculum', icon: Layers },
      { key: 'schedule', label: 'Jadwal Bimbingan', path: 'schedule', icon: CalendarClock },
      { key: 'notifications', label: 'Notifikasi', path: 'notifications', icon: Bell },
      { key: 'profile', label: 'Profil', path: 'profile', icon: UserCircle },
    ],
  },
  siswa: {
    label: 'Siswa',
    layout: 'topnav',
    summaryCards: ['Kursus diikuti', 'Tugas perlu dikerjakan', 'Progres belajar', 'Jadwal mendatang'],
    activityTitle: 'Aktivitas belajar',
    items: [
      { key: 'overview', label: 'Ringkasan', path: '', icon: LayoutDashboard },
      { key: 'materials', label: 'Materi', path: 'materials', icon: BookOpen },
      { key: 'assignments', label: 'Tugas', path: 'assignments', icon: ClipboardList },
      { key: 'schedule', label: 'Jadwal', path: 'schedule', icon: CalendarClock },
      { key: 'reports', label: 'Laporan', path: 'reports', icon: FileText },
      { key: 'leaderboard', label: 'Papan Peringkat', path: 'leaderboard', icon: Trophy },
      { key: 'notifications', label: 'Notifikasi', path: 'notifications', icon: Bell },
      { key: 'profile', label: 'Profil', path: 'profile', icon: UserCircle },
    ],
  },
  karyawan: {
    label: 'Karyawan',
    layout: 'topnav',
    summaryCards: ['Pelatihan diikuti', 'Webinar mendatang', 'Progres pelatihan', 'Status sertifikat'],
    activityTitle: 'Aktivitas pelatihan',
    items: [
      { key: 'overview', label: 'Ringkasan', path: '', icon: LayoutDashboard },
      { key: 'trainings', label: 'Pelatihan', path: 'trainings', icon: BookMarked },
      { key: 'webinars', label: 'Webinar', path: 'webinars', icon: Video },
      { key: 'certificates', label: 'Sertifikat', path: 'certificates', icon: Award },
      { key: 'reports', label: 'Laporan', path: 'reports', icon: FileText },
      { key: 'payments', label: 'Pembayaran', path: 'payments', icon: CreditCard },
      { key: 'notifications', label: 'Notifikasi', path: 'notifications', icon: Bell },
      { key: 'profile', label: 'Profil', path: 'profile', icon: UserCircle },
    ],
  },
  lembaga: {
    label: 'Lembaga Bimbingan',
    layout: 'topnav',
    summaryCards: ['Program aktif', 'Jumlah siswa', 'Progres belajar'],
    activityTitle: 'Aktivitas program',
    items: [
      { key: 'overview', label: 'Ringkasan', path: '', icon: LayoutDashboard },
      { key: 'modules', label: 'Kelola Modul', path: 'modules', icon: Layers },
      { key: 'explore', label: 'Jelajahi', path: 'explore', icon: Compass },
      { key: 'students', label: 'Kelola Siswa', path: 'students', icon: Users },
      { key: 'vouchers', label: 'Voucher', path: 'vouchers', icon: Ticket },
      { key: 'profile', label: 'Profil', path: 'profile', icon: UserCircle },
      { key: 'settings', label: 'Pengaturan', path: 'settings', icon: Settings },
    ],
  },
}

export const ROLE_SLUGS = Object.keys(ROLE_CONFIG) as RoleSlug[]

export function isRoleSlug(value: string | null | undefined): value is RoleSlug {
  return !!value && value in ROLE_CONFIG
}

export function roleHome(role: RoleSlug): string {
  return `/${role}`
}

export function itemHref(role: RoleSlug, item: NavItem): string {
  return item.path ? `/${role}/${item.path}` : `/${role}`
}

export const BRAND_ICON = GraduationCap
