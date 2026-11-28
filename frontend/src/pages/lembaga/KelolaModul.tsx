import { BookOpen, Check, ChevronRight, Edit3, Plus, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Field, inputClass } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { ErrorState, Spinner } from '../../components/ui/States'
import type { Course } from '../../features/courses/types'
import { toApiError } from '../../lib/api'
import { useApiData } from '../../lib/useApiData'
import { LembagaPageHeader } from './LembagaPageHeader'
import { createModule, fetchPrograms, updateProgram } from './api'

export default function LembagaKelolaModul() {
  const navigate = useNavigate()
  const programs = useApiData(fetchPrograms, [])
  const [expanded, setExpanded] = useState<number[]>([])
  const [moduleDialog, setModuleDialog] = useState(false)
  const [reportDialogOpen, setReportDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Course | null>(null)
  const [moduleTitle, setModuleTitle] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const list = programs.data ?? []

  function openEditDialog(program: Course) {
    setEditing(program)
    setModuleTitle(program.title)
    setModuleDialog(true)
  }

  async function saveModule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = moduleTitle.trim()
    if (!title || !editing) return

    setBusy(true)
    try {
      await updateProgram(editing.id, { title })
      setNotice(`Nama program diperbarui menjadi "${title}".`)
      setModuleDialog(false)
      setEditing(null)
      setModuleTitle('')
      programs.reload()
    } catch (error) {
      setNotice(toApiError(error).message)
    } finally {
      setBusy(false)
    }
  }

  async function addChapter(program: Course) {
    setBusy(true)
    try {
      await createModule(program.id, `Bab ${(program.modules_count ?? 0) + 1}`)
      setNotice(`Bab utama ditambahkan ke "${program.title}".`)
      programs.reload()
    } catch (error) {
      setNotice(toApiError(error).message)
    } finally {
      setBusy(false)
    }
  }

  function toggleExpanded(id: number) {
    setExpanded((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]))
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

      {programs.error && <ErrorState error={programs.error} onRetry={programs.reload} />}

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
              <p className="mt-0.5 text-xs text-slate-500">{list.length} modul dikelola</p>
            </div>
            <BookOpen className="h-5 w-5 text-brand-600" aria-hidden />
          </div>

          {programs.loading && !programs.data && <div className="p-6"><Spinner label="Memuat modul…" /></div>}

          <ul className="divide-y divide-slate-100">
            {list.map((program) => {
              const isExpanded = expanded.includes(program.id)
              const chapters = program.modules_count ?? 0

              return (
                <li key={program.id}>
                  <div className="flex items-center gap-2 px-3 py-3 sm:gap-4 sm:px-5">
                    <button
                      type="button"
                      onClick={() => toggleExpanded(program.id)}
                      aria-label={`${isExpanded ? 'Tutup' : 'Buka'} detail ${program.title}`}
                      aria-expanded={isExpanded}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-brand-200 hover:bg-blue-50 hover:text-brand-700 focus-visible:outline"
                    >
                      <ChevronRight className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} aria-hidden />
                    </button>

                    <button
                      type="button"
                      onClick={() => navigate(`/lembaga/modules/${program.id}/sessions`)}
                      className="min-w-0 flex-1 text-left focus-visible:outline"
                    >
                      <span className="block truncate text-sm font-semibold leading-5 text-slate-900">{program.title}</span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-2">
                        <StatusBadge status={program.status_label} />
                        <span className="text-xs font-medium leading-4 text-slate-500">{chapters} Bab Utama</span>
                      </span>
                    </button>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => addChapter(program)}
                        disabled={busy}
                        aria-label={`Tambah bab utama ke ${program.title}`}
                        title="Tambah bab utama"
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-brand-700 transition hover:border-brand-200 hover:bg-blue-50 focus-visible:outline disabled:opacity-50"
                      >
                        <Plus className="h-4 w-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditDialog(program)}
                        aria-label={`Edit ${program.title}`}
                        title="Edit modul"
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline"
                      >
                        <Edit3 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="ml-12 mr-3 mb-3 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600 sm:ml-16 sm:mr-5">
                      <p>
                        {chapters > 0
                          ? `Kurikulum terdiri dari ${chapters} bab utama.`
                          : 'Belum ada bab utama pada modul ini.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => addChapter(program)}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-900"
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden /> Tambah bab utama
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>

          {programs.data && list.length === 0 && (
            <p className="px-5 py-10 text-center text-sm text-slate-500">
              Belum ada program. Klik "Tambah Modul" untuk mulai.
            </p>
          )}
        </div>
      </section>

      <Modal
        open={moduleDialog}
        title="Edit Modul"
        description="Ubah nama program pembelajaran."
        onClose={() => setModuleDialog(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModuleDialog(false)}>
              Batal
            </Button>
            <Button type="submit" form="module-form" disabled={busy} icon={<Check className="h-4 w-4" aria-hidden />}>
              {busy ? 'Menyimpan…' : 'Simpan'}
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
        </form>
      </Modal>

      <Modal
        open={reportDialogOpen}
        title="Laporan Lembaga"
        description="Ringkasan laporan program lembaga Anda."
        onClose={() => setReportDialogOpen(false)}
        footer={
          <Button variant="secondary" onClick={() => setReportDialogOpen(false)} icon={<X className="h-4 w-4" aria-hidden />}>
            Tutup
          </Button>
        }
      >
        <p className="text-sm leading-6 text-slate-600">
          Laporan pendapatan, enrollment, dan harga tiap program tersedia di halaman Jelajahi.
        </p>
        <button
          type="button"
          onClick={() => {
            setReportDialogOpen(false)
            navigate('/lembaga/explore')
          }}
          className="mt-4 w-full rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-blue-50"
        >
          Buka laporan
        </button>
      </Modal>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
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
