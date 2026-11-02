import type { ComponentType } from 'react'
import type { ExtraRoute } from '../../config/navigation'
import ProfilePage from '../shared/ProfilePage'
import SiswaDashboard from './Dashboard'
import SiswaJadwal from './Jadwal'
import SiswaLaporan from './Laporan'
import SiswaMateri from './Materi'
import SiswaMateriDetail from './MateriDetail'
import SiswaNotifikasi from './Notifikasi'
import SiswaPapanPeringkat from './PapanPeringkat'
import SiswaTugas from './Tugas'

/** Halaman untuk setiap menu Siswa. Kunci = `key` menu di config/navigation.ts. */
export const siswaPages: Record<string, ComponentType> = {
  overview: SiswaDashboard,
  materials: SiswaMateri,
  assignments: SiswaTugas,
  schedule: SiswaJadwal,
  reports: SiswaLaporan,
  leaderboard: SiswaPapanPeringkat,
  notifications: SiswaNotifikasi,
  profile: ProfilePage,
}

/** Halaman Siswa di luar menu. */
export const siswaRoutes: ExtraRoute[] = [{ path: 'materials/:courseId', Page: SiswaMateriDetail }]
