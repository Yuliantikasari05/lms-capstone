import { Pencil, Plus, Search, Trash2, Trophy } from 'lucide-react'
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
import { useApiData } from '../../lib/useApiData'
import type { Paginated } from '../../types'
import { LevelFormModal } from './gamification/LevelFormModal'
import { XpHistoryModal } from './gamification/XpHistoryModal'
import type { GamificationSummary, LeaderboardEntry, Level } from './gamification/types'

const PER_PAGE = 15
const NUMBER = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 })

type Tab = 'leaderboard' | 'levels'
type Dialog =
  | { type: 'xp'; student: LeaderboardEntry['user'] }
  | { type: 'level-create' }
  | { type: 'level-edit'; level: Level }
  | { type: 'level-delete'; level: Level }
  | null

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

export default function AdminGamifikasi() {
  const [tab, setTab] = useState<Tab>('leaderboard')
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [busy, setBusy] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  const summary = useApiData(
    async () => (await api.get<{ data: GamificationSummary }>('/gamification/summary')).data.data,
    [],
  )
  const leaderboard = useApiData(
    async () =>
      (await api.get<Paginated<LeaderboardEntry>>('/gamification/leaderboard', { params: { q: query || undefined, page, per_page: PER_PAGE } })).data,
    [query, page],
  )
  const levels = useApiData(async () => (await api.get<{ data: Level[] }>('/gamification/levels')).data.data, [])

  useEffect(() => {
    if (notice?.tone !== 'success') return
    const timer = window.setTimeout(() => setNotice(null), 6000)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    if (leaderboard.data && leaderboard.data.data.length === 0 && page > 1) {
      setPage(Math.max(1, leaderboard.data.meta.last_page))
    }
  }, [leaderboard.data, page])

  const refreshGamification = () => {
    summary.reload()
    leaderboard.reload()
    levels.reload()
  }

  const onSearch = (event: FormEvent) => {
    event.preventDefault()
    setPage(1)
    setQuery(input.trim())
  }

  const closeDialog = () => {
    setDialog(null)
    setDialogError(null)
  }

  const removeLevel = async (level: Level) => {
    setBusy(true)
    setDialogError(null)
    try {
      const response = await api.delete<{ message?: string }>(`/gamification/levels/${level.id}`)
      closeDialog()
      setNotice({ tone: 'success', text: response.data.message ?? 'Level berhasil dihapus.' })
      refreshGamification()
    } catch (error) {
      setDialogError(toApiError(error).message)
    } finally {
      setBusy(false)
    }
  }

  const entries = leaderboard.data?.data ?? []
  const levelRows = levels.data ?? []

  return (
    <>
      <PageHeader
        title="Gamifikasi"
        description="Pantau XP Siswa dan atur level pencapaian."
        action={
          tab === 'levels' ? (
            <Button onClick={() => setDialog({ type: 'level-create' })} icon={<Plus className="h-4 w-4" aria-hidden />}>
              Tambah Level
            </Button>
          ) : undefined
        }
      />

      {notice && (
        <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.text}
        </Notice>
      )}

      {summary.loading && !summary.data && <Spinner label="Memuat ringkasan gamifikasi…" />}
      {summary.error && <ErrorState error={summary.error} onRetry={summary.reload} />}
      {summary.data && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Siswa aktif" value={NUMBER.format(summary.data.students_count)} hint="Tidak termasuk akun terhapus" />
          <StatCard label="Total XP" value={NUMBER.format(summary.data.total_xp)} />
          <StatCard label="Rata-rata XP" value={NUMBER.format(summary.data.average_xp)} />
          <StatCard label="XP tertinggi" value={NUMBER.format(summary.data.highest_xp)} />
          <StatCard label="Jumlah level" value={NUMBER.format(summary.data.levels_count)} />
        </div>
      )}

      <div role="tablist" aria-label="Bagian gamifikasi" className="mb-4 flex gap-2 border-b border-slate-200">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'leaderboard'}
          onClick={() => setTab('leaderboard')}
          className={`border-b-2 px-4 py-2.5 text-sm font-medium ${tab === 'leaderboard' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Papan peringkat & XP
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'levels'}
          onClick={() => setTab('levels')}
          className={`border-b-2 px-4 py-2.5 text-sm font-medium ${tab === 'levels' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Pengaturan level
        </button>
      </div>

      {tab === 'leaderboard' && (
        <Card title="Papan peringkat Siswa">
          <form onSubmit={onSearch} role="search" className="mb-4 flex flex-wrap gap-2">
            <div className="relative min-w-[12rem] flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
              <input
                type="search"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Cari nama atau email Siswa"
                aria-label="Cari Siswa"
                maxLength={100}
                className={`${inputClass()} pl-9`}
              />
            </div>
            <Button type="submit" variant="secondary">
              Cari
            </Button>
            {!!query && (
              <Button
                variant="ghost"
                onClick={() => {
                  setInput('')
                  setQuery('')
                  setPage(1)
                }}
              >
                Reset
              </Button>
            )}
          </form>

          {leaderboard.loading && !leaderboard.data && <Spinner label="Memuat papan peringkat…" />}
          {leaderboard.error && <ErrorState error={leaderboard.error} onRetry={leaderboard.reload} />}
          {leaderboard.data && entries.length === 0 && (
            <EmptyState title={query ? 'Siswa tidak ditemukan' : 'Belum ada Siswa aktif'} description={query ? 'Coba ubah kata pencarian.' : 'Siswa aktif akan muncul setelah terdaftar di sistem.'} />
          )}

          {leaderboard.data && entries.length > 0 && (
            <>
              <div className={`overflow-x-auto transition-opacity ${leaderboard.loading ? 'opacity-60' : ''}`}>
                <table className="w-full min-w-[44rem] text-left text-sm">
                  <thead className="text-xs text-slate-500">
                    <tr>
                      <th className="pb-2 font-medium">Peringkat</th>
                      <th className="pb-2 font-medium">Siswa</th>
                      <th className="pb-2 font-medium">XP</th>
                      <th className="pb-2 font-medium">Level</th>
                      <th className="pb-2 text-right font-medium">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {entries.map((entry) => (
                      <tr key={entry.user.id}>
                        <td className="py-3">
                          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
                            {entry.rank <= 3 && <Trophy className="h-4 w-4 text-amber-500" aria-hidden />}
                            #{NUMBER.format(entry.rank)}
                          </span>
                        </td>
                        <td className="py-3">
                          <p className="font-medium text-slate-800">{entry.user.name}</p>
                          <p className="text-xs text-slate-500">{entry.user.email}</p>
                        </td>
                        <td className="py-3 font-semibold text-ink-900">{NUMBER.format(entry.xp)} XP</td>
                        <td className="py-3">
                          {entry.level ? <Badge tone="info">{entry.level.name}</Badge> : <span className="text-slate-400">Belum ada level</span>}
                        </td>
                        <td className="py-3 text-right">
                          <Button variant="secondary" onClick={() => setDialog({ type: 'xp', student: entry.user })}>
                            Riwayat & atur XP
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
                <span>
                  Halaman {leaderboard.data.meta.current_page} dari {leaderboard.data.meta.last_page} · {leaderboard.data.meta.total} Siswa
                </span>
                <div className="flex gap-2">
                  <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                    Sebelumnya
                  </Button>
                  <Button variant="secondary" disabled={page >= leaderboard.data.meta.last_page} onClick={() => setPage((current) => current + 1)}>
                    Berikutnya
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      )}

      {tab === 'levels' && (
        <Card title="Level berdasarkan XP">
          {levels.loading && !levels.data && <Spinner label="Memuat level…" />}
          {levels.error && <ErrorState error={levels.error} onRetry={levels.reload} />}
          {levels.data && levelRows.length === 0 && (
            <EmptyState title="Belum ada level" description="Tambahkan level dan batas XP minimal agar level Siswa dapat dihitung.">
              <Button className="mt-4" onClick={() => setDialog({ type: 'level-create' })} icon={<Plus className="h-4 w-4" aria-hidden />}>
                Tambah Level
              </Button>
            </EmptyState>
          )}
          {levels.data && levelRows.length > 0 && (
            <div className={`overflow-x-auto transition-opacity ${levels.loading ? 'opacity-60' : ''}`}>
              <table className="w-full min-w-[34rem] text-left text-sm">
                <thead className="text-xs text-slate-500">
                  <tr>
                    <th className="pb-2 font-medium">Nama level</th>
                    <th className="pb-2 font-medium">XP minimal</th>
                    <th className="pb-2 text-right font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {levelRows.map((level) => (
                    <tr key={level.id}>
                      <td className="py-3 font-medium text-slate-800">{level.name}</td>
                      <td className="py-3 text-slate-700">{NUMBER.format(level.min_xp)} XP</td>
                      <td className="py-3">
                        <div className="flex justify-end gap-0.5">
                          <IconButton label={`Ubah level ${level.name}`} onClick={() => setDialog({ type: 'level-edit', level })}>
                            <Pencil className="h-4 w-4" aria-hidden />
                          </IconButton>
                          <IconButton
                            label={`Hapus level ${level.name}`}
                            danger
                            onClick={() => {
                              setDialogError(null)
                              setDialog({ type: 'level-delete', level })
                            }}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {dialog?.type === 'xp' && (
        <XpHistoryModal
          student={dialog.student}
          onClose={closeDialog}
          onChanged={() => {
            refreshGamification()
            setNotice({ tone: 'success', text: 'Data XP berhasil diperbarui.' })
          }}
        />
      )}

      {(dialog?.type === 'level-create' || dialog?.type === 'level-edit') && (
        <LevelFormModal
          level={dialog.type === 'level-edit' ? dialog.level : undefined}
          onClose={closeDialog}
          onSaved={(message) => {
            closeDialog()
            setNotice({ tone: 'success', text: message })
            refreshGamification()
          }}
        />
      )}

      <ConfirmDialog
        open={dialog?.type === 'level-delete'}
        title="Hapus level?"
        tone="danger"
        confirmLabel="Hapus Level"
        loading={busy}
        error={dialogError}
        onCancel={closeDialog}
        onConfirm={() => {
          if (dialog?.type === 'level-delete') void removeLevel(dialog.level)
        }}
        message={
          dialog?.type === 'level-delete' && (
            <>
              Level <strong>{dialog.level.name}</strong> akan dihapus. XP Siswa tidak berubah, tetapi level mereka akan dihitung ulang berdasarkan level yang tersisa.
            </>
          )
        }
      />
    </>
  )
}
