import { type FormEvent, useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { Field, inputClass } from '../../../components/ui/Field'
import { Modal } from '../../../components/ui/Modal'
import { api, toApiError } from '../../../lib/api'
import type { ApiMessage } from '../../../types'
import type { Course } from '../types'
import { CREATABLE_TYPES } from '../utils'
import { useMentors } from './MentorSelect'

interface Props {
  mode: 'create' | 'edit'
  /** Wajib saat mode "edit". */
  course?: Course
  onClose: () => void
  onSaved: (message: string, course: Course) => void
}

type FieldErrors = Record<string, string[]>

/**
 * Form tambah/ubah kursus. Jenis dan Mentor tidak diubah dari form ubah:
 * jenis tetap seumur kursus, Mentor diganti lewat "Ganti Mentor".
 */
export function CourseFormModal({ mode, course, onClose, onSaved }: Props) {
  const isEdit = mode === 'edit'
  const mentors = useMentors(!isEdit)

  const [type, setType] = useState<string>(course?.type ?? '')
  const [title, setTitle] = useState(course?.title ?? '')
  const [description, setDescription] = useState(course?.description ?? '')
  const [status, setStatus] = useState<string>(course?.status ?? 'draft')
  const [mentorId, setMentorId] = useState<string>('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [general, setGeneral] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const firstError = (field: string) => errors[field]?.[0]
  const describedBy = (field: string) => (firstError(field) ? `${field}-help` : undefined)

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setGeneral(null)

    const local: FieldErrors = {}
    if (!isEdit && !type) local.type = ['Jenis kursus wajib dipilih.']
    if (!title.trim()) local.title = ['Judul kursus wajib diisi.']
    if (status === 'active' && !isEdit && !mentorId) local.mentor_id = ['Kursus harus memiliki Mentor sebelum diaktifkan.']
    setErrors(local)
    if (Object.keys(local).length > 0) return

    setSubmitting(true)
    try {
      if (isEdit) {
        const res = await api.patch<ApiMessage<Course>>(`/courses/${course!.id}`, { title: title.trim(), description: description.trim() || null, status })
        onSaved(res.data.message ?? 'Kursus berhasil diperbarui.', res.data.data)
      } else {
        const payload: Record<string, unknown> = { type, title: title.trim(), description: description.trim() || null, status }
        if (mentorId) payload.mentor_id = Number(mentorId)
        const res = await api.post<ApiMessage<Course>>('/courses', payload)
        onSaved(res.data.message ?? 'Kursus berhasil dibuat.', res.data.data)
      }
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
      title={isEdit ? 'Ubah Kursus' : 'Tambah Kursus'}
      description={isEdit ? `Jenis: ${course?.type_label}` : 'Kursus baru dapat disimpan sebagai draf lebih dulu.'}
      onClose={onClose}
      dismissible={!submitting}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Batal
          </Button>
          <Button type="submit" form="course-form" loading={submitting}>
            {isEdit ? 'Simpan Perubahan' : 'Buat Kursus'}
          </Button>
        </>
      }
    >
      <form id="course-form" onSubmit={onSubmit} noValidate className="space-y-4">
        {general && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {general}
          </p>
        )}

        {isEdit && (
          <div>
            <p className="mb-1 text-sm font-medium text-slate-700">Jenis kursus</p>
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{course?.type_label}</p>
            <p className="mt-1 text-xs text-slate-500">Jenis tidak dapat diubah setelah kursus dibuat.</p>
          </div>
        )}

        {!isEdit && (
          <Field id="type" label="Jenis kursus" error={firstError('type')} hint="Jenis tidak dapat diubah setelah kursus dibuat.">
            <select
              id="type"
              data-autofocus
              value={type}
              onChange={(e) => setType(e.target.value)}
              aria-invalid={!!firstError('type')}
              aria-describedby="type-help"
              className={inputClass(!!firstError('type'))}
            >
              <option value="">Pilih jenis…</option>
              {CREATABLE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field id="title" label="Judul kursus" error={firstError('title')}>
          <input
            id="title"
            data-autofocus={isEdit ? true : undefined}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={150}
            autoComplete="off"
            aria-invalid={!!firstError('title')}
            aria-describedby={describedBy('title')}
            className={inputClass(!!firstError('title'))}
          />
        </Field>

        <Field id="description" label="Deskripsi (opsional)" error={firstError('description')}>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={5000}
            aria-describedby={describedBy('description')}
            className={inputClass(!!firstError('description'))}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="status" label="Status" error={firstError('status')} hint="Hanya kursus Aktif yang terlihat oleh peserta.">
            <select id="status" value={status} onChange={(e) => setStatus(e.target.value)} aria-describedby="status-help" className={inputClass(!!firstError('status'))}>
              <option value="draft">Draf</option>
              <option value="active">Aktif</option>
              {isEdit && <option value="inactive">Nonaktif</option>}
            </select>
          </Field>

          {!isEdit ? (
            <Field id="mentor_id" label="Mentor" error={firstError('mentor_id')} hint="Wajib bila kursus langsung Aktif.">
              <select
                id="mentor_id"
                value={mentorId}
                onChange={(e) => setMentorId(e.target.value)}
                disabled={mentors.loading && !mentors.data}
                aria-invalid={!!firstError('mentor_id')}
                aria-describedby="mentor_id-help"
                className={inputClass(!!firstError('mentor_id'))}
              >
                <option value="">{mentors.loading && !mentors.data ? 'Memuat Mentor…' : '— Belum ada Mentor —'}</option>
                {(mentors.data ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <div>
              <p className="mb-1 text-sm font-medium text-slate-700">Mentor</p>
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{course?.mentor?.name ?? 'Belum ada Mentor'}</p>
              <p className="mt-1 text-xs text-slate-500">Ganti lewat tombol "Ganti Mentor" di halaman detail.</p>
            </div>
          )}
        </div>

      </form>
    </Modal>
  )
}
