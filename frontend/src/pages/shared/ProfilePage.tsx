import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { useAuth } from '../../auth/AuthContext'
import { ROLE_CONFIG } from '../../config/navigation'
import { STATUS_LABEL, formatDateTime } from '../../lib/format'
import { ChangePasswordForm } from './ChangePasswordForm'

export default function ProfilePage() {
  const { user } = useAuth()
  if (!user) return null

  const rows: [string, string][] = [
    ['Nama', user.name],
    ['Email', user.email],
    ['Role', user.primary_role ? ROLE_CONFIG[user.primary_role].label : '—'],
    ['Status akun', STATUS_LABEL[user.status] ?? user.status],
    ['Login terakhir', formatDateTime(user.last_login_at)],
  ]

  return (
    <>
      <PageHeader title="Profil" description="Data akun Anda dari server. Pengubahan profil belum tersedia pada tahap ini." />
      <Card>
        <dl className="divide-y divide-slate-100">
          {rows.map(([label, value]) => (
            <div key={label} className="grid gap-1 py-3 sm:grid-cols-3">
              <dt className="text-sm text-slate-500">{label}</dt>
              <dd className="text-sm font-medium text-slate-800 sm:col-span-2">{value}</dd>
            </div>
          ))}
          <div className="grid gap-1 py-3 sm:grid-cols-3">
            <dt className="text-sm text-slate-500">Hak akses</dt>
            <dd className="flex flex-wrap gap-1.5 sm:col-span-2">
              {user.permissions.length === 0 ? <span className="text-sm text-slate-500">Tidak ada</span> : user.permissions.map((p) => <Badge key={p} tone="info">{p}</Badge>)}
            </dd>
          </div>
        </dl>
      </Card>

      <Card title="Ganti Kata Sandi" className="mt-4">
        <p className="mb-4 text-sm text-slate-500">
          Hanya Anda yang mengetahui kata sandi ini. Administrator dapat mereset kata sandi bila Anda lupa, tetapi tidak dapat melihat kata sandi Anda.
        </p>
        <div className="max-w-md">
          <ChangePasswordForm />
        </div>
      </Card>
    </>
  )
}
