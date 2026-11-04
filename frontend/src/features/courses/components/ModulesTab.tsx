import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, ExternalLink, File, FileText, Link2, Pencil, Plus, Trash2, Video } from 'lucide-react'
import { type FormEvent, type ReactNode, useState } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { Field, inputClass } from '../../../components/ui/Field'
import { Modal } from '../../../components/ui/Modal'
import { Notice } from '../../../components/ui/Notice'
import { EmptyState, ErrorState, Spinner } from '../../../components/ui/States'
import { API_BASE_URL, api, toApiError } from '../../../lib/api'
import { useApiData } from '../../../lib/useApiData'
import type { ApiMessage } from '../../../types'
import type { Course, CourseModule, Material } from '../types'
import { formatFileSize } from '../utils'
import { MaterialWizard } from './MaterialWizard'

const TYPE_ICON = { video: Video, pdf: FileText, document: File, link: Link2 } as const

type Dialog =
  | { type: 'module'; module?: CourseModule }
  | { type: 'delete-module'; module: CourseModule }
  | { type: 'material'; module: CourseModule; material?: Material }
  | { type: 'delete-material'; material: Material }
  | null

function IconBtn({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`rounded-lg p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-600 hover:bg-slate-100'}`}
    >
      {children}
    </button>
  )
}

function materialMeta(m: Material): string {
  const parts: string[] = [m.type_label]
  if (m.type === 'video' && m.duration_minutes) parts.push(`${m.duration_minutes} menit`)
  if (m.file?.size) parts.push(formatFileSize(m.file.size))
  if (m.type === 'video' && !m.has_file && m.external_url) parts.push('tautan')
  return parts.join(' · ')
}

/** Membuka materi: file lewat endpoint berizin, selain itu tautan luar (di tab baru). */
function openMaterial(m: Material) {
  const url = m.has_file ? `${API_BASE_URL}/materials/${m.id}/file` : m.external_url
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
}

