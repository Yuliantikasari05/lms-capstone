import { Eye, Pencil, Plus, RotateCcw, Search, Trash2 } from 'lucide-react'
import { type FormEvent, type ReactNode, useEffect, useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, StatCard } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { inputClass } from '../../components/ui/Field'
import { Notice } from '../../components/ui/Notice'
import { PageHeader } from '../../components/ui/PageHeader'
import { EmptyState, ErrorState, Spinner } from '../../components/ui/States'
import { api, toApiError } from '../../lib/api'
import { formatDateTime } from '../../lib/format'
import { useApiData } from '../../lib/useApiData'
import type { ApiMessage } from '../../types'
import { TemporaryPasswordModal } from './users/TemporaryPasswordModal'
import type { TemporaryPasswordInfo } from './users/shared'
import { InstitutionDetailModal } from './institutions/InstitutionDetailModal'
import { InstitutionFormModal } from './institutions/InstitutionFormModal'
import type { Institution, InstitutionListResponse } from './institutions/types'

const PER_PAGE = 15
const MONEY = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })

type Dialog = { type: 'create' } | { type: 'edit'; institution: Institution } | { type: 'detail'; institution: Institution } | { type: 'delete'; institution: Institution } | { type: 'restore'; institution: Institution } | null
type Tab = 'active' | 'deleted'

const STATUS_OPTIONS = [
  { value: 'active', label: 'Aktif' },
  { value: 'inactive', label: 'Nonaktif' },
  { value: 'suspended', label: 'Ditangguhkan' },
] as const

const STATUS_TONE = { active: 'success', inactive: 'neutral', suspended: 'danger' } as const

function IconButton({
  label,
  onClick,
  danger = false,
  children,
}: {
  label: string
  onClick: () => void
  danger?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`rounded-lg p-2 transition-colors ${danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-600 hover:bg-slate-100'}`}
    >
      {children}
    </button>
  )
}

