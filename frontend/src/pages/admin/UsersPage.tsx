import { Download, Eye, Pencil, Plus, RotateCcw, Search, Trash2 } from 'lucide-react'
import { type FormEvent, type ReactNode, useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { inputClass } from '../../components/ui/Field'
import { Notice } from '../../components/ui/Notice'
import { PageHeader } from '../../components/ui/PageHeader'
import { EmptyState, ErrorState, Spinner } from '../../components/ui/States'
import { ROLE_CONFIG, ROLE_SLUGS } from '../../config/navigation'
import { api, toApiError } from '../../lib/api'
import { STATUS_LABEL, formatDate, formatDateTime, initials } from '../../lib/format'
import { useApiData } from '../../lib/useApiData'
import type { AdminSummary, ApiMessage, Paginated, Role, RoleSlug, User } from '../../types'
import { UserDetailModal } from './users/UserDetailModal'
import { UserFormModal } from './users/UserFormModal'
import { STATUS_OPTIONS, STATUS_TONE } from './users/shared'

type Tab = 'all' | 'trashed' | RoleSlug

type Dialog =
  | { type: 'create' }
  | { type: 'detail'; user: User }
  | { type: 'edit'; user: User }
  | { type: 'delete'; user: User }
  | { type: 'restore'; user: User }
  | null

const PER_PAGE = 15

function IconButton({ label, onClick, disabled = false, danger = false, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`rounded-lg p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  )
}

export default function UsersPage() {
  const { user: me } = useAuth()

  const [tab, setTab] = useState<Tab>('all')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')

  const [dialog, setDialog] = useState<Dialog>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  // Filter yang sama dipakai untuk daftar dan untuk ekspor CSV.
  const filters = {
    q: query || undefined,
    status: status || undefined,
    role: tab !== 'all' && tab !== 'trashed' ? tab : undefined,
    trashed: tab === 'trashed' ? 'only' : undefined,
  }

  const list = useApiData(
    async () => (await api.get<Paginated<User>>('/users', { params: { ...filters, page, per_page: PER_PAGE } })).data,
    [page, query, status, tab],
  )
  const summary = useApiData(async () => (await api.get<{ data: AdminSummary }>('/admin/summary')).data.data, [])
  const roles = useApiData(async () => (await api.get<{ data: Role[] }>('/roles')).data.data, [])

  // Pesan sukses hilang sendiri.
  useEffect(() => {
    if (notice?.tone !== 'success') return
    const timer = window.setTimeout(() => setNotice(null), 6000)
    return () => window.clearTimeout(timer)
  }, [notice])

  // Setelah menghapus baris terakhir di halaman terakhir, mundur ke halaman yang masih ada.
  useEffect(() => {
    if (list.data && list.data.data.length === 0 && page > 1) setPage(Math.max(1, list.data.meta.last_page))
  }, [list.data, page])

  const countByRole = new Map((summary.data?.users_by_role ?? []).map((r) => [r.slug, r.users_count]))
  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'all', label: 'Semua', count: summary.data?.users_total },
    ...ROLE_SLUGS.map((slug) => ({ key: slug as Tab, label: ROLE_CONFIG[slug].label, count: countByRole.get(slug) })),
    { key: 'trashed', label: 'Dihapus', count: summary.data?.users_trashed },
  ]

  const changeTab = (next: Tab) => {
    setTab(next)
    setPage(1)
  }

  const onSearch = (event: FormEvent) => {
    event.preventDefault()
    setPage(1)
    setQuery(input.trim())
  }

  const resetFilters = () => {
    setInput('')
    setQuery('')
    setStatus('')
    setTab('all')
    setPage(1)
  }

  const closeDialog = () => {
    setDialog(null)
    setDialogError(null)
  }

  const afterChange = (text: string) => {
    closeDialog()
    setNotice({ tone: 'success', text })
    list.reload()
    summary.reload()
  }

  const runMutation = async (action: () => Promise<{ data: { message?: string } }>) => {
    setBusy(true)
    setDialogError(null)
    try {
      const res = await action()
      afterChange(res.data.message ?? 'Berhasil.')
    } catch (error) {
      setDialogError(toApiError(error).message)
    } finally {
      setBusy(false)
    }
  }

  const exportCsv = async () => {
    setExporting(true)
    setNotice(null)
    try {
      // Memakai axios (bukan <a href>) agar cookie sesi ikut terkirim.
      const res = await api.get<Blob>('/users/export', { params: filters, responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const link = document.createElement('a')
      link.href = url
      link.download = `pengguna-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      setNotice({ tone: 'error', text: toApiError(error).message })
    } finally {
      setExporting(false)
    }
  }

  const data = list.data
  const filtering = !!query || !!status || tab !== 'all'

  return (
    <>
      <PageHeader
        title="Manajemen Pengguna"
        description={summary.data ? `${summary.data.users_total} pengguna terdaftar di sistem` : 'Kelola akun pengguna sistem.'}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={exportCsv} loading={exporting} icon={<Download className="h-4 w-4" aria-hidden />}>
              Export CSV
            </Button>
            <Button onClick={() => setDialog({ type: 'create' })} icon={<Plus className="h-4 w-4" aria-hidden />}>
              Tambah Pengguna
            </Button>
          </div>
        }
      />

      {notice && (
        <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.text}
        </Notice>
      )}

      <Card>
        <div role="group" aria-label="Filter role" className="-mt-1 mb-4 flex gap-2 overflow-x-auto pb-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              aria-pressed={tab === t.key}
              onClick={() => changeTab(t.key)}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                tab === t.key ? 'bg-ink-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t.label}
              {t.count !== undefined && <span className="ml-1.5 opacity-70">({t.count})</span>}
            </button>
          ))}
        </div>

        <form onSubmit={onSearch} className="mb-4 flex flex-wrap gap-2" role="search">
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
            <input
              type="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Cari nama atau email"
              aria-label="Cari pengguna"
              maxLength={100}
              className={`${inputClass()} pl-9`}
            />
          </div>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setPage(1)
            }}
            aria-label="Filter status"
            className={`${inputClass()} !w-auto`}
          >
            <option value="">Semua status</option>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <Button type="submit" variant="secondary">
            Cari
          </Button>
          {filtering && (
            <Button variant="ghost" onClick={resetFilters}>
              Reset
            </Button>
          )}
        </form>

        {list.loading && !data && <Spinner label="Memuat pengguna…" />}
        {list.error && <ErrorState error={list.error} onRetry={list.reload} />}

        {data && data.data.length === 0 && (
          <EmptyState
            title={tab === 'trashed' ? 'Tidak ada pengguna yang dihapus' : 'Pengguna tidak ditemukan'}
            description={filtering ? 'Coba ubah atau reset filter pencarian.' : 'Belum ada pengguna terdaftar.'}
          />
        )}

        {data && data.data.length > 0 && (
          <>
            <div className={`overflow-x-auto transition-opacity ${list.loading ? 'opacity-60' : ''}`}>
              <table className="w-full min-w-[44rem] text-left text-sm">
                <thead className="text-xs text-slate-500">
                  <tr>
                    <th className="pb-2 font-medium">Pengguna</th>
                    <th className="pb-2 font-medium">Role</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Bergabung</th>
                    <th className="pb-2 font-medium">Login terakhir</th>
                    <th className="pb-2 text-right font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.data.map((row) => {
                    const isSelf = row.id === me?.id
                    const trashed = !!row.deleted_at
                    return (
                      <tr key={row.id}>
                        <td className="py-2.5">
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700" aria-hidden>
                              {initials(row.name)}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-800">{row.name}</p>
                              <p className="truncate text-xs text-slate-500">{row.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5">{row.roles.map((r) => r.name).join(', ') || '—'}</td>
                        <td className="py-2.5">
                          {trashed ? (
                            <Badge tone="danger">Dihapus</Badge>
                          ) : (
                            <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status] ?? row.status}</Badge>
                          )}
                        </td>
                        <td className="py-2.5 text-slate-600">{formatDate(row.created_at)}</td>
                        <td className="py-2.5 text-slate-600">{formatDateTime(row.last_login_at)}</td>
                        <td className="py-2.5">
                          <div className="flex justify-end gap-0.5">
                            <IconButton label={`Lihat detail ${row.name}`} onClick={() => setDialog({ type: 'detail', user: row })}>
                              <Eye className="h-4 w-4" aria-hidden />
                            </IconButton>
                            {trashed ? (
                              <IconButton label={`Pulihkan ${row.name}`} onClick={() => setDialog({ type: 'restore', user: row })}>
                                <RotateCcw className="h-4 w-4" aria-hidden />
                              </IconButton>
                            ) : (
                              <>
                                <IconButton label={`Ubah ${row.name}`} onClick={() => setDialog({ type: 'edit', user: row })}>
                                  <Pencil className="h-4 w-4" aria-hidden />
                                </IconButton>
                                <IconButton
                                  label={isSelf ? 'Tidak dapat menghapus akun sendiri' : `Hapus ${row.name}`}
                                  danger
                                  disabled={isSelf}
                                  onClick={() => setDialog({ type: 'delete', user: row })}
                                >
                                  <Trash2 className="h-4 w-4" aria-hidden />
                                </IconButton>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
              <span>
                Halaman {data.meta.current_page} dari {data.meta.last_page} · {data.meta.total} pengguna
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Sebelumnya
                </Button>
                <Button variant="secondary" disabled={page >= data.meta.last_page} onClick={() => setPage((p) => p + 1)}>
                  Berikutnya
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {dialog?.type === 'create' && (
        <UserFormModal
          mode="create"
          roles={roles.data ?? []}
          rolesLoading={roles.loading && !roles.data}
          rolesError={!!roles.error}
          onRetryRoles={roles.reload}
          currentUserId={me?.id}
          onClose={closeDialog}
          onSaved={afterChange}
        />
      )}
      {dialog?.type === 'edit' && (
        <UserFormModal
          mode="edit"
          user={dialog.user}
          roles={roles.data ?? []}
          rolesLoading={roles.loading && !roles.data}
          rolesError={!!roles.error}
          onRetryRoles={roles.reload}
          currentUserId={me?.id}
          onClose={closeDialog}
          onSaved={afterChange}
        />
      )}
      {dialog?.type === 'detail' && <UserDetailModal userId={dialog.user.id} onClose={closeDialog} onEdit={(user) => setDialog({ type: 'edit', user })} />}

      <ConfirmDialog
        open={dialog?.type === 'delete'}
        title="Hapus pengguna?"
        tone="danger"
        confirmLabel="Hapus"
        loading={busy}
        error={dialogError}
        onCancel={closeDialog}
        onConfirm={() => dialog?.type === 'delete' && runMutation(() => api.delete<{ message?: string }>(`/users/${dialog.user.id}`))}
        message={
          dialog?.type === 'delete' && (
            <>
              <strong>{dialog.user.name}</strong> ({dialog.user.email}) tidak akan bisa login lagi dan akan dikeluarkan dari semua perangkat. Data tidak dihapus permanen; akun dapat
              dipulihkan dari tab <em>Dihapus</em>.
            </>
          )
        }
      />

      <ConfirmDialog
        open={dialog?.type === 'restore'}
        title="Pulihkan pengguna?"
        confirmLabel="Pulihkan"
        loading={busy}
        error={dialogError}
        onCancel={closeDialog}
        onConfirm={() => dialog?.type === 'restore' && runMutation(() => api.post<ApiMessage<User>>(`/users/${dialog.user.id}/restore`))}
        message={
          dialog?.type === 'restore' && (
            <>
              Akun <strong>{dialog.user.name}</strong> akan aktif kembali dengan role dan status seperti sebelum dihapus.
            </>
          )
        }
      />
    </>
  )
}
