import { type FormEvent, useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { Field, inputClass } from '../../../components/ui/Field'
import { Modal } from '../../../components/ui/Modal'
import { api, toApiError } from '../../../lib/api'
import type { ApiMessage, CreatedUserResponse, Role, User } from '../../../types'
import { STATUS_OPTIONS, type TemporaryPasswordInfo } from './shared'

interface Props {
  mode: 'create' | 'edit'
  /** Wajib saat mode "edit". */
  user?: User
  roles: Role[]
  /** Daftar role sedang dimuat / gagal dimuat (agar dropdown tidak kosong tanpa penjelasan). */
  rolesLoading?: boolean
  rolesError?: boolean
  onRetryRoles?: () => void
  currentUserId?: number
  onClose: () => void
  /** Setelah tambah pengguna, `temporary` berisi kata sandi sementara yang harus ditampilkan sekali. */
  onSaved: (message: string, temporary?: TemporaryPasswordInfo) => void
}

type FieldErrors = Record<string, string[]>

/**
 * Form tambah/ubah pengguna. Admin TIDAK mengisi kata sandi: sistem membuat kata sandi sementara
 * saat akun dibuat (lihat TemporaryPasswordModal) atau lewat aksi "Reset kata sandi".
 */
export function UserFormModal({ mode, user, roles, rolesLoading = false, rolesError = false, onRetryRoles, currentUserId, onClose, onSaved }: Props) {
  const isEdit = mode === 'edit'
  const isSelf = isEdit && user?.id === currentUserId

  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [role, setRole] = useState<string>(user?.primary_role ?? '')
  const [status, setStatus] = useState<string>(user?.status ?? 'active')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [general, setGeneral] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const firstError = (field: string) => errors[field]?.[0]
  const describedBy = (field: string) => (firstError(field) ? `${field}-help` : undefined)
  const emailChanged = isEdit && !!user && email.trim().toLowerCase() !== user.email.toLowerCase()

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setGeneral(null)

    // Pemeriksaan ringan di klien agar cepat; backend tetap yang menentukan.
    const local: FieldErrors = {}
    if (!name.trim()) local.name = ['Nama wajib diisi.']
    if (!email.trim()) local.email = ['Email wajib diisi.']
    if (!isSelf && !role) local.role = ['Role wajib dipilih.']
    setErrors(local)
    if (Object.keys(local).length > 0) return

    const payload: Record<string, unknown> = { name: name.trim(), email: email.trim() }
    if (!isSelf) {
      payload.role = role
      payload.status = status
    }

    setSubmitting(true)
    try {
      if (isEdit) {
        const res = await api.patch<ApiMessage<User>>(`/users/${user!.id}`, payload)
        onSaved(res.data.message ?? 'Pengguna berhasil diperbarui.')
      } else {
        const res = await api.post<CreatedUserResponse>('/users', payload)
        onSaved(
          'Pengguna berhasil dibuat.',
          res.data.temporary_password ? { name: res.data.data.name, email: res.data.data.email, password: res.data.temporary_password, reason: 'created' } : undefined,
        )
      }
    } catch (error) {
      const apiError = toApiError(error)
      if (apiError.kind === 'validation' && Object.keys(apiError.fieldErrors).length > 0) {
        setErrors(apiError.fieldErrors)
      } else {
        setGeneral(apiError.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      title={isEdit ? 'Ubah Pengguna' : 'Tambah Pengguna'}
      description={isEdit ? user?.email : 'Akun dibuat oleh Admin. Tidak ada pendaftaran mandiri.'}
      onClose={onClose}
      dismissible={!submitting}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Batal
          </Button>
          <Button type="submit" form="user-form" loading={submitting}>
            {isEdit ? 'Simpan Perubahan' : 'Buat Pengguna'}
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={onSubmit} noValidate className="space-y-4">
        {general && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {general}
          </p>
        )}

        <Field id="name" label="Nama lengkap" error={firstError('name')}>
          <input
            id="name"
            data-autofocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={255}
            autoComplete="off"
            aria-invalid={!!firstError('name')}
            aria-describedby={describedBy('name')}
            className={inputClass(!!firstError('name'))}
          />
        </Field>

        <Field
          id="email"
          label="Email"
          error={firstError('email')}
          hint={emailChanged ? 'Pemilik akun akan diberi tahu lewat email lama. Perubahan ini tercatat di riwayat aktivitas.' : undefined}
        >
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={255}
            autoComplete="off"
            aria-invalid={!!firstError('email')}
            aria-describedby={firstError('email') || emailChanged ? 'email-help' : undefined}
            className={inputClass(!!firstError('email'))}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="role" label="Role" error={firstError('role')}>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={isSelf || rolesLoading || roles.length === 0}
              aria-invalid={!!firstError('role')}
              aria-describedby={describedBy('role')}
              className={inputClass(!!firstError('role'))}
            >
              <option value="">{rolesLoading ? 'Memuat role…' : roles.length === 0 ? 'Gagal memuat role' : 'Pilih role…'}</option>
              {roles.map((r) => (
                <option key={r.id} value={r.slug}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>

          <Field id="status" label="Status" error={firstError('status')}>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={isSelf}
              aria-invalid={!!firstError('status')}
              aria-describedby={describedBy('status')}
              className={inputClass(!!firstError('status'))}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {isSelf && <p className="-mt-2 text-xs text-slate-500">Anda tidak dapat mengubah role atau status akun sendiri.</p>}
        {rolesError && roles.length === 0 && (
          <p role="alert" className="-mt-2 text-xs text-red-600">
            Daftar role gagal dimuat.{' '}
            <button type="button" onClick={onRetryRoles} className="font-medium underline">
              Coba lagi
            </button>
          </p>
        )}

        <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-600">
          {isEdit
            ? 'Kata sandi tidak diubah dari sini. Untuk pengguna yang lupa kata sandi, gunakan aksi "Reset kata sandi" di daftar pengguna.'
            : 'Kata sandi sementara dibuat otomatis oleh sistem dan ditampilkan sekali setelah akun dibuat. Pengguna wajib menggantinya saat login pertama, sehingga Admin tidak pernah mengetahui kata sandi akhirnya.'}
        </p>
      </form>
    </Modal>
  )
}
