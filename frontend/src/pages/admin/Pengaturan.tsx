import { Check, LockKeyhole, Plus, Save, Trash2 } from 'lucide-react'
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

interface RoleSetting {
  id: number
  slug: string
  name: string
  description: string | null
  is_system: boolean
  is_locked: boolean
  users_count: number
  permissions_count: number
  permissions: string[]
  required_permissions: string[]
}

interface Permission {
  slug: string
  name: string
  module: string
  action: 'read' | 'create' | 'update' | 'delete' | 'other'
  admin_only: boolean
}

interface PermissionGroup {
  module: string
  permissions: Permission[]
}

interface RoleListResponse {
  data: RoleSetting[]
  summary: { total_roles: number; total_users: number; custom_roles: number }
}

interface RoleResponse {
  data: RoleSetting
  message?: string
}

interface PermissionResponse {
  data: PermissionGroup[]
}

type FieldErrors = Record<string, string[]>

const ACTION_LABEL: Record<Permission['action'], string> = {
  read: 'Lihat',
  create: 'Tambah',
  update: 'Ubah',
  delete: 'Hapus',
  other: 'Khusus',
}

function PermissionSelector({
  groups,
  selected,
  required = [],
  canEdit,
  onToggle,
}: {
  groups: PermissionGroup[]
  selected: string[]
  required?: string[]
  canEdit: (permission: Permission) => boolean
  onToggle: (slug: string) => void
}) {
  const selectedSet = new Set(selected)
  const requiredSet = new Set(required)

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const groupSelected = group.permissions.filter((permission) => selectedSet.has(permission.slug)).length
        return (
          <section key={group.module} className="overflow-hidden rounded-xl border border-slate-200">
            <header className="flex items-center justify-between gap-3 bg-slate-50 px-4 py-3">
              <h3 className="text-sm font-semibold text-ink-900">{group.module}</h3>
              <span className="text-xs text-slate-500">{groupSelected}/{group.permissions.length} izin</span>
            </header>
            <div className="grid gap-1 p-2 sm:grid-cols-2">
              {group.permissions.map((permission) => {
                const isRequired = requiredSet.has(permission.slug)
                const isChecked = selectedSet.has(permission.slug)
                const disabled = !canEdit(permission) || isRequired
                return (
                  <label
                    key={permission.slug}
                    className={`flex min-w-0 items-start gap-3 rounded-lg px-3 py-2.5 ${disabled ? 'cursor-not-allowed bg-slate-50/70' : 'cursor-pointer hover:bg-slate-50'}`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={disabled}
                      onChange={() => onToggle(permission.slug)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500 disabled:opacity-50"
                      aria-label={`${permission.name}${isRequired ? ', wajib' : permission.admin_only ? ', khusus Admin' : ''}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm leading-5 text-slate-800">{permission.name}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge tone={permission.admin_only ? 'warning' : 'neutral'}>{permission.admin_only ? 'Khusus Admin' : ACTION_LABEL[permission.action]}</Badge>
                        {isRequired && <Badge tone="info">Wajib</Badge>}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

export default function AdminPengaturan() {
  const { user } = useAuth()
  const canManage = user?.permissions.includes('roles.manage') ?? false
  const roles = useApiData(async () => (await api.get<RoleListResponse>('/settings/roles')).data, [])
  const catalog = useApiData(async () => (await api.get<PermissionResponse>('/settings/permissions')).data, [])

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

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

  const roleDetail = useApiData<RoleResponse | null>(
    async () => (selectedId === null ? null : (await api.get<RoleResponse>(`/settings/roles/${selectedId}`)).data),
    [selectedId],
  )
  const selectedRole = roleDetail.data?.data
  const isCurrentRole = selectedRole?.id === selectedId
  const permissionGroups = catalog.data?.data ?? []

  useEffect(() => {
    if (!roles.data) return
    if (selectedId === null || !roles.data.data.some((role) => role.id === selectedId)) {
      setSelectedId(roles.data.data[0]?.id ?? null)
    }
  }, [roles.data, selectedId])

  useEffect(() => {
    if (!selectedRole || selectedRole.id !== selectedId) return
    setName(selectedRole.name)
    setDescription(selectedRole.description ?? '')
    setSelectedPermissions(selectedRole.permissions)
    setErrors({})
    setSaveError(null)
  }, [selectedRole, selectedId])

  const permissionIdsEqual = useMemo(() => {
    if (!selectedRole) return false
    const saved = [...selectedRole.permissions].sort()
    const draft = [...selectedPermissions].sort()
    return saved.length === draft.length && saved.every((permission, index) => permission === draft[index])
  }, [selectedRole, selectedPermissions])

  const dirty = !!selectedRole && (
    (selectedRole.is_system ? false : name.trim() !== selectedRole.name) ||
    description !== (selectedRole.description ?? '') ||
    !permissionIdsEqual
  )

  const togglePermission = (slug: string, create = false) => {
    const setter = create ? setNewPermissions : setSelectedPermissions
    setter((current) => current.includes(slug) ? current.filter((value) => value !== slug) : [...current, slug])
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
    if (!selectedRole.is_system && name.trim() !== selectedRole.name) payload.name = name.trim()
    if (!permissionIdsEqual) payload.permissions = selectedPermissions
    try {
      const response = await api.patch<RoleResponse>(`/settings/roles/${selectedRole.id}`, payload)
      setNotice({ tone: 'success', text: response.data.message ?? 'Pengaturan role berhasil disimpan.' })
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
      const response = await api.post<RoleResponse>('/settings/roles', {
        name: newName.trim(),
        description: newDescription.trim() || null,
        permissions: newPermissions,
      })
      setDialogOpen(false)
      setNewName('')
      setNewDescription('')
      setNewPermissions([])
      setNotice({ tone: 'success', text: response.data.message ?? 'Role berhasil dibuat.' })
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

  const deleteRole = async () => {
    if (!selectedRole) return
    setBusy(true)
    setDeleteError(null)
    try {
      const response = await api.delete<{ message?: string }>(`/settings/roles/${selectedRole.id}`)
      setNotice({ tone: 'success', text: response.data.message ?? 'Role berhasil dihapus.' })
      setDeleteOpen(false)
      setSelectedId(null)
      roles.reload()
    } catch (error) {
      setDeleteError(toApiError(error).message)
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

  const isCreatePermissionEditable = (permission: Permission) => canManage && !permission.admin_only
  const isRolePermissionEditable = (permission: Permission) =>
    canManage && !!selectedRole && !selectedRole.is_locked && !permission.admin_only

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

      {notice && (
        <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.text}
        </Notice>
      )}

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

      {(roles.error || catalog.error) && (
        <ErrorState
          error={roles.error ?? catalog.error!}
          onRetry={() => {
            roles.reload()
            catalog.reload()
          }}
        />
      )}
      {(roles.loading || catalog.loading) && !roles.data && <Spinner label="Memuat konfigurasi role dan izin…" />}

      {roles.data && catalog.data && roles.data.data.length === 0 && (
        <Card><EmptyState title="Belum ada role" description="Role yang tersedia akan muncul di sini." /></Card>
      )}

      {roles.data && catalog.data && roles.data.data.length > 0 && (
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
                    selectedId === role.id
                      ? 'border-brand-300 bg-brand-50 ring-1 ring-brand-100'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink-900">{role.name}</span>
                      <span className="mt-1 block text-xs text-slate-500">{role.users_count} pengguna</span>
                    </span>
                    {role.is_locked ? (
                      <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-label="Role terkunci" />
                    ) : role.is_system ? (
                      <Badge tone="info">Bawaan</Badge>
                    ) : (
                      <Badge tone="neutral">Khusus</Badge>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </Card>

          <div className="min-w-0">
            {selectedId === null && <Card><EmptyState title="Pilih role" description="Pilih role untuk melihat pengaturannya." /></Card>}
            {selectedId !== null && roleDetail.loading && !isCurrentRole && <Card><Spinner label="Memuat detail role…" /></Card>}
            {roleDetail.error && <Card><ErrorState error={roleDetail.error} onRetry={roleDetail.reload} /></Card>}
            {selectedRole && isCurrentRole && (
              <form onSubmit={updateRole} className="space-y-5">
                <Card
                  title="Informasi Role"
                  action={
                    <div className="flex items-center gap-2">
                      {selectedRole.is_system && <Badge tone="info">Role bawaan</Badge>}
                      {selectedRole.is_locked && <Badge tone="warning">Terkunci</Badge>}
                    </div>
                  }
                >
                  {saveError && <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{saveError}</p>}
                  <div className="grid gap-4 sm:grid-cols-2">
                    {!selectedRole.is_system && (
                      <Field id="role-name" label="Nama role" error={errors.name?.[0]}>
                        <input
                          id="role-name"
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          maxLength={100}
                          minLength={3}
                          disabled={!canManage || selectedRole.is_locked}
                          aria-invalid={!!errors.name}
                          aria-describedby={errors.name ? 'role-name-help' : undefined}
                          className={inputClass(!!errors.name)}
                        />
                      </Field>
                    )}
                    <div className={!selectedRole.is_system ? '' : 'sm:col-span-2'}>
                      <Field id="role-description" label="Deskripsi" error={errors.description?.[0]} hint="Opsional, maksimal 255 karakter.">
                        <textarea
                          id="role-description"
                          value={description}
                          onChange={(event) => setDescription(event.target.value)}
                          rows={2}
                          maxLength={255}
                          disabled={!canManage || selectedRole.is_locked}
                          aria-invalid={!!errors.description}
                          aria-describedby={errors.description ? 'role-description-help' : 'role-description-help'}
                          className={inputClass(!!errors.description)}
                        />
                      </Field>
                    </div>
                  </div>
                  {selectedRole.is_system && !selectedRole.is_locked && (
                    <p className="mt-3 text-xs text-slate-500">Nama role bawaan tidak dapat diubah.</p>
                  )}
                  {selectedRole.is_locked && (
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-700">
                      <LockKeyhole className="h-3.5 w-3.5" aria-hidden />
                      Role Admin dikunci untuk mencegah Admin kehilangan akses ke sistem.
                    </p>
                  )}
                </Card>

                <Card
                  title="Matriks Hak Akses"
                  action={<Badge tone="neutral">{selectedPermissions.length} izin aktif</Badge>}
                >
                  <p className="mb-4 text-sm text-slate-500">
                    Pilih izin yang dapat dilakukan role ini. Izin khusus Admin dan akses dashboard wajib tidak dapat dicabut.
                  </p>
                  {errors.permissions?.[0] && (
                    <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errors.permissions[0]}</p>
                  )}
                  <PermissionSelector
                    groups={permissionGroups}
                    selected={selectedPermissions}
                    required={selectedRole.required_permissions}
                    canEdit={isRolePermissionEditable}
                    onToggle={(slug) => togglePermission(slug)}
                  />
                </Card>

                {canManage && (
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      {!selectedRole.is_system && (
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={selectedRole.users_count > 0}
                          onClick={() => {
                            setDeleteError(null)
                            setDeleteOpen(true)
                          }}
                          icon={<Trash2 className="h-4 w-4" aria-hidden />}
                          className="text-red-600 hover:bg-red-50"
                        >
                          Hapus Role
                        </Button>
                      )}
                      {!selectedRole.is_system && selectedRole.users_count > 0 && (
                        <p className="mt-1 text-xs text-slate-500">Role yang masih dipakai pengguna tidak dapat dihapus.</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={!dirty || saving}
                        onClick={() => {
                          setName(selectedRole.name)
                          setDescription(selectedRole.description ?? '')
                          setSelectedPermissions(selectedRole.permissions)
                          setErrors({})
                          setSaveError(null)
                        }}
                      >
                        Urungkan
                      </Button>
                      <Button
                        type="submit"
                        loading={saving}
                        disabled={!dirty}
                        icon={<Save className="h-4 w-4" aria-hidden />}
                      >
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
        dismissible={!creating}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={closeCreate} disabled={creating}>Batal</Button>
            <Button type="submit" form="create-role-form" loading={creating} icon={<Check className="h-4 w-4" aria-hidden />}>Buat Role</Button>
          </>
        }
      >
        <form id="create-role-form" onSubmit={createRole} noValidate className="space-y-5">
          {createError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{createError}</p>}
          <Field id="new-role-name" label="Nama role" error={createErrors.name?.[0]} hint="3–100 karakter. Nama harus unik.">
            <input
              id="new-role-name"
              data-autofocus
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              minLength={3}
              maxLength={100}
              aria-invalid={!!createErrors.name}
              aria-describedby={createErrors.name ? 'new-role-name-help' : 'new-role-name-help'}
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
            {createErrors.permissions?.[0] && (
              <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{createErrors.permissions[0]}</p>
            )}
            <PermissionSelector
              groups={permissionGroups}
              selected={newPermissions}
              canEdit={isCreatePermissionEditable}
              onToggle={(slug) => togglePermission(slug, true)}
            />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        title="Hapus role khusus?"
        tone="danger"
        confirmLabel="Hapus Role"
        loading={busy}
        error={deleteError}
        onCancel={() => {
          if (!busy) setDeleteOpen(false)
        }}
        onConfirm={() => void deleteRole()}
        message={
          selectedRole && (
            <>
              Role <strong>{selectedRole.name}</strong> akan dihapus permanen bersama pemetaan izinnya. Tindakan ini tidak dapat dibatalkan.
            </>
          )
        }
      />
    </>
  )
}
