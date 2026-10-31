import type { ReactNode } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Modal } from '../../../components/ui/Modal'
import { ErrorState, Spinner } from '../../../components/ui/States'
import { api } from '../../../lib/api'
import { STATUS_LABEL, formatDateTime, initials } from '../../../lib/format'
import { useApiData } from '../../../lib/useApiData'
import type { AuditLogEntry, User } from '../../../types'
import { ACTION_LABELS, STATUS_TONE, describeChange } from './shared'

interface Props {
  userId: number
  onClose: () => void
  onEdit: (user: User) => void
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-2.5 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="col-span-2 break-words text-slate-800">{children}</dd>
    </div>
  )
}

/** Detail pengguna dari GET /users/{id} (data terbaru dari server). */
export function UserDetailModal({ userId, onClose, onEdit }: Props) {
  const { data, error, loading, reload } = useApiData(async () => (await api.get<{ data: User }>(`/users/${userId}`)).data.data, [userId])
  const trashed = !!data?.deleted_at

  // Riwayat aktivitas pengelolaan akun ini (hanya Admin yang punya izin audit.view).
  const audit = useApiData(
    async () => (await api.get<{ data: AuditLogEntry[] }>('/audit-logs', { params: { target_type: 'user', target_id: userId, per_page: 10 } })).data.data,
    [userId],
  )

  return (
    <Modal
      open
      title="Detail Pengguna"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Tutup
          </Button>
          {data && !trashed && <Button onClick={() => onEdit(data)}>Ubah</Button>}
        </>
      }
    >
      {loading && <Spinner label="Memuat detail…" />}
      {error && <ErrorState error={error} onRetry={reload} />}

      {data && (
        <>
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-base font-semibold text-brand-700" aria-hidden>
              {initials(data.name)}
            </span>
            <div>
              <p className="font-semibold text-ink-900">{data.name}</p>
              <p className="text-sm text-slate-500">{data.email}</p>
            </div>
          </div>

          <dl className="divide-y divide-slate-100 border-y border-slate-100">
            <Row label="Role">{data.roles.map((r) => r.name).join(', ') || '—'}</Row>
            <Row label="Status">
              {trashed ? <Badge tone="danger">Dihapus</Badge> : <Badge tone={STATUS_TONE[data.status]}>{STATUS_LABEL[data.status] ?? data.status}</Badge>}
            </Row>
            <Row label="Bergabung">{formatDateTime(data.created_at)}</Row>
            <Row label="Login terakhir">{formatDateTime(data.last_login_at)}</Row>
            {trashed && <Row label="Dihapus pada">{formatDateTime(data.deleted_at)}</Row>}
          </dl>

          <div className="mt-4">
            <h3 className="text-sm font-semibold text-slate-800">Riwayat aktivitas</h3>
            {audit.loading && !audit.data && <p className="mt-1 text-sm text-slate-500">Memuat riwayat…</p>}
            {audit.error && (
              <p role="alert" className="mt-1 text-sm text-red-600">
                Riwayat gagal dimuat.{' '}
                <button type="button" onClick={audit.reload} className="font-medium underline">
                  Coba lagi
                </button>
              </p>
            )}
            {audit.data && audit.data.length === 0 && <p className="mt-1 rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-500">Belum ada catatan aktivitas.</p>}
            {audit.data && audit.data.length > 0 && (
              <ol className="mt-2 space-y-2.5 border-l-2 border-slate-100 pl-3">
                {audit.data.map((entry) => {
                  const details = describeChange(entry)
                  const byOwner = entry.actor.id !== null && entry.actor.id === entry.target.id
                  return (
                    <li key={entry.id} className="text-sm">
                      <p className="font-medium text-slate-800">{ACTION_LABELS[entry.action] ?? entry.action}</p>
                      <p className="text-xs text-slate-500">
                        {formatDateTime(entry.created_at)} · oleh {byOwner ? 'pemilik akun' : (entry.actor.name ?? 'akun yang sudah dihapus')}
                      </p>
                      {details.map((line) => (
                        <p key={line} className="break-words text-xs text-slate-600">
                          {line}
                        </p>
                      ))}
                    </li>
                  )
                })}
              </ol>
            )}
          </div>

          <div className="mt-4">
            <h3 className="text-sm font-semibold text-slate-800">Kelas yang diikuti</h3>
            <p className="mt-1 rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-500">
              Belum tersedia. Daftar kelas dan statusnya akan tampil di sini setelah modul kursus dan pendaftaran peserta dibangun.
            </p>
          </div>
        </>
      )}
    </Modal>
  )
}
