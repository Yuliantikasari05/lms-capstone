import { Card, StatCard } from '../components/ui/Card'
import { EmptyState } from '../components/ui/States'
import { PageHeader } from '../components/ui/PageHeader'
import { useAuth } from '../auth/AuthContext'
import { ROLE_CONFIG } from '../config/navigation'
import type { RoleSlug } from '../types'

/**
 * Dashboard untuk Mentor, Siswa, Karyawan, dan Lembaga Bimbingan.
 * Belum ada modul bisnis, sehingga seluruh angka ditampilkan sebagai "belum tersedia" (bukan data palsu).
 */
export default function RoleDashboard({ role }: { role: RoleSlug }) {
  const { user } = useAuth()
  const config = ROLE_CONFIG[role]

  return (
    <>
      <PageHeader title={`Halo, ${user?.name ?? ''}`} description={`Ringkasan ${config.label}`} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {config.summaryCards.map((label) => (
          <StatCard key={label} label={label} value={null} />
        ))}
      </div>

      <Card title={config.activityTitle} className="mt-6">
        <EmptyState
          title="Belum ada aktivitas"
          description="Aktivitas akan tampil di sini setelah modul terkait tersedia pada tahap pengembangan berikutnya."
        />
      </Card>
    </>
  )
}
