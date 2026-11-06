import { BookOpen, Check, ChevronRight, Edit3, Plus, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Field, inputClass } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { LembagaPageHeader } from './LembagaPageHeader'
import { INITIAL_MODULES, type ManagedModule, type ModuleStatus } from './moduleData'

export default function LembagaKelolaModul() {
  const navigate = useNavigate()
  const [modules, setModules] = useState(INITIAL_MODULES)
  const [moduleDialog, setModuleDialog] = useState(false)
  const [reportDialogOpen, setReportDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [moduleTitle, setModuleTitle] = useState('')
  const [notice, setNotice] = useState('')

  function openEditDialog(module: ManagedModule) {
    setEditingId(module.id)
    setModuleTitle(module.title)
    setModuleDialog(true)
  }

  function saveModule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = moduleTitle.trim()
    if (!title) return

    if (editingId === null) return
    setModules((current) => current.map((module) => (module.id === editingId ? { ...module, title } : module)))
    setNotice(`Nama modul diperbarui menjadi "${title}".`)

    setModuleDialog(false)
    setEditingId(null)
    setModuleTitle('')
  }

  function addChapter(id: number) {
    setModules((current) =>
      current.map((module) => (module.id === id ? { ...module, chapters: module.chapters + 1 } : module)),
    )
    const module = modules.find((item) => item.id === id)
    if (module) setNotice(`Bab utama ditambahkan ke "${module.title}".`)
  }

  function toggleExpanded(id: number) {
    setModules((current) =>
      current.map((module) => (module.id === id ? { ...module, expanded: !module.expanded } : module)),
    )
  }

  return (
    <div className="space-y-6">
      <LembagaPageHeader onReportClick={() => setReportDialogOpen(true)} />

      {notice && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800"
        >
          <span>{notice}</span>
          <button type="button" className="font-semibold hover:underline" onClick={() => setNotice('')}>
            Tutup
          </button>
        </div>
      )}

      <section aria-labelledby="manage-modules-title">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 id="manage-modules-title" className="text-2xl font-bold tracking-tight text-slate-900">
              Kelola Modul
            </h1>
            <p className="mt-1 text-sm text-slate-500">Kelola modul, kurikulum, dan interaksi siswa Anda.</p>
          </div>
          <Button
            onClick={() => navigate('/lembaga/modules/new')}
            icon={<Plus className="h-3.5 w-3.5" aria-hidden />}
            className="shrink-0 self-start px-3 py-1.5 text-sm sm:self-auto"
          >
            Tambah Modul
          </Button>
        </div>

        <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-5">
            <div>
              <h2 className="font-semibold text-slate-900">Daftar Modul</h2>
              <p className="mt-0.5 text-xs text-slate-500">{modules.length} modul dikelola</p>
            </div>
            <BookOpen className="h-5 w-5 text-brand-600" aria-hidden />
          </div>

          <ul className="divide-y divide-slate-100">
            {modules.map((module) => (
              <li key={module.id}>
                <div className="flex items-center gap-2 px-3 py-3 sm:gap-4 sm:px-5">
                  <button
                    type="button"
                    onClick={() => toggleExpanded(module.id)}
                    aria-label={`${module.expanded ? 'Tutup' : 'Buka'} detail ${module.title}`}
                    aria-expanded={module.expanded}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-brand-200 hover:bg-blue-50 hover:text-brand-700 focus-visible:outline"
                  >
                    <ChevronRight className={`h-5 w-5 transition-transform ${module.expanded ? 'rotate-90' : ''}`} aria-hidden />
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate(`/lembaga/modules/${module.id}/sessions`, { state: { moduleData: module } })}
                    className="min-w-0 flex-1 text-left focus-visible:outline"
                  >
                    <span className="block truncate text-sm font-semibold leading-5 text-slate-900">{module.title}</span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-2">
                      <StatusBadge status={module.status} />
                      <span className="text-xs font-medium leading-4 text-slate-500">{module.chapters} Bab Utama</span>
                    </span>
                  </button>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => addChapter(module.id)}
                      aria-label={`Tambah bab utama ke ${module.title}`}
                      title="Tambah bab utama"
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-brand-700 transition hover:border-brand-200 hover:bg-blue-50 focus-visible:outline"
                    >
                      <Plus className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditDialog(module)}
                      aria-label={`Edit ${module.title}`}
                      title="Edit modul"
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline"
                    >
                      <Edit3 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </div>

                {module.expanded && (
                  <div className="ml-12 mr-3 mb-3 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600 sm:ml-16 sm:mr-5">
                    <p>
                      {module.chapters > 0
                        ? `Kurikulum terdiri dari ${module.chapters} bab utama.`
                        : 'Belum ada bab utama pada modul ini.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => addChapter(module.id)}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-900"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden /> Tambah bab utama
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-3 text-xs text-slate-500">Perubahan pada halaman ini hanya tersimpan sementara di pratinjau.</p>
      </section>

      <Modal
        open={moduleDialog}
        title="Edit Modul"
        description="Ubah nama modul pada pratinjau."
        onClose={() => setModuleDialog(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModuleDialog(false)}>
              Batal
            </Button>
            <Button
              type="submit"
              form="module-form"
              icon={<Check className="h-4 w-4" aria-hidden />}
            >
              Simpan
            </Button>
          </>
        }
      >
        <form id="module-form" onSubmit={saveModule}>
          <Field id="module-title" label="Nama modul">
            <input
              id="module-title"
              className={inputClass()}
              value={moduleTitle}
              onChange={(event) => setModuleTitle(event.target.value)}
              placeholder="Contoh: UI/UX Design"
              maxLength={100}
              required
              data-autofocus
            />
          </Field>
          <p className="mt-3 text-xs text-slate-500">Data ini hanya untuk pratinjau dan tidak dikirim ke server.</p>
        </form>
      </Modal>

      <Modal
        open={reportDialogOpen}
        title="Laporan Lembaga"
        description="Ringkasan laporan belum tersedia di pratinjau statis."
        onClose={() => setReportDialogOpen(false)}
        footer={
          <Button variant="secondary" onClick={() => setReportDialogOpen(false)} icon={<X className="h-4 w-4" aria-hidden />}>
            Tutup
          </Button>
        }
      >
        <p className="text-sm leading-6 text-slate-600">
          Laporan enrollment dan pemasukan akan ditampilkan setelah modul data laporan tersedia.
        </p>
      </Modal>
    </div>
  )
}

function StatusBadge({ status }: { status: ModuleStatus }) {
  const active = status === 'Aktif'
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold leading-4 ${
        active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
      }`}
    >
      {status}
    </span>
  )
}
