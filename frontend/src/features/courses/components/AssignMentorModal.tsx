import { type FormEvent, useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { Field, inputClass } from '../../../components/ui/Field'
import { Modal } from '../../../components/ui/Modal'
import { api, toApiError } from '../../../lib/api'
import type { ApiMessage } from '../../../types'
import type { Course } from '../types'
import { useMentors } from './MentorSelect'

interface Props {
  course: Course
  onClose: () => void
  onSaved: (message: string, course: Course) => void
}

/** Menetapkan, mengganti, atau (bila kursus belum aktif) mencabut Mentor. */
export function AssignMentorModal({ course, onClose, onSaved }: Props) {
  const mentors = useMentors()
  const [mentorId, setMentorId] = useState<string>(course.mentor?.id ? String(course.mentor.id) : '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const canClear = course.status !== 'active'

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!mentorId && !canClear) {
      setError('Kursus yang aktif harus memiliki Mentor. Pilih Mentor pengganti atau nonaktifkan kursus dulu.')
      return
    }

    setSubmitting(true)
    try {
      const res = await api.put<ApiMessage<Course>>(`/courses/${course.id}/mentor`, { mentor_id: mentorId ? Number(mentorId) : null })
      onSaved(res.data.message ?? 'Mentor kursus berhasil diperbarui.', res.data.data)
    } catch (e) {
      const apiError = toApiError(e)
      setError(apiError.fieldErrors.mentor_id?.[0] ?? apiError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      title="Ganti Mentor"
      description={course.title}
      onClose={onClose}
      dismissible={!submitting}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Batal
          </Button>
          <Button type="submit" form="mentor-form" loading={submitting}>
            Simpan
          </Button>
        </>
      }
    >
      <form id="mentor-form" onSubmit={onSubmit} noValidate className="space-y-3">
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <Field id="assign_mentor" label="Mentor pengampu" hint={canClear ? 'Kosongkan untuk mencabut Mentor (hanya untuk kursus yang belum aktif).' : 'Kursus aktif harus selalu memiliki Mentor.'}>
          <select
            id="assign_mentor"
            data-autofocus
            value={mentorId}
            onChange={(e) => setMentorId(e.target.value)}
            disabled={mentors.loading && !mentors.data}
            aria-describedby="assign_mentor-help"
            className={inputClass(!!error)}
          >
            <option value="">{mentors.loading && !mentors.data ? 'Memuat Mentor…' : '— Tanpa Mentor —'}</option>
            {(mentors.data ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
        <p className="text-xs text-slate-500">Mentor lama kehilangan akses ke kursus ini begitu Mentor diganti.</p>
      </form>
    </Modal>
  )
}
