import { Card, StatCard } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/States'
import { PageHeader } from '../../components/ui/PageHeader'
import { useAuth } from '../../auth/AuthContext'

/** Kartu ringkasan. Nilainya belum tersedia karena modul bisnisnya belum ada (bukan data palsu). */
const SUMMARY_CARDS = ['Pelatihan diikuti', 'Webinar mendatang', 'Progres pelatihan', 'Status sertifikat']

export default function KaryawanDashboard() {
  const { user } = useAuth()

  return (
    <>
      <PageHeader title={`Halo, ${user?.name ?? ''}`} description="Ringkasan Karyawan" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {SUMMARY_CARDS.map((label) => (
          <StatCard key={label} label={label} value={null} />
        ))}
      </div>

      <Card title="Aktivitas pelatihan" className="mt-6">
        <EmptyState
          title="Belum ada aktivitas"
          description="Aktivitas akan tampil di sini setelah modul terkait tersedia pada tahap pengembangan berikutnya."
        />
      </Card>
    </>
  )
}
