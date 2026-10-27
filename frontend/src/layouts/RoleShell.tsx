import { ROLE_CONFIG } from '../config/navigation'
import type { RoleSlug } from '../types'
import { AdminLayout } from './AdminLayout'
import { TopNavLayout } from './TopNavLayout'

/** Memilih layout sesuai role: Admin = sidebar, role lain = navigasi horizontal. */
export function RoleShell({ role }: { role: RoleSlug }) {
  if (ROLE_CONFIG[role].layout === 'sidebar') return <AdminLayout />
  return <TopNavLayout role={role as Exclude<RoleSlug, 'admin'>} />
}
