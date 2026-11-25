import { Check, LockKeyhole, Plus, RotateCcw, Save, Trash2 } from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, StatCard } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Field, inputClass } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { Notice } from '../../components/ui/Notice'
import { PageHeader } from '../../components/ui/PageHeader'
import { EmptyState, ErrorState, Spinner } from '../../components/ui/States'
import { api, toApiError } from '../../lib/api'
import { useApiData } from '../../lib/useApiData'
import { PermissionMatrix, type PermissionChange } from './settings/PermissionMatrix'
import { type CatalogResponse, type RoleDetailResponse, type RoleListResponse, customRoleMatrix, grantedSlugs } from './settings/types'

type FieldErrors = Record<string, string[]>

/** Menerapkan perubahan sakelar pada daftar slug. */
function applyChange(current: string[], { slugs, on }: PermissionChange): string[] {
  return on ? [...new Set([...current, ...slugs])] : current.filter((slug) => !slugs.includes(slug))
}

export default function AdminPengaturan() {
  const { user } = useAuth()
  const canManage = user?.permissions.includes('roles.manage') ?? false
  const roles = useApiData(async () => (await api.get<RoleListResponse>('/settings/roles')).data, [])
  const catalog = useApiData(async () => (await api.get<CatalogResponse>('/settings/permissions')).data, [])

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [confirm, setConfirm] = useState<'delete' | 'reset' | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  /** Perubahan yang menyalakan izin sensitif, menunggu persetujuan Admin. */
  const [pending, setPending] = useState<{ target: 'edit' | 'create'; change: PermissionChange } | null>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newPermissions, setNewPermissions] = useState<string[]>([])
  const [createErrors, setCreateErrors] = useState<FieldErrors>({})
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const roleDetail = useApiData<RoleDetailResponse | null>(
    async () => (selectedId === null ? null : (await api.get<RoleDetailResponse>(`/settings/roles/${selectedId}`)).data),
    [selectedId],
  )
  const detail = roleDetail.data && roleDetail.data.data.id === selectedId ? roleDetail.data : null
  const selectedRole = detail?.data
  // Diambil dari matriks, bukan dari `permissions`: izin wajib selalu ikut, izin lama yang tidak berlaku tidak terkirim.
  const savedPermissions = useMemo(() => (detail ? grantedSlugs(detail.matrix) : []), [detail])
  const obsoletePermissions = selectedRole?.permissions.filter((slug) => !savedPermissions.includes(slug)) ?? []
  const createMatrix = useMemo(() => (catalog.data ? customRoleMatrix(catalog.data) : []), [catalog.data])

  useEffect(() => {
    if (!roles.data) return
    const list = roles.data.data
    setSelectedId((current) => (current !== null && list.some((role) => role.id === current) ? current : (list[0]?.id ?? null)))
  }, [roles.data])

  const resetDraft = () => {
    if (!detail) return
    setName(detail.data.name)
    setDescription(detail.data.description ?? '')
    setSelectedPermissions(savedPermissions)
    setErrors({})
    setSaveError(null)
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(resetDraft, [detail, savedPermissions])

  const permissionsChanged =
    selectedPermissions.length !== savedPermissions.length || selectedPermissions.some((slug) => !savedPermissions.includes(slug))

  const dirty =
    !!selectedRole &&
    ((selectedRole.can_rename && name.trim() !== selectedRole.name) || description.trim() !== (selectedRole.description ?? '') || permissionsChanged)

  const setterFor = (target: 'edit' | 'create') => (target === 'create' ? setNewPermissions : setSelectedPermissions)

  const changePermissions = (target: 'edit' | 'create') => (change: PermissionChange) => {
    if (change.sensitive.length > 0) setPending({ target, change })
    else setterFor(target)((current) => applyChange(current, change))
  }

  const confirmPending = () => {
    if (!pending) return
    setterFor(pending.target)((current) => applyChange(current, pending.change))
    setPending(null)
  }

  const showSuccess = (text: string) => {
    setNotice(text)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const updateRole = async (event: FormEvent) => {
    event.preventDefault()
    if (!selectedRole || !dirty) return
    setSaving(true)
    setSaveError(null)
    setErrors({})
    const payload: { name?: string; description: string | null; permissions?: string[] } = {
      description: description.trim() || null,
    }
    if (selectedRole.can_rename && name.trim() !== selectedRole.name) payload.name = name.trim()
    if (permissionsChanged) payload.permissions = selectedPermissions
    try {
      const response = await api.patch<RoleDetailResponse>(`/settings/roles/${selectedRole.id}`, payload)
      showSuccess(response.data.message ?? 'Pengaturan role berhasil disimpan.')
      roles.reload()
      roleDetail.reload()
    } catch (error) {
      const apiError = toApiError(error)
      if (apiError.kind === 'validation' && Object.keys(apiError.fieldErrors).length > 0) setErrors(apiError.fieldErrors)
      else setSaveError(apiError.message)
    } finally {
      setSaving(false)
    }
  }

  const createRole = async (event: FormEvent) => {
    event.preventDefault()
    setCreating(true)
    setCreateError(null)
    setCreateErrors({})
    try {
      const response = await api.post<RoleDetailResponse>('/settings/roles', {
        name: newName.trim(),
        description: newDescription.trim() || null,
        permissions: newPermissions,
      })
      setDialogOpen(false)
      setNewName('')
      setNewDescription('')
      setNewPermissions([])
      showSuccess(response.data.message ?? 'Role berhasil dibuat.')
      setSelectedId(response.data.data.id)
      roles.reload()
    } catch (error) {
      const apiError = toApiError(error)
      if (apiError.kind === 'validation' && Object.keys(apiError.fieldErrors).length > 0) setCreateErrors(apiError.fieldErrors)
      else setCreateError(apiError.message)
    } finally {
      setCreating(false)
    }
  }

  const openConfirm = (kind: 'delete' | 'reset') => {
    setConfirmError(null)
    setConfirm(kind)
  }

  const runConfirm = async () => {
    if (!selectedRole || !confirm) return
    const url = `/settings/roles/${selectedRole.id}`
    setBusy(true)
    setConfirmError(null)
    try {
      const response = confirm === 'delete' ? await api.delete<{ message?: string }>(url) : await api.post<{ message?: string }>(`${url}/reset`)
      showSuccess(response.data.message ?? 'Perubahan role berhasil disimpan.')
      if (confirm === 'delete') setSelectedId(null)
      else roleDetail.reload()
      setConfirm(null)
      roles.reload()
    } catch (error) {
      setConfirmError(toApiError(error).message)
    } finally {
      setBusy(false)
    }
  }

  const closeCreate = () => {
    if (creating) return
    setDialogOpen(false)
    setCreateError(null)
    setCreateErrors({})
  }

  return (
    <>
      <PageHeader
        title="Pengaturan Role & Akses"
        description="Atur hak akses per role dengan prinsip least privilege."
        action={
          canManage ? (
            <Button onClick={() => setDialogOpen(true)} icon={<Plus className="h-4 w-4" aria-hidden />}>
              Tambah Role
            </Button>
          ) : undefined
        }
      />

      {notice && <Notice onDismiss={() => setNotice(null)}>{notice}</Notice>}

      {!canManage && (
        <div className="mb-5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>Anda dapat melihat konfigurasi role, tetapi tidak memiliki izin untuk mengubahnya.</p>
        </div>
      )}

      {roles.data && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <StatCard label="Total role" value={roles.data.summary.total_roles} hint="Role bawaan dan khusus" />
          <StatCard label="Total pengguna" value={roles.data.summary.total_users} hint="Pengguna di seluruh role" />
          <StatCard label="Role khusus" value={roles.data.summary.custom_roles} hint="Role yang dibuat Admin" />
        </div>
      )}

      {roles.error && <ErrorState error={roles.error} onRetry={roles.reload} />}
      {roles.loading && !roles.data && <Spinner label="Memuat konfigurasi role dan izin…" />}

      {roles.data && roles.data.data.length === 0 && (
        <Card>
          <EmptyState title="Belum ada role" description="Role yang tersedia akan muncul di sini." />
        </Card>
      )}

      {roles.data && roles.data.data.length > 0 && (
        <div className="grid items-start gap-5 lg:grid-cols-[17rem_minmax(0,1fr)]">
          <Card title="Daftar Role">
            <div className="space-y-2">
              {roles.data.data.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setSelectedId(role.id)}
                  aria-current={selectedId === role.id ? 'true' : undefined}
                  className={`w-full rounded-xl border p-3 text-left transition-colors ${
                    selectedId === role.id ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-100' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink-900">{role.name}</span>
                      <span className="mt-1 block text-xs text-slate-500">
                        {role.users_count} pengguna · {role.permissions_count} izin
                      </span>
                    </span>
                    <Badge tone={role.is_system ? 'info' : 'neutral'}>{role.is_system ? 'Bawaan' : 'Khusus'}</Badge>
                  </span>
                </button>
              ))}
            </div>
          </Card>

          <div className="min-w-0">
            {roleDetail.loading && !detail && (
              <Card>
                <Spinner label="Memuat detail role…" />
              </Card>
            )}
            {roleDetail.error && (
              <Card>
                <ErrorState error={roleDetail.error} onRetry={roleDetail.reload} />
              </Card>
            )}
            {detail && selectedRole && (
              <form onSubmit={updateRole} className="space-y-5">
                <Card title="Informasi Role" action={selectedRole.is_system && <Badge tone="info">Role bawaan</Badge>}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {selectedRole.can_rename && (
                      <Field id="role-name" label="Nama role" error={errors.name?.[0]}>
                        <input
                          id="role-name"
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          maxLength={100}
                          minLength={3}
                          disabled={!canManage}
                          aria-invalid={!!errors.name}
                          aria-describedby={errors.name ? 'role-name-help' : undefined}
                          className={inputClass(!!errors.name)}
                        />
                      </Field>
                    )}
                    <div className={selectedRole.can_rename ? '' : 'sm:col-span-2'}>
                      <Field id="role-description" label="Deskripsi" error={errors.description?.[0]} hint="Opsional, maksimal 255 karakter.">
                        <textarea
                          id="role-description"
                          value={description}
                          onChange={(event) => setDescription(event.target.value)}
                          rows={2}
                          maxLength={255}
                          disabled={!canManage}
                          aria-invalid={!!errors.description}
                          aria-describedby="role-description-help"
                          className={inputClass(!!errors.description)}
                        />
                      </Field>
                    </div>
                  </div>
                  {!selectedRole.can_rename && <p className="mt-3 text-xs text-slate-500">Nama role bawaan tidak dapat diubah.</p>}
                </Card>

                <Card title="Matriks Hak Akses" action={<Badge tone="neutral">{selectedPermissions.length} izin aktif</Badge>}>
                  <p className="mb-4 text-sm text-slate-500">
                    Perubahan langsung berlaku untuk semua akun dengan role ini. Sakelar bergembok wajib menyala, dan fitur yang belum tersedia tidak dapat
                    dinyalakan.
                  </p>
                  {obsoletePermissions.length > 0 && (
                    <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      Role ini masih memiliki izin lama yang tidak berlaku lagi ({obsoletePermissions.join(', ')}). Izin itu dilepas saat perubahan izin disimpan.
                    </p>
                  )}
                  <PermissionMatrix
                    key={selectedRole.id}
                    id="role"
                    modules={detail.matrix}
                    selected={selectedPermissions}
                    readOnly={!canManage || saving}
                    onChange={changePermissions('edit')}
                  />
                </Card>

                {saveError && <Notice tone="error">{saveError}</Notice>}
                {errors.permissions && <Notice tone="error">{errors.permissions.join(' ')}</Notice>}

                {canManage && (
                  <div className="flex flex-wrap justify-between gap-2">
                    {selectedRole.can_delete ? (
                      <div>
                        <Button
                          variant="ghost"
                          disabled={selectedRole.users_count > 0}
                          onClick={() => openConfirm('delete')}
                          icon={<Trash2 className="h-4 w-4" aria-hidden />}
                          className="text-red-600 hover:bg-red-50"
                        >
                          Hapus Role
                        </Button>
                        {selectedRole.users_count > 0 && (
                          <p className="mt-1 text-xs text-slate-500">Role yang masih dipakai pengguna tidak dapat dihapus.</p>
                        )}
                      </div>
                    ) : (
                      <Button variant="ghost" disabled={saving} onClick={() => openConfirm('reset')} icon={<RotateCcw className="h-4 w-4" aria-hidden />}>
                        Atur ulang ke bawaan
                      </Button>
                    )}
                    <div className="flex gap-2">
                      <Button variant="secondary" disabled={!dirty || saving} onClick={resetDraft}>
                        Urungkan
                      </Button>
                      <Button type="submit" loading={saving} disabled={!dirty} icon={<Save className="h-4 w-4" aria-hidden />}>
                        Simpan Perubahan
                      </Button>
                    </div>
                  </div>
                )}
              </form>
            )}
          </div>
        </div>
      )}

      <Modal
        open={dialogOpen}
        title="Tambah Role Khusus"
        description="Buat role baru dan pilih izin minimum yang dibutuhkan."
        onClose={closeCreate}
        // Saat dialog izin sensitif terbuka, Escape hanya menutup dialog itu.
        dismissible={!creating && !pending}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={closeCreate} disabled={creating}>
              Batal
            </Button>
            <Button type="submit" form="create-role-form" loading={creating} icon={<Check className="h-4 w-4" aria-hidden />}>
              Buat Role
            </Button>
          </>
        }
      >
        <form id="create-role-form" onSubmit={createRole} noValidate className="space-y-5">
          {createError && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {createError}
            </p>
          )}
          <Field id="new-role-name" label="Nama role" error={createErrors.name?.[0]} hint="3–100 karakter. Nama harus unik.">
            <input
              id="new-role-name"
              data-autofocus
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              minLength={3}
              maxLength={100}
              aria-invalid={!!createErrors.name}
              aria-describedby="new-role-name-help"
              className={inputClass(!!createErrors.name)}
            />
          </Field>
          <Field id="new-role-description" label="Deskripsi (opsional)" error={createErrors.description?.[0]}>
            <textarea
              id="new-role-description"
              value={newDescription}
              onChange={(event) => setNewDescription(event.target.value)}
              rows={2}
              maxLength={255}
              aria-invalid={!!createErrors.description}
              aria-describedby={createErrors.description ? 'new-role-description-help' : undefined}
              className={inputClass(!!createErrors.description)}
            />
          </Field>
          <div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-ink-900">Pilih hak akses</h3>
              <Badge tone="neutral">{newPermissions.length} izin</Badge>
            </div>
            {createErrors.permissions && (
              <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {createErrors.permissions.join(' ')}
              </p>
            )}
            {catalog.loading && !catalog.data && <Spinner label="Memuat daftar izin…" />}
            {catalog.error && <ErrorState error={catalog.error} onRetry={catalog.reload} />}
            {catalog.data && (
              <PermissionMatrix id="new-role" modules={createMatrix} selected={newPermissions} readOnly={creating} onChange={changePermissions('create')} />
            )}
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={pending !== null}
        title="Nyalakan izin sensitif?"
        confirmLabel="Nyalakan"
        onCancel={() => setPending(null)}
        onConfirm={confirmPending}
        message={
          pending && (
            <>
              <p>Izin berikut menyangkut uang atau data akun. Pastikan role ini memang membutuhkannya.</p>
              <ul className="mt-2 list-disc pl-5">
                {pending.change.sensitive.map((label) => (
                  <li key={label}>{label}</li>
                ))}
              </ul>
            </>
          )
        }
      />

      <ConfirmDialog
        open={confirm !== null}
        title={confirm === 'delete' ? 'Hapus role khusus?' : 'Atur ulang izin role?'}
        tone="danger"
        confirmLabel={confirm === 'delete' ? 'Hapus Role' : 'Atur Ulang'}
        loading={busy}
        error={confirmError}
        onCancel={() => {
          if (!busy) setConfirm(null)
        }}
        onConfirm={() => void runConfirm()}
        message={
          selectedRole &&
          (confirm === 'delete' ? (
            <>
              Role <strong>{selectedRole.name}</strong> akan dihapus permanen bersama pemetaan izinnya. Tindakan ini tidak dapat dibatalkan.
            </>
          ) : (
            <>
              Semua izin role <strong>{selectedRole.name}</strong> dikembalikan ke pengaturan awal sistem, dan langsung berlaku untuk {selectedRole.users_count}{' '}
              pengguna.
            </>
          ))
        }
      />
    </>
  )
}
