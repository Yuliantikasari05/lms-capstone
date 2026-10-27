import { Search } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { EmptyState, ErrorState, Spinner } from '../../components/ui/States'
import { api } from '../../lib/api'
import { STATUS_LABEL, formatDateTime } from '../../lib/format'
import { useApiData } from '../../lib/useApiData'
import type { Paginated, User } from '../../types'

const STATUS_TONE = { active: 'success', inactive: 'neutral', suspended: 'danger' } as const

export default function UsersPage() {
  const [page, setPage] = useState(1)
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')

  const { data, error, loading, reload } = useApiData(
    async () => (await api.get<Paginated<User>>('/users', { params: { page, q: query || undefined } })).data,
    [page, query],
  )

  const onSearch = (event: FormEvent) => {
    event.preventDefault()
    setPage(1)
    setQuery(input.trim())
  }

  return (
    <>
      <PageHeader title="Manajemen User" description="Daftar pengguna dari server. Pembuatan dan pengubahan tersedia melalui API (POST/PATCH /api/v1/users); formulirnya belum tersedia pada tahap ini." />

      <Card>
        <form onSubmit={onSearch} className="mb-4 flex gap-2" role="search">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
            <input
              type="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Cari nama atau email"
              aria-label="Cari pengguna"
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <Button type="submit" variant="secondary">
            Cari
          </Button>
        </form>

        {loading && <Spinner label="Memuat pengguna…" />}
        {error && <ErrorState error={error} onRetry={reload} />}

        {data && data.data.length === 0 && (
          <EmptyState title="Pengguna tidak ditemukan" description={query ? 'Coba kata kunci lain.' : 'Belum ada pengguna terdaftar.'} />
        )}

        {data && data.data.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="text-xs text-slate-500">
                  <tr>
                    <th className="pb-2 font-medium">Pengguna</th>
                    <th className="pb-2 font-medium">Role</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Login terakhir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.data.map((row) => (
                    <tr key={row.id}>
                      <td className="py-2.5">
                        <p className="font-medium text-slate-800">{row.name}</p>
                        <p className="text-xs text-slate-500">{row.email}</p>
                      </td>
                      <td className="py-2.5">{row.roles.map((r) => r.name).join(', ') || '—'}</td>
                      <td className="py-2.5">
                        <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status] ?? row.status}</Badge>
                      </td>
                      <td className="py-2.5 text-slate-600">{formatDateTime(row.last_login_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
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
    </>
  )
}
