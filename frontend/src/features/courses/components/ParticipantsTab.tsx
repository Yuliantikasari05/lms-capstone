import { Plus, Search, UserMinus } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { inputClass } from '../../../components/ui/Field'
import { Modal } from '../../../components/ui/Modal'
import { Notice } from '../../../components/ui/Notice'
import { EmptyState, ErrorState, Spinner } from '../../../components/ui/States'
import { api, toApiError } from '../../../lib/api'
import { formatDate } from '../../../lib/format'
import { useApiData } from '../../../lib/useApiData'
import type { Paginated } from '../../../types'
import type { Course, Enrollment, EnrollmentCandidate } from '../types'
import { participantLabel } from '../utils'

type StatusFilter = 'active' | 'cancelled' | 'all'

export function ParticipantsTab({ course, readOnly, onChanged }: { course: Course; readOnly: boolean; onChanged: () => void }) {
  const label = participantLabel(course.type)
  const [status, setStatus] = useState<StatusFilter>('active')
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  const [adding, setAdding] = useState(false)
  const [cancelling, setCancelling] = useState<Enrollment | null>(null)
  const [busy, setBusy] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  const list = useApiData<Paginated<Enrollment>>(
    async () => (await api.get<Paginated<Enrollment>>(`/courses/${course.id}/enrollments`, { params: { status, q: query || undefined, page, per_page: 15 } })).data,
    [course.id, status, query, page],
  )
  const rows = list.data?.data ?? []

  const refresh = () => {
    list.reload()
    onChanged()
  }

  const onSearch = (event: FormEvent) => {
    event.preventDefault()
    setPage(1)
    setQuery(input.trim())
  }

  const cancel = async (enrollment: Enrollment) => {
    setBusy(true)
    setDialogError(null)
    try {
      const res = await api.delete<{ message?: string }>(`/enrollments/${enrollment.id}`)
      setCancelling(null)
      setNotice({ tone: 'success', text: res.data.message ?? 'Pendaftaran dibatalkan.' })
      refresh()
    } catch (error) {
      setDialogError(toApiError(error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      {notice && (
        <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.text}
        </Notice>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form onSubmit={onSearch} role="search" className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
          <input type="search" value={input} onChange={(e) => setInput(e.target.value)} placeholder={`Cari ${label.toLowerCase()} (nama atau email)`} aria-label="Cari peserta" maxLength={100} className={`${inputClass()} pl-9`} />
        </form>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as StatusFilter)
            setPage(1)
          }}
          aria-label="Filter status pendaftaran"
          className={`${inputClass()} !w-auto`}
        >
          <option value="active">Aktif</option>
          <option value="cancelled">Dibatalkan</option>
          <option value="all">Semua</option>
        </select>
        {!readOnly && (
          <Button onClick={() => setAdding(true)} icon={<Plus className="h-4 w-4" aria-hidden />}>
            Tambah Peserta
          </Button>
        )}
      </div>

      {list.loading && !list.data && <Spinner label="Memuat peserta…" />}
      {list.error && <ErrorState error={list.error} onRetry={list.reload} />}
      {list.data && rows.length === 0 && (
        <EmptyState title="Belum ada peserta" description={status === 'active' ? `Daftarkan ${label.toLowerCase()} ke kursus ini.` : 'Tidak ada data untuk filter ini.'} />
      )}

      {rows.length > 0 && (
        <>
          <div className={`overflow-x-auto ${list.loading ? 'opacity-60' : ''}`}>
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="pb-2 font-medium">{label}</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Didaftarkan</th>
                  <th className="pb-2 text-right font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="py-2.5">
                      <p className="font-medium text-slate-800">{row.user?.name ?? '—'}</p>
                      <p className="text-xs text-slate-500">{row.user?.email}</p>
                    </td>
                    <td className="py-2.5">
                      <Badge tone={row.status === 'active' ? 'success' : 'neutral'}>{row.status === 'active' ? 'Aktif' : 'Dibatalkan'}</Badge>
                      {row.user?.deleted && (
                        <span className="ml-1.5">
                          <Badge tone="danger">Akun dihapus</Badge>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-slate-600">
                      {formatDate(row.enrolled_at)}
                      {row.enrolled_by && <span className="block text-xs text-slate-500">oleh {row.enrolled_by}</span>}
                    </td>
                    <td className="py-2.5 text-right">
                      {!readOnly && row.status === 'active' && (
                        <button type="button" aria-label={`Cabut pendaftaran ${row.user?.name}`} title={`Cabut pendaftaran ${row.user?.name}`} onClick={() => setCancelling(row)} className="rounded-lg p-2 text-red-600 hover:bg-red-50">
                          <UserMinus className="h-4 w-4" aria-hidden />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
            <span>
              Halaman {list.data?.meta.current_page} dari {list.data?.meta.last_page} · {list.data?.meta.total} peserta
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Sebelumnya
              </Button>
              <Button variant="secondary" disabled={page >= (list.data?.meta.last_page ?? 1)} onClick={() => setPage((p) => p + 1)}>
                Berikutnya
              </Button>
            </div>
          </div>
        </>
      )}

      {adding && (
        <AddParticipantsModal
          course={course}
          onClose={() => setAdding(false)}
          onSaved={(message) => {
            setAdding(false)
            setNotice({ tone: 'success', text: message })
            refresh()
          }}
        />
      )}

      <ConfirmDialog
        open={!!cancelling}
        title="Cabut pendaftaran?"
        tone="danger"
        confirmLabel="Cabut"
        loading={busy}
        error={dialogError}
        onCancel={() => {
          setCancelling(null)
          setDialogError(null)
        }}
        onConfirm={() => cancelling && cancel(cancelling)}
        message={
          cancelling && (
            <>
              <strong>{cancelling.user?.name}</strong> tidak lagi menjadi peserta kursus ini. Riwayat pendaftaran tetap tersimpan dan dapat diaktifkan kembali dengan mendaftarkannya lagi.
            </>
          )
        }
      />
    </div>
  )
}

/** Pemilih peserta massal. Kandidat (role sesuai jenis kursus, akun aktif, belum terdaftar) ditentukan server. */
function AddParticipantsModal({ course, onClose, onSaved }: { course: Course; onClose: () => void; onSaved: (message: string) => void }) {
  const label = participantLabel(course.type)
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Map<number, EnrollmentCandidate>>(new Map())
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const candidates = useApiData<{ data: EnrollmentCandidate[]; meta: { current_page: number; last_page: number; total: number } }>(
    async () => (await api.get(`/courses/${course.id}/enrollment-candidates`, { params: { q: query || undefined, page, per_page: 10 } })).data,
    [course.id, query, page],
  )
  const rows = candidates.data?.data ?? []

  const toggle = (c: EnrollmentCandidate) =>
    setSelected((prev) => {
      const next = new Map(prev)
      if (next.has(c.id)) next.delete(c.id)
      else next.set(c.id, c)
      return next
    })

  const onSearch = (event: FormEvent) => {
    event.preventDefault()
    setPage(1)
    setQuery(input.trim())
  }

  const submit = async () => {
    if (selected.size === 0) {
      setError(`Pilih minimal satu ${label.toLowerCase()}.`)
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const res = await api.post<{ message?: string }>(`/courses/${course.id}/enrollments`, { user_ids: [...selected.keys()] })
      onSaved(res.data.message ?? 'Peserta berhasil didaftarkan.')
    } catch (e) {
      const apiError = toApiError(e)
      const first = Object.values(apiError.fieldErrors)[0]?.[0]
      setError(first ?? apiError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      title="Tambah Peserta"
      description={`Hanya ${label} aktif yang belum terdaftar di kursus ini.`}
      size="lg"
      onClose={onClose}
      dismissible={!submitting}
      footer={
        <>
          <span className="mr-auto self-center text-sm text-slate-500">{selected.size} dipilih</span>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Batal
          </Button>
          <Button onClick={submit} loading={submitting}>
            Daftarkan
          </Button>
        </>
      }
    >
      {error && (
        <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <form onSubmit={onSearch} role="search" className="mb-3 flex gap-2">
        <input data-autofocus type="search" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Cari nama atau email" aria-label="Cari kandidat" maxLength={100} className={inputClass()} />
        <Button type="submit" variant="secondary">
          Cari
        </Button>
      </form>

      {candidates.loading && !candidates.data && <Spinner label="Memuat…" />}
      {candidates.error && <ErrorState error={candidates.error} onRetry={candidates.reload} />}
      {candidates.data && rows.length === 0 && <EmptyState title={`Tidak ada ${label.toLowerCase()} yang bisa didaftarkan`} description="Semua sudah terdaftar, atau tidak ada yang cocok dengan pencarian." />}

      <ul className="divide-y divide-slate-100">
        {rows.map((c) => (
          <li key={c.id}>
            <label className="flex cursor-pointer items-center gap-3 py-2.5">
              <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c)} className="h-4 w-4 rounded border-slate-300" aria-label={`Pilih ${c.name}`} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-slate-800">{c.name}</span>
                <span className="block truncate text-xs text-slate-500">{c.email}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      {candidates.data && candidates.data.meta.last_page > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
          <span>
            Halaman {candidates.data.meta.current_page} dari {candidates.data.meta.last_page}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Sebelumnya
            </Button>
            <Button variant="secondary" disabled={page >= candidates.data.meta.last_page} onClick={() => setPage((p) => p + 1)}>
              Berikutnya
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
