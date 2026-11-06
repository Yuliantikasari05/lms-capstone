import { BookOpen, CalendarDays, Check, Clock3, GraduationCap, Pencil, Plus, Users } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import type { ReactNode } from 'react'
import type { ManagedModule } from './moduleData'

export type ModuleDetailTab = 'Modules' | 'Sessions' | 'Resources' | 'Discussions'

const TABS: ModuleDetailTab[] = ['Modules', 'Sessions', 'Resources', 'Discussions']

export function ModuleDetailHeader({
  activeTab,
  onTabChange,
  onAddModule,
  module,
  onRename,
}: {
  activeTab: ModuleDetailTab
  onTabChange: (tab: ModuleDetailTab) => void
  onAddModule: () => void
  module?: ManagedModule
  onRename: (title: string) => void
}) {
  const [editOpen, setEditOpen] = useState(false)
  const title = module?.title || 'Nama Modul Tidak Ditemukan'
  const [draftTitle, setDraftTitle] = useState(title)

  function saveTitle() {
    const nextTitle = draftTitle.trim()
    if (nextTitle) onRename(nextTitle)
    setEditOpen(false)
  }

  return (
    <>
      <Link
        to="/lembaga/modules"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 transition hover:text-brand-900"
      >
        <span aria-hidden>←</span> Kembali ke Kelola Modul
      </Link>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold tracking-wide text-emerald-800">
                <GraduationCap className="h-3.5 w-3.5" aria-hidden /> INSTRUCTOR
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                <Check className="h-3.5 w-3.5" aria-hidden /> Terverifikasi
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
              <CourseMetric icon={<BookOpen className="h-4 w-4" aria-hidden />} label={`${module?.chapters ?? 0} Bab Utama`} />
              <CourseMetric icon={<Clock3 className="h-4 w-4" aria-hidden />} label={`${module?.studyHours ?? 0} Jam Belajar`} />
              <CourseMetric icon={<CalendarDays className="h-4 w-4" aria-hidden />} label={`${module?.sessions ?? 0} Sesi`} />
              <CourseMetric icon={<Users className="h-4 w-4" aria-hidden />} label={`${module?.students ?? 0} Siswa`} />
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setDraftTitle(title)
                setEditOpen(true)
              }}
              icon={<Pencil className="h-4 w-4" aria-hidden />}
            >
              Edit
            </Button>
            <Button onClick={onAddModule} icon={<Plus className="h-4 w-4" aria-hidden />} className="px-3 py-2">
              Module
            </Button>
          </div>
        </div>
      </section>

      <nav role="tablist" aria-label="Detail modul" className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => onTabChange(tab)}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
              activeTab === tab
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab}
          </button>
        ))}
      </nav>

      <Modal
        open={editOpen}
        title="Edit Informasi Modul"
        onClose={() => setEditOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(false)}>
              Batal
            </Button>
            <Button onClick={saveTitle}>Simpan</Button>
          </>
        }
      >
        <label htmlFor="detail-module-title" className="mb-1 block text-sm font-medium text-slate-700">
          Nama modul
        </label>
        <input
          id="detail-module-title"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          value={draftTitle}
          onChange={(event) => setDraftTitle(event.target.value)}
          maxLength={100}
          data-autofocus
        />
        <p className="mt-2 text-xs text-slate-500">Perubahan hanya tersimpan selama pratinjau aktif.</p>
      </Modal>
    </>
  )
}

function CourseMetric({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-slate-400">{icon}</span>
      {label}
    </span>
  )
}
