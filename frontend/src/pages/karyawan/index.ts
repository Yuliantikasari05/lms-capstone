import type { ComponentType } from 'react'
import ProfilePage from '../shared/ProfilePage'
import KaryawanDashboard from './Dashboard'
import KaryawanLaporan from './Laporan'
import KaryawanNotifikasi from './Notifikasi'
import KaryawanPelatihan from './Pelatihan'
import KaryawanPembayaran from './Pembayaran'
import KaryawanSertifikat from './Sertifikat'
import KaryawanWebinar from './Webinar'

/** Halaman untuk setiap menu Karyawan. Kunci = `key` menu di config/navigation.ts. */
export const karyawanPages: Record<string, ComponentType> = {
  overview: KaryawanDashboard,
  trainings: KaryawanPelatihan,
  webinars: KaryawanWebinar,
  certificates: KaryawanSertifikat,
  reports: KaryawanLaporan,
  payments: KaryawanPembayaran,
  notifications: KaryawanNotifikasi,
  profile: ProfilePage,
}
