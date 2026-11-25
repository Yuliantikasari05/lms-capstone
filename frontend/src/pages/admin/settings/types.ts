/** Bentuk data API Pengaturan > Role & Akses. Kontrak lengkap: docs/api-pengaturan-role-akses.md. */

export type Action = 'create' | 'read' | 'update' | 'delete'

export interface RoleSetting {
  id: number
  slug: string
  name: string
  description: string | null
  is_system: boolean
  can_rename: boolean
  can_delete: boolean
  users_count: number
  permissions_count: number
  assignable_count: number
  required_permissions: string[]
}

export interface MatrixCell {
  action: Action
  slug: string | null
  /** on/off = bisa diubah, locked = wajib, unavailable = fitur belum dibangun, na = kolom tidak ada. */
  state: 'on' | 'off' | 'locked' | 'unavailable' | 'na'
  granted: boolean
  editable: boolean
  sensitive: boolean
  reason: string | null
}

export interface MatrixActivity {
  key: string
  label: string
  description: string
  status: 'active' | 'planned'
  note: string | null
  /** own = role hanya mengakses data miliknya sendiri. */
  scope: 'all' | 'own'
  cells: MatrixCell[]
}

export interface MatrixModule {
  key: string
  name: string
  activities: MatrixActivity[]
}

export interface RoleListResponse {
  data: RoleSetting[]
  summary: { total_roles: number; total_users: number; custom_roles: number }
}

export interface RoleDetailResponse {
  data: RoleSetting & { permissions: string[] }
  matrix: MatrixModule[]
  message?: string
}

interface CatalogActivity extends Omit<MatrixActivity, 'scope' | 'cells'> {
  cells: { action: Action; slug: string | null; roles: string[]; sensitive: boolean }[]
}

export interface CatalogResponse {
  data: { key: string; name: string; activities: CatalogActivity[] }[]
}

/** Slug izin yang sedang menyala pada matriks (termasuk yang wajib), tanpa duplikat. */
export function grantedSlugs(matrix: MatrixModule[]): string[] {
  const cells = matrix.flatMap((module) => module.activities).flatMap((activity) => activity.cells)
  return [...new Set(cells.flatMap((cell) => (cell.slug && cell.granted ? [cell.slug] : [])))]
}

/** Matriks kosong untuk role khusus baru: hanya aktivitas di katalog yang boleh diterima role khusus. */
export function customRoleMatrix(catalog: CatalogResponse): MatrixModule[] {
  return catalog.data
    .map((module) => ({
      key: module.key,
      name: module.name,
      activities: module.activities
        .filter((activity) => activity.status === 'active' && activity.cells.some((cell) => cell.roles.includes('custom')))
        .map((activity): MatrixActivity => ({
          ...activity,
          scope: 'all',
          cells: activity.cells.map((cell): MatrixCell => {
            const allowed = cell.slug !== null && cell.roles.includes('custom')
            return {
              action: cell.action,
              slug: allowed ? cell.slug : null,
              state: allowed ? 'off' : 'na',
              granted: false,
              editable: allowed,
              sensitive: cell.sensitive,
              reason: null,
            }
          }),
        })),
    }))
    .filter((module) => module.activities.length > 0)
}