export function ModulesTab({ course, readOnly, onChanged }: { course: Course; readOnly: boolean; onChanged: () => void }) {
  const modules = useApiData<CourseModule[]>(async () => (await api.get<{ data: CourseModule[] }>(`/courses/${course.id}/modules`)).data.data, [course.id])

  const [open, setOpen] = useState<Set<number>>(new Set())
  const [dialog, setDialog] = useState<Dialog>(null)
  const [busy, setBusy] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  const list = modules.data ?? []

  const toggle = (id: number) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const closeDialog = () => {
    setDialog(null)
    setDialogError(null)
  }

  const refresh = () => {
    modules.reload()
    onChanged()
  }

  const done = (text: string, expand?: number) => {
    closeDialog()
    setNotice({ tone: 'success', text })
    if (expand) setOpen((prev) => new Set(prev).add(expand))
    refresh()
  }

  const run = async (action: () => Promise<{ data: { message?: string } }>) => {
    setBusy(true)
    setDialogError(null)
    try {
      const res = await action()
      done(res.data.message ?? 'Berhasil.')
    } catch (error) {
      setDialogError(toApiError(error).message)
    } finally {
      setBusy(false)
    }
  }

  const moveModule = async (index: number, delta: -1 | 1) => {
    const ids = list.map((m) => m.id)
    const target = index + delta
    if (target < 0 || target >= ids.length) return
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    try {
      await api.put(`/courses/${course.id}/modules/order`, { ids })
      modules.reload()
    } catch (error) {
      setNotice({ tone: 'error', text: toApiError(error).message })
    }
  }

  const moveMaterial = async (module: CourseModule, index: number, delta: -1 | 1) => {
    const ids = (module.materials ?? []).map((m) => m.id)
    const target = index + delta
    if (target < 0 || target >= ids.length) return
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    try {
      await api.put(`/modules/${module.id}/materials/order`, { ids })
      modules.reload()
    } catch (error) {
      setNotice({ tone: 'error', text: toApiError(error).message })
    }
  }

  return (
    <div>
      {notice && (
        <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.text}
        </Notice>
      )}

      {!readOnly && (
        <div className="mb-4 flex justify-end">
          <Button onClick={() => setDialog({ type: 'module' })} icon={<Plus className="h-4 w-4" aria-hidden />}>
            Tambah Modul
          </Button>
        </div>
      )}

      {modules.loading && !modules.data && <Spinner label="Memuat modul…" />}
      {modules.error && <ErrorState error={modules.error} onRetry={modules.reload} />}
      {modules.data && list.length === 0 && <EmptyState title="Belum ada modul" description={readOnly ? 'Kursus ini belum memiliki isi.' : 'Mulai dengan menambahkan modul pertama.'} />}

      <ul className="space-y-3">
        {list.map((module, mi) => {
          const expanded = open.has(module.id)
          const materials = module.materials ?? []
          return (
            <li key={module.id} className="rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center gap-2 px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => toggle(module.id)}
                  aria-expanded={expanded}
                  aria-controls={`module-${module.id}`}
                  className="flex flex-1 items-center gap-2 text-left"
                >
                  {expanded ? <ChevronDown className="h-4 w-4 shrink-0" aria-hidden /> : <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />}
                  <span className="font-medium text-slate-900">{module.title}</span>
                  <span className="text-xs text-slate-500">{materials.length} materi</span>
                </button>
                {!readOnly && (
                  <div className="flex items-center">
                    <IconBtn label={`Naikkan modul ${module.title}`} onClick={() => moveModule(mi, -1)} disabled={mi === 0}>
                      <ArrowUp className="h-4 w-4" aria-hidden />
                    </IconBtn>
                    <IconBtn label={`Turunkan modul ${module.title}`} onClick={() => moveModule(mi, 1)} disabled={mi === list.length - 1}>
                      <ArrowDown className="h-4 w-4" aria-hidden />
                    </IconBtn>
                    <Button variant="secondary" onClick={() => setDialog({ type: 'material', module })} icon={<Plus className="h-3.5 w-3.5" aria-hidden />} className="!px-2.5 !py-1 !text-xs">
                      Item
                    </Button>
                    <IconBtn label={`Ubah modul ${module.title}`} onClick={() => setDialog({ type: 'module', module })}>
                      <Pencil className="h-4 w-4" aria-hidden />
                    </IconBtn>
                    <IconBtn label={`Hapus modul ${module.title}`} danger onClick={() => setDialog({ type: 'delete-module', module })}>
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </IconBtn>
                  </div>
                )}
              </div>

              {expanded && (
                <ul id={`module-${module.id}`} className="divide-y divide-slate-100 rounded-b-xl border-t border-slate-100 bg-slate-50">
                  {materials.length === 0 && <li className="px-4 py-3 text-sm text-slate-500">Belum ada materi di modul ini.</li>}
                  {materials.map((material, i) => {
                    const Icon = TYPE_ICON[material.type]
                    const openable = material.has_file || !!material.external_url
                    return (
                      <li key={material.id} className="flex items-center gap-3 px-4 py-2.5">
                        <Icon className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800">{material.title}</p>
                          <p className="text-xs text-slate-500">{materialMeta(material)}</p>
                        </div>
                        {material.xp_points > 0 && <Badge tone="info">+{material.xp_points} XP</Badge>}
                        <div className="flex items-center">
                          {openable && (
                            <IconBtn label={`Buka materi ${material.title}`} onClick={() => openMaterial(material)}>
                              <ExternalLink className="h-4 w-4" aria-hidden />
                            </IconBtn>
                          )}
                          {!readOnly && (
                            <>
                              <IconBtn label={`Naikkan materi ${material.title}`} onClick={() => moveMaterial(module, i, -1)} disabled={i === 0}>
                                <ArrowUp className="h-4 w-4" aria-hidden />
                              </IconBtn>
                              <IconBtn label={`Turunkan materi ${material.title}`} onClick={() => moveMaterial(module, i, 1)} disabled={i === materials.length - 1}>
                                <ArrowDown className="h-4 w-4" aria-hidden />
                              </IconBtn>
                              <IconBtn label={`Ubah materi ${material.title}`} onClick={() => setDialog({ type: 'material', module, material })}>
                                <Pencil className="h-4 w-4" aria-hidden />
                              </IconBtn>
                              <IconBtn label={`Hapus materi ${material.title}`} danger onClick={() => setDialog({ type: 'delete-material', material })}>
                                <Trash2 className="h-4 w-4" aria-hidden />
                              </IconBtn>
                            </>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </li>
          )
        })}
      </ul>

      {dialog?.type === 'module' && (
        <ModuleFormModal
          courseId={course.id}
          module={dialog.module}
          onClose={closeDialog}
          onSaved={(message, id) => done(message, id)}
        />
      )}

      {dialog?.type === 'material' && (
        <MaterialWizard
          course={course}
          module={dialog.module}
          material={dialog.material}
          onClose={closeDialog}
          onSaved={(message) => done(message, dialog.module.id)}
        />
      )}

      <ConfirmDialog
        open={dialog?.type === 'delete-module'}
        title="Hapus modul?"
        tone="danger"
        confirmLabel="Hapus"
        loading={busy}
        error={dialogError}
        onCancel={closeDialog}
        onConfirm={() => dialog?.type === 'delete-module' && run(() => api.delete<{ message?: string }>(`/modules/${dialog.module.id}`))}
        message={
          dialog?.type === 'delete-module' && (
            <>
              Modul <strong>{dialog.module.title}</strong> beserta seluruh materinya akan dihapus dari kursus ini.
            </>
          )
        }
      />

      <ConfirmDialog
        open={dialog?.type === 'delete-material'}
        title="Hapus materi?"
        tone="danger"
        confirmLabel="Hapus"
        loading={busy}
        error={dialogError}
        onCancel={closeDialog}
        onConfirm={() => dialog?.type === 'delete-material' && run(() => api.delete<{ message?: string }>(`/materials/${dialog.material.id}`))}
        message={
          dialog?.type === 'delete-material' && (
            <>
              Materi <strong>{dialog.material.title}</strong> akan dihapus dari modul.
            </>
          )
        }
      />
    </div>
  )
}

function ModuleFormModal({ courseId, module, onClose, onSaved }: { courseId: number; module?: CourseModule; onClose: () => void; onSaved: (message: string, moduleId?: number) => void }) {
  const [title, setTitle] = useState(module?.title ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const isEdit = !!module

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim()) {
      setError('Judul modul wajib diisi.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const res = isEdit
        ? await api.patch<ApiMessage<CourseModule>>(`/modules/${module!.id}`, { title: title.trim() })
        : await api.post<ApiMessage<CourseModule>>(`/courses/${courseId}/modules`, { title: title.trim() })
      onSaved(res.data.message ?? 'Modul berhasil disimpan.', res.data.data.id)
    } catch (e) {
      const apiError = toApiError(e)
      setError(apiError.fieldErrors.title?.[0] ?? apiError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      title={isEdit ? 'Ubah Modul' : 'Tambah Modul'}
      size="sm"
      onClose={onClose}
      dismissible={!submitting}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Batal
          </Button>
          <Button type="submit" form="module-form" loading={submitting}>
            Simpan
          </Button>
        </>
      }
    >
      <form id="module-form" onSubmit={submit} noValidate>
        <Field id="module-title" label="Judul modul" error={error ?? undefined}>
          <input
            id="module-title"
            data-autofocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={150}
            autoComplete="off"
            aria-invalid={!!error}
            aria-describedby={error ? 'module-title-help' : undefined}
            className={inputClass(!!error)}
          />
        </Field>
      </form>
    </Modal>
  )
}
