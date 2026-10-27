import { Badge } from '../../components/ui/Badge'
import { Card, StatCard } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { EmptyState, ErrorState, Spinner } from '../../components/ui/States'
import { api } from '../../lib/api'
import { formatDateTime } from '../../lib/format'
import { useApiData } from '../../lib/useApiData'
import type { AdminSummary } from '../../types'

export default function AdminDashboard() {
  const { data, error, loading, reload } = useApiData(
    async () => (await api.get<{ data: AdminSummary }>('/admin/summary')).data.data,
    [],
  )

  return (
    <>
      <PageHeader title="Dashboard" description="Ringkasan sistem berdasarkan data di database." />

      {loading && <Spinner label="Memuat ringkasan…" />}
      {error && (
        <Card>
          <ErrorState error={error} onRetry={reload} />
        </Card>
      )}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total pengguna" value={data.users_total} hint={`${data.users_active} akun aktif`} />
            <StatCard label="Mentor" value={data.mentors_total} hint="Pengguna dengan role Mentor" />
            <StatCard label="Kursus" value={data.courses_total} />
            <StatCard label="Akun aktif" value={data.users_active} hint="Dapat login saat ini" />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-3">
            <Card title="Login terbaru" className="xl:col-span-2">
              {data.recent_logins.length === 0 ? (
                <EmptyState title="Belum ada aktivitas login" description="Riwayat login pengguna akan tampil di sini." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[32rem] text-left text-sm">
                    <thead className="text-xs text-slate-500">
                      <tr>
                        <th className="pb-2 font-medium">Pengguna</th>
                        <th className="pb-2 font-medium">Role</th>
                        <th className="pb-2 font-medium">Waktu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.recent_logins.map((row) => (
                        <tr key={row.id}>
                          <td className="py-2.5">
                            <p className="font-medium text-slate-800">{row.name}</p>
                            <p className="text-xs text-slate-500">{row.email}</p>
                          </td>
                          <td className="py-2.5">{row.role ? <Badge tone="info">{row.role}</Badge> : '—'}</td>
                          <td className="py-2.5 text-slate-600">{formatDateTime(row.last_login_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card title="Pengguna per role">
              <ul className="divide-y divide-slate-100">
                {data.users_by_role.map((row) => (
                  <li key={row.slug} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="text-slate-700">{row.name}</span>
                    <span className="font-semibold text-ink-900">{row.users_count}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </>
      )}
    </>
  )
}
