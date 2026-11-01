import type { ComponentType } from 'react'
import type { RoleSlug } from '../types'
import { AdminLayout } from './AdminLayout'
import { KaryawanLayout } from './KaryawanLayout'
import { LembagaLayout } from './LembagaLayout'
import { MentorLayout } from './MentorLayout'
import { SiswaLayout } from './SiswaLayout'

/** Setiap role punya file layout sendiri: Admin = sidebar, role lain = navigasi horizontal. */
const LAYOUTS: Record<RoleSlug, ComponentType> = {
  admin: AdminLayout,
  mentor: MentorLayout,
  siswa: SiswaLayout,
  karyawan: KaryawanLayout,
  lembaga: LembagaLayout,
}

/** Memilih layout sesuai role. */
export function RoleShell({ role }: { role: RoleSlug }) {
  const Layout = LAYOUTS[role]
  return <Layout />
}