export default function AdminLembagaBimbingan() {
  const [tab, setTab] = useState<Tab>('active')
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [busy, setBusy] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [temporaryPassword, setTemporaryPassword] = useState<TemporaryPasswordInfo | null>(null)

  const list = useApiData(
    async () =>
      (
        await api.get<InstitutionListResponse>('/institutions', {
          params: {
            q: query || undefined,
            status: tab === 'active' ? status || undefined : undefined,
            trashed: tab === 'deleted' ? 'only' : undefined,
            page,
            per_page: PER_PAGE,
          },
        })
      ).data,
    [query, status, tab, page],
  )

  const institutions = list.data?.data ?? []
  const filtering = !!query || (tab === 'active' && !!status)
  const summary = list.data?.summary

  useEffect(() => {
    if (notice?.tone !== 'success') return
    const timer = window.setTimeout(() => setNotice(null), 6000)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    if (list.data && list.data.data.length === 0 && page > 1) setPage(Math.max(1, list.data.meta.last_page))
  }, [list.data, page])

  const onSearch = (event: FormEvent) => {
    event.preventDefault()
    setPage(1)
    setQuery(input.trim())
  }

  const closeDialog = () => {
    setDialog(null)
    setDialogError(null)
  }

  const afterSaved = (message: string, password?: TemporaryPasswordInfo) => {
    closeDialog()
    setNotice({ tone: 'success', text: message })
    if (password) setTemporaryPassword(password)
    list.reload()
  }

  const remove = async (institution: Institution) => {
    setBusy(true)
    setDialogError(null)
    try {
      const response = await api.delete<{ message?: string }>(`/institutions/${institution.id}`)
      closeDialog()
      setNotice({ tone: 'success', text: response.data.message ?? 'Lembaga berhasil dihapus.' })
      list.reload()
    } catch (error) {
      setDialogError(toApiError(error).message)
    } finally {
      setBusy(false)
    }
  }

  const restore = async (institution: Institution) => {
    setBusy(true)
    setDialogError(null)
    try {
      const response = await api.post<ApiMessage<Institution>>(`/institutions/${institution.id}/restore`)
      closeDialog()
      setNotice({ tone: 'success', text: response.data.message ?? 'Lembaga berhasil dipulihkan.' })
      list.reload()
    } catch (error) {
      setDialogError(toApiError(error).message)
    } finally {
      setBusy(false)
    }
  }

  const changeTab = (next: Tab) => {
    setTab(next)
    setStatus('')
    setPage(1)
  }

  const resetFilters = () => {
    setInput('')
    setQuery('')
    setStatus('')
    setPage(1)
  }

  return (
    <>
      <PageHeader
        title="Manajemen Lembaga Bimbingan"
        description="Kelola akun, profil, bagi hasil, dan rekening lembaga."
        action={
          <Button onClick={() => setDialog({ type: 'create' })} icon={<Plus className="h-4 w-4" aria-hidden />}>
            Tambah Lembaga
          </Button>
        }
      />

      {notice && (
        <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.text}
        </Notice>
      )}

      {list.data && summary && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Total lembaga" value={summary.total} hint="Lembaga yang belum dihapus" />
          <StatCard label="Akun aktif" value={summary.active} hint="Dapat login saat ini" />
          <StatCard label="Pendapatan lembaga" value={MONEY.format(summary.institution_revenue_total)} hint="Dari transaksi yang dibayar" />
          <StatCard label="Pendapatan platform" value={MONEY.format(summary.platform_revenue_total)} hint="Bagian platform dari transaksi" />
          <StatCard label="Pencairan menunggu" value={MONEY.format(summary.pending_payouts_total)} hint="Dana yang sedang ditahan" />
        </div>
      )}

      <Card>
        <div role="tablist" aria-label="Status lembaga" className="-mt-1 mb-4 flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'active'}
            onClick={() => changeTab('active')}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium ${tab === 'active' ? 'bg-ink-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Semua lembaga
            {summary && <span className="ml-1.5 opacity-70">({summary.total})</span>}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'deleted'}
            onClick={() => changeTab('deleted')}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium ${tab === 'deleted' ? 'bg-ink-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Dihapus
          </button>
        </div>

        <form onSubmit={onSearch} role="search" className="mb-4 flex flex-wrap gap-2">
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
            <input
              type="search"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Cari nama, email, atau telepon"
              aria-label="Cari lembaga"
              maxLength={100}
              className={`${inputClass()} pl-9`}
            />
          </div>
          {tab === 'active' && (
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value)
                setPage(1)
              }}
              aria-label="Filter status akun"
              className={`${inputClass()} !w-auto`}
            >
              <option value="">Semua status</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
          <Button type="submit" variant="secondary">
            Cari
          </Button>
          {filtering && (
            <Button variant="ghost" onClick={resetFilters}>
              Reset
            </Button>
          )}
        </form>

        {list.loading && !list.data && <Spinner label="Memuat lembaga…" />}
        {list.error && <ErrorState error={list.error} onRetry={list.reload} />}
        {list.data && institutions.length === 0 && (
          <EmptyState
            title={filtering ? 'Lembaga tidak ditemukan' : tab === 'deleted' ? 'Belum ada lembaga yang dihapus' : 'Belum ada lembaga'}
            description={filtering ? 'Coba ubah kata pencarian atau filter.' : tab === 'deleted' ? 'Lembaga yang dihapus akan muncul di sini.' : 'Tambahkan lembaga pertama untuk mulai mengelola mitra.'}
          >
            {tab === 'active' && !filtering && (
              <Button className="mt-4" onClick={() => setDialog({ type: 'create' })} icon={<Plus className="h-4 w-4" aria-hidden />}>
                Tambah Lembaga
              </Button>
            )}
          </EmptyState>
        )}

        {list.data && institutions.length > 0 && (
          <>
            <div className={`overflow-x-auto transition-opacity ${list.loading ? 'opacity-60' : ''}`}>
              <table className="w-full min-w-[60rem] text-left text-sm">
                <thead className="text-xs text-slate-500">
                  <tr>
                    <th className="pb-2 font-medium">Lembaga / Akun</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Bagi hasil</th>
                    <th className="pb-2 font-medium">Program</th>
                    <th className="pb-2 font-medium">Saldo tersedia</th>
                    <th className="pb-2 font-medium">Login terakhir</th>
                    <th className="pb-2 text-right font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {institutions.map((institution) => {
                    const deleted = !!institution.deleted_at || institution.account?.deleted === true
                    return (
                      <tr key={institution.id}>
                        <td className="py-3">
                          <p className="font-semibold text-ink-900">{institution.name}</p>
                          <p className="text-xs text-slate-500">{institution.email ?? 'Akun tidak tersedia'}</p>
                          {institution.phone && <p className="text-xs text-slate-500">{institution.phone}</p>}
                        </td>
                        <td className="py-3">
                          {deleted ? (
                            <Badge tone="danger">Dihapus</Badge>
                          ) : (
                            <Badge tone={STATUS_TONE[institution.status ?? 'inactive']}>{institution.status_label ?? '—'}</Badge>
                          )}
                        </td>
                        <td className="py-3">
                          {institution.revenue_share_percent === null ? (
                            <Badge tone="warning">Belum diatur</Badge>
                          ) : (
                            <span className="text-slate-700">{institution.revenue_share_percent}%</span>
                          )}
                        </td>
                        <td className="py-3 text-slate-700">{institution.programs_count ?? 0}</td>
                        <td className="py-3 text-slate-700">{MONEY.format(institution.balance?.available ?? 0)}</td>
                        <td className="py-3 text-slate-600">{formatDateTime(institution.account?.last_login_at)}</td>
                        <td className="py-3">
                          <div className="flex justify-end gap-0.5">
                            {!deleted && (
                              <>
                                <IconButton label={`Lihat detail ${institution.name}`} onClick={() => setDialog({ type: 'detail', institution })}>
                                  <Eye className="h-4 w-4" aria-hidden />
                                </IconButton>
                                {institution.abilities?.update && (
                                  <IconButton label={`Ubah ${institution.name}`} onClick={() => setDialog({ type: 'edit', institution })}>
                                    <Pencil className="h-4 w-4" aria-hidden />
                                  </IconButton>
                                )}
                                {institution.abilities?.delete && (
                                  <IconButton
                                    label={`Hapus ${institution.name}`}
                                    danger
                                    onClick={() => {
                                      setDialogError(null)
                                      setDialog({ type: 'delete', institution })
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" aria-hidden />
                                  </IconButton>
                                )}
                              </>
                            )}
                            {deleted && institution.abilities?.delete && (
                              <IconButton label={`Pulihkan ${institution.name}`} onClick={() => setDialog({ type: 'restore', institution })}>
                                <RotateCcw className="h-4 w-4" aria-hidden />
                              </IconButton>
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
                Halaman {list.data.meta.current_page} dari {list.data.meta.last_page} · {list.data.meta.total} lembaga
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                  Sebelumnya
                </Button>
                <Button variant="secondary" disabled={page >= list.data.meta.last_page} onClick={() => setPage((current) => current + 1)}>
                  Berikutnya
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {(dialog?.type === 'create' || dialog?.type === 'edit') && (
        <InstitutionFormModal
          institution={dialog.type === 'edit' ? dialog.institution : undefined}
          onClose={closeDialog}
          onSaved={(message, password) => afterSaved(message, password)}
        />
      )}

      {dialog?.type === 'detail' && (
        <InstitutionDetailModal
          institution={dialog.institution}
          onClose={closeDialog}
          onChanged={() => {
            list.reload()
            setNotice({ tone: 'success', text: 'Data lembaga berhasil diperbarui.' })
          }}
        />
      )}

      <ConfirmDialog
        open={dialog?.type === 'delete'}
        title="Hapus lembaga?"
        tone="danger"
        confirmLabel="Hapus Lembaga"
        loading={busy}
        error={dialogError}
        onCancel={closeDialog}
        onConfirm={() => {
          if (dialog?.type === 'delete') void remove(dialog.institution)
        }}
        message={
          dialog?.type === 'delete' && (
            <>
              Akun dan profil <strong>{dialog.institution.name}</strong> akan dinonaktifkan dan masuk ke daftar dihapus. Lembaga dengan transaksi/pencairan atau siswa aktif tidak dapat dihapus; nonaktifkan akunnya sebagai gantinya.
            </>
          )
        }
      />

      <ConfirmDialog
        open={dialog?.type === 'restore'}
        title="Pulihkan lembaga?"
        confirmLabel="Pulihkan"
        loading={busy}
        error={dialogError}
        onCancel={closeDialog}
        onConfirm={() => {
          if (dialog?.type === 'restore') void restore(dialog.institution)
        }}
        message={
          dialog?.type === 'restore' && (
            <>
              Profil dan akun <strong>{dialog.institution.name}</strong> akan dipulihkan dengan status akun sebelumnya.
            </>
          )
        }
      />

      {temporaryPassword && <TemporaryPasswordModal info={temporaryPassword} onClose={() => setTemporaryPassword(null)} />}

    </>
  )
}
