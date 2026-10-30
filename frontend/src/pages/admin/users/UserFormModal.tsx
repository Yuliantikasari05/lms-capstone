import { Check, Copy, Eye, EyeOff, RefreshCw } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { Field, inputClass } from '../../../components/ui/Field'
import { Modal } from '../../../components/ui/Modal'
import { api, toApiError } from '../../../lib/api'
import type { ApiMessage, Role, User } from '../../../types'
import { STATUS_OPTIONS, generatePassword } from './shared'

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
  onSaved: (message: string) => void
}

type FieldErrors = Record<string, string[]>

/** Form tambah/ubah pengguna. Validasi akhir selalu dari backend (pesan 422 ditampilkan per kolom). */
export function UserFormModal({ mode, user, roles, rolesLoading = false, rolesError = false, onRetryRoles, currentUserId, onClose, onSaved }: Props) {
  const isEdit = mode === 'edit'
  const isSelf = isEdit && user?.id === currentUserId

  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [role, setRole] = useState<string>(user?.primary_role ?? '')
  const [status, setStatus] = useState<string>(user?.status ?? 'active')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [copied, setCopied] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [general, setGeneral] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const firstError = (field: string) => errors[field]?.[0]

  const onGenerate = () => {
    setPassword(generatePassword())
    setShowPassword(true)
    setCopied(false)
  }

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard bisa diblokir browser; pengguna tetap dapat menyalin manual dari kolom.
    }
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setGeneral(null)

    // Pemeriksaan ringan di klien agar cepat; backend tetap yang menentukan.
    const local: FieldErrors = {}
    if (!name.trim()) local.name = ['Nama wajib diisi.']
    if (!email.trim()) local.email = ['Email wajib diisi.']
    if (!isSelf && !role) local.role = ['Role wajib dipilih.']
    if (!isEdit && !password) local.password = ['Kata sandi wajib diisi.']
    setErrors(local)
    if (Object.keys(local).length > 0) return

    const payload: Record<string, unknown> = { name: name.trim(), email: email.trim() }
    if (!isSelf) {
      payload.role = role
      payload.status = status
    }
    if (password) payload.password = password

    setSubmitting(true)
    try {
      const res = isEdit
        ? await api.patch<ApiMessage<User>>(`/users/${user!.id}`, payload)
        : await api.post<ApiMessage<User>>('/users', payload)
      onSaved(res.data.message ?? 'Pengguna berhasil disimpan.')
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

  const describedBy = (field: string, hasHint = false) => (firstError(field) || hasHint ? `${field}-help` : undefined)

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

        <Field id="email" label="Email" error={firstError('email')}>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={255}
            autoComplete="off"
            aria-invalid={!!firstError('email')}
            aria-describedby={describedBy('email')}
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

        <Field
          id="password"
          label={isEdit ? 'Kata sandi baru (opsional)' : 'Kata sandi'}
          error={firstError('password')}
          hint={
            isEdit && !isSelf
              ? 'Kosongkan jika tidak diubah. Jika diisi, pengguna dikeluarkan dari semua perangkat. Minimal 12 karakter, ada huruf dan angka.'
              : 'Minimal 12 karakter, ada huruf dan angka.'
          }
        >
          <div className="flex gap-2">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              aria-invalid={!!firstError('password')}
              aria-describedby={describedBy('password', true)}
              className={`${inputClass(!!firstError('password'))} font-mono`}
            />
            <Button variant="secondary" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}>
              {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={onGenerate} icon={<RefreshCw className="h-4 w-4" aria-hidden />} className="!px-3 !py-1.5 !text-xs">
              Buat acak
            </Button>
            <Button
              variant="secondary"
              onClick={onCopy}
              disabled={!password}
              icon={copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
              className="!px-3 !py-1.5 !text-xs"
            >
              {copied ? 'Tersalin' : 'Salin'}
            </Button>
          </div>
        </Field>
      </form>
    </Modal>
  )
}
