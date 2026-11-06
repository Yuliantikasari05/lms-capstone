import type { ComponentType } from 'react'
import type { ExtraRoute } from '../../config/navigation'
import ProfilePage from '../shared/ProfilePage'
import LembagaDashboard from './Dashboard'
import LembagaJelajahi from './Jelajahi'
import LembagaKelolaModul from './KelolaModul'
import LembagaKelolaSiswa from './KelolaSiswa'
import LembagaPengaturan from './Pengaturan'
import LembagaVoucher from './Voucher'
import TambahModul from './TambahModul'
import DetailModulSessions from './DetailModulSessions'
import DiscussionDetail from './DiscussionDetail'
import DetailSiswa from './DetailSiswa'

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

export const lembagaRoutes: ExtraRoute[] = [
  { path: 'modules/new', Page: TambahModul },
  { path: 'modules/:moduleId/sessions', Page: DetailModulSessions },
  { path: 'modules/:moduleId/discussions/:discussionId', Page: DiscussionDetail },
  { path: 'students/:studentId', Page: DetailSiswa },
]
