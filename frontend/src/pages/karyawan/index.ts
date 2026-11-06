import type { ComponentType } from 'react'
import type { ExtraRoute } from '../../config/navigation'
import ProfilePage from '../shared/ProfilePage'
import KaryawanDashboard from './Dashboard'
import KaryawanLaporan from './Laporan'
import KaryawanNotifikasi from './Notifikasi'
import KaryawanPelatihan from './Pelatihan'
import KaryawanPelatihanDetail from './PelatihanDetail'
import KaryawanPembayaran from './Pembayaran'
import KaryawanSertifikat from './Sertifikat'
import KaryawanSertifikatDetail from './SertifikatDetail'
import KaryawanWebinar from './Webinar'
import KaryawanWebinarDetail from './WebinarDetail'

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

/** Halaman Karyawan di luar menu. */
export const karyawanRoutes: ExtraRoute[] = [
  { path: 'trainings/:courseId', Page: KaryawanPelatihanDetail },
  { path: 'webinars/:webinarId', Page: KaryawanWebinarDetail },
  { path: 'certificates/:certificateId', Page: KaryawanSertifikatDetail },
]
