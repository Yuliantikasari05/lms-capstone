import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { EmptyState } from '../../components/ui/States'
import { AskQuestionButton, BackLink, CourseHero, MaterialRow, ModuleRow, ModuleStats } from './detailParts'
import { WEBINARS } from './webinarData'

type Tab = 'kurikulum' | 'modul'

const TABS: { key: Tab; label: string }[] = [
  { key: 'kurikulum', label: 'Kurikulum' },
  { key: 'modul', label: 'Modul' },
]

const LIST_PATH = '/karyawan/webinars'

/** Detail webinar (/karyawan/webinars/:webinarId). */
export default function KaryawanWebinarDetail() {
  const { webinarId } = useParams()
  const [tab, setTab] = useState<Tab>('kurikulum')
  const webinar = WEBINARS.find((item) => String(item.id) === webinarId)

  if (!webinar) {
    return (
      <>
        <BackLink to={LIST_PATH} />
        <div className="mt-6 rounded-3xl bg-white shadow-md">
          <EmptyState title="Webinar tidak ditemukan" description="Webinar yang Anda buka tidak tersedia." />
        </div>
      </>
    )
  }

  const hours = (Date.parse(webinar.end) - Date.parse(webinar.start)) / 3_600_000

  return (
    <>
      <CourseHero
        backTo={LIST_PATH}
        label={webinar.category}
        title={webinar.title}
        tagline={webinar.tagline}
        owner={webinar.speaker}
        rating={webinar.rating}
        duration={`${hours.toLocaleString('id-ID', { maximumFractionDigits: 1 })} jam`}
        purchased={webinar.purchased}
        certificateEligible={webinar.certificateEligible}
        price={webinar.price}
      />

      <div className="mt-8 flex border-b border-slate-800" role="tablist" aria-label="Isi webinar">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-4 px-9 pb-3 text-2xl font-bold ${
              tab === key ? 'border-[#0085FF] text-[#0085FF]' : 'border-transparent text-slate-800 hover:text-slate-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {tab === 'kurikulum' ? (
          <div className="rounded-2xl border border-slate-300 bg-white p-5">
            <ul className="space-y-5">
              {webinar.modules.map((module) => (
                <ModuleRow key={module.id} module={module} />
              ))}
            </ul>
          </div>
        ) : (
          <div className="min-w-0">
            <h2 className="px-6 text-xl font-bold text-slate-900">Materi Pendukung</h2>
            <ul className="mt-2 space-y-4">
              {webinar.materials.map((material) => (
                <MaterialRow key={material.id} material={material} locked={!webinar.purchased} />
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-8">
          {tab === 'modul' && webinar.purchased && (
            <AskQuestionButton className="ml-auto" />
          )}
          <ModuleStats total={webinar.modules.length} />
        </div>
      </div>
    </>
  )
}
