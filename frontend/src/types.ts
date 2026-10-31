export type RoleSlug = 'admin' | 'mentor' | 'siswa' | 'karyawan' | 'lembaga'

export interface Role {
  id: number
  slug: string
  name: string
}

export interface User {
  id: number
  name: string
  email: string
  status: 'active' | 'inactive' | 'suspended'
  primary_role: RoleSlug | null
  roles: Role[]
  permissions: string[]
  /** true = masih memakai kata sandi sementara dari Admin dan wajib menggantinya. */
  must_change_password: boolean
  last_login_at: string | null
  created_at: string | null
  /** Terisi bila akun sudah dihapus (soft delete). */
  deleted_at: string | null
}

export interface PaginationMeta {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

export interface Paginated<T> {
  data: T[]
  meta: PaginationMeta
}

export interface AdminSummary {
  users_total: number
  users_active: number
  users_trashed: number
  mentors_total: number
  courses_total: number | null
  users_by_role: { slug: string; name: string; users_count: number }[]
  recent_logins: {
    id: number
    name: string
    email: string
    role: string | null
    last_login_at: string
  }[]
}

/** Bentuk response mutasi (tambah/ubah/pulihkan): data + pesan dari backend. */
export interface ApiMessage<T> {
  data: T
  message?: string
}

/** Response tambah pengguna: kata sandi sementara hanya ada di response ini (tampil sekali). */
export interface CreatedUserResponse extends ApiMessage<User> {
  temporary_password?: string
}

/** Response reset kata sandi oleh Admin. */
export interface ResetPasswordResponse extends ApiMessage<User> {
  temporary_password: string
}

export interface AuditLogEntry {
  id: number
  action: string
  actor: { id: number | null; name: string | null; email: string | null }
  target: { type: string | null; id: number | null; label: string | null }
  changes: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
}
