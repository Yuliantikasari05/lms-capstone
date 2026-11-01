import type { ComponentType } from 'react'
import ProfilePage from '../shared/ProfilePage'
import LembagaDashboard from './Dashboard'
import LembagaJelajahi from './Jelajahi'
import LembagaKelolaModul from './KelolaModul'
import LembagaKelolaSiswa from './KelolaSiswa'
import LembagaPengaturan from './Pengaturan'
import LembagaVoucher from './Voucher'

/** Halaman untuk setiap menu Lembaga Bimbingan. Kunci = `key` menu di config/navigation.ts. */
export const lembagaPages: Record<string, ComponentType> = {
  overview: LembagaDashboard,
  modules: LembagaKelolaModul,
  explore: LembagaJelajahi,
  students: LembagaKelolaSiswa,
  vouchers: LembagaVoucher,
  profile: ProfilePage,
  settings: LembagaPengaturan,
}
