import { Pencil, Plus, Trash2, Video } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { Field, inputClass } from '../../../components/ui/Field'
import { Modal } from '../../../components/ui/Modal'
import { Notice } from '../../../components/ui/Notice'
import { EmptyState, ErrorState, Spinner } from '../../../components/ui/States'
import { api, toApiError } from '../../../lib/api'
import { useApiData } from '../../../lib/useApiData'
import type { ApiMessage } from '../../../types'
import type { ClassSession, Course } from '../types'
import { SESSION_STATUS, formatSessionRange, fromDatetimeLocal, toDatetimeLocal } from '../utils'

type Dialog = { type: 'form'; session?: ClassSession } | { type: 'delete'; session: ClassSession } | null

export function SessionsTab({ course, readOnly, onChanged }: { course: Course; readOnly: boolean; onChanged: () => void }) {
  const sessions = useApiData<ClassSession[]>(async () => (await api.get<{ data: ClassSession[] }>(`/courses/${course.id}/sessions`)).data.data, [course.id])

  const [dialog, setDialog] = useState<Dialog>(null)
  const [busy, setBusy] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  const canJoin = !!course.abilities?.manage_content
  const list = sessions.data ?? []

  const closeDialog = () => {
    setDialog(null)
    setDialogError(null)
  }

  const done = (text: string) => {
    closeDialog()
    setNotice({ tone: 'success', text })
    sessions.reload()
    onChanged()
  }

  const remove = async (session: ClassSession) => {
    setBusy(true)
    setDialogError(null)
    try {
      const res = await api.delete<{ message?: string }>(`/sessions/${session.id}`)
      done(res.data.message ?? 'Sesi berhasil dihapus.')
    } catch (error) {
      setDialogError(toApiError(error).message)
    } finally {
      setBusy(false)
    }
  }

  // Link meeting diambil hanya saat dibutuhkan (bukan dibawa di daftar), lalu dibuka di tab baru.
  const join = async (session: ClassSession) => {
    try {
      const res = await api.get<{ data: { meeting_url: string } }>(`/sessions/${session.id}/meeting-link`)
      window.open(res.data.data.meeting_url, '_blank', 'noopener,noreferrer')
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
          <Button onClick={() => setDialog({ type: 'form' })} icon={<Plus className="h-4 w-4" aria-hidden />}>
            Tambah Sesi
          </Button>
        </div>
      )}

      {sessions.loading && !sessions.data && <Spinner label="Memuat sesi…" />}
      {sessions.error && <ErrorState error={sessions.error} onRetry={sessions.reload} />}
      {sessions.data && list.length === 0 && <EmptyState title="Belum ada sesi" description={readOnly ? 'Kursus ini belum memiliki jadwal sesi.' : 'Tambahkan jadwal sesi online untuk kursus ini.'} />}

      <ul className="space-y-3">
        {list.map((session) => {
          const status = SESSION_STATUS[session.status]
          return (
            <li key={session.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-slate-900">{session.title}</p>
                  <Badge tone="neutral">{session.type_label}</Badge>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </div>
                <p className="mt-0.5 text-sm text-slate-600">{formatSessionRange(session.starts_at, session.ends_at)}</p>
                <p className="text-xs text-slate-500">Instruktur: {session.instructor?.name ?? 'Belum ada Mentor'}</p>
              </div>
              <div className="flex items-center gap-1">
                {canJoin && (
                  <Button variant="secondary" onClick={() => join(session)} icon={<Video className="h-4 w-4" aria-hidden />} aria-label={`Masuk meeting ${session.title}`}>
                    Masuk meeting
                  </Button>
                )}
                {!readOnly && (
                  <>
                    <button type="button" aria-label={`Ubah sesi ${session.title}`} title={`Ubah sesi ${session.title}`} onClick={() => setDialog({ type: 'form', session })} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100">
                      <Pencil className="h-4 w-4" aria-hidden />
                    </button>
                    <button type="button" aria-label={`Hapus sesi ${session.title}`} title={`Hapus sesi ${session.title}`} onClick={() => setDialog({ type: 'delete', session })} className="rounded-lg p-2 text-red-600 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {dialog?.type === 'form' && <SessionFormModal courseId={course.id} session={dialog.session} onClose={closeDialog} onSaved={done} />}

      <ConfirmDialog
        open={dialog?.type === 'delete'}
        title="Hapus sesi?"
        tone="danger"
        confirmLabel="Hapus"
        loading={busy}
        error={dialogError}
        onCancel={closeDialog}
        onConfirm={() => dialog?.type === 'delete' && remove(dialog.session)}
        message={
          dialog?.type === 'delete' && (
            <>
              Sesi <strong>{dialog.session.title}</strong> akan dihapus dari jadwal kursus.
            </>
          )
        }
      />
    </div>
  )
}

type FieldErrors = Record<string, string[]>

function SessionFormModal({ courseId, session, onClose, onSaved }: { courseId: number; session?: ClassSession; onClose: () => void; onSaved: (message: string) => void }) {
  const isEdit = !!session
  const [title, setTitle] = useState(session?.title ?? '')
  const [startsAt, setStartsAt] = useState(toDatetimeLocal(session?.starts_at))
  const [endsAt, setEndsAt] = useState(toDatetimeLocal(session?.ends_at))
  // Link meeting hanya dikirim server untuk yang berhak mengelola; form ubah memuatnya dari sini.
  const [url, setUrl] = useState(session?.meeting_url ?? '')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [general, setGeneral] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const firstError = (field: string) => errors[field]?.[0]
  const describedBy = (field: string) => (firstError(field) ? `${field}-help` : undefined)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setGeneral(null)

    const local: FieldErrors = {}
    if (!title.trim()) local.title = ['Judul sesi wajib diisi.']
    if (!startsAt) local.starts_at = ['Waktu mulai wajib diisi.']
    if (!endsAt) local.ends_at = ['Waktu selesai wajib diisi.']
    if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) local.ends_at = ['Waktu selesai harus setelah waktu mulai.']
    if (!url.trim()) local.meeting_url = ['Link meeting wajib diisi.']
    setErrors(local)
    if (Object.keys(local).length > 0) return

    const payload = { title: title.trim(), starts_at: fromDatetimeLocal(startsAt), ends_at: fromDatetimeLocal(endsAt), meeting_url: url.trim() }
    setSubmitting(true)
    try {
      const res = isEdit
        ? await api.patch<ApiMessage<ClassSession>>(`/sessions/${session!.id}`, payload)
        : await api.post<ApiMessage<ClassSession>>(`/courses/${courseId}/sessions`, payload)
      onSaved(res.data.message ?? 'Sesi berhasil disimpan.')
    } catch (error) {
      const apiError = toApiError(error)
      if (apiError.kind === 'validation' && Object.keys(apiError.fieldErrors).length > 0) setErrors(apiError.fieldErrors)
      else setGeneral(apiError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      title={isEdit ? 'Ubah Sesi' : 'Tambah Sesi'}
      description="Tipe sesi mengikuti jenis kursus. Instruktur adalah Mentor kursus."
      onClose={onClose}
      dismissible={!submitting}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Batal
          </Button>
          <Button type="submit" form="session-form" loading={submitting}>
            Simpan
          </Button>
        </>
      }
    >
      <form id="session-form" onSubmit={submit} noValidate className="space-y-4">
        {general && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {general}
          </p>
        )}

        <Field id="session-title" label="Judul sesi" error={firstError('title')}>
          <input id="session-title" data-autofocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} autoComplete="off" aria-invalid={!!firstError('title')} aria-describedby={describedBy('title')} className={inputClass(!!firstError('title'))} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="session-start" label="Mulai" error={firstError('starts_at')}>
            <input id="session-start" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} aria-invalid={!!firstError('starts_at')} aria-describedby={describedBy('starts_at')} className={inputClass(!!firstError('starts_at'))} />
          </Field>
          <Field id="session-end" label="Selesai" error={firstError('ends_at')}>
            <input id="session-end" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} aria-invalid={!!firstError('ends_at')} aria-describedby={describedBy('ends_at')} className={inputClass(!!firstError('ends_at'))} />
          </Field>
        </div>

        <Field id="session-url" label="Link meeting (Zoom / Google Meet)" error={firstError('meeting_url')} hint="Harus diawali http:// atau https://">
          <input id="session-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" aria-invalid={!!firstError('meeting_url')} aria-describedby="session-url-help" className={inputClass(!!firstError('meeting_url'))} />
        </Field>
      </form>
    </Modal>
  )
}
