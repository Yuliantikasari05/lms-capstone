import { Construction } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'

export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <Card>
        <div className="flex flex-col items-center px-4 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <Construction className="h-6 w-6" aria-hidden />
          </span>
          <h2 className="mt-3 text-base font-semibold text-slate-800">Fitur belum tersedia pada tahap ini</h2>
          <p className="mt-1 max-w-md text-sm text-slate-500">
            Menu <span className="font-medium">{title}</span> sudah disiapkan sebagai fondasi navigasi dan akan diimplementasikan pada tahap pengembangan berikutnya.
          </p>
        </div>
      </Card>
    </>
  )
}
