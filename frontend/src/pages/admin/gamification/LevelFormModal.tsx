import { type FormEvent, useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { Field, inputClass } from '../../../components/ui/Field'
import { Modal } from '../../../components/ui/Modal'
import { api, toApiError } from '../../../lib/api'
import type { ApiMessage } from '../../../types'
import type { Level } from './types'

interface Props {
  level?: Level
  onClose: () => void
  onSaved: (message: string) => void
}

type FieldErrors = Record<string, string[]>

export function LevelFormModal({ level, onClose, onSaved }: Props) {
  const [name, setName] = useState(level?.name ?? '')
  const [minXp, setMinXp] = useState(level ? String(level.min_xp) : '')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [general, setGeneral] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const firstError = (field: string) => errors[field]?.[0]

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setGeneral(null)

    const value = Number(minXp)
    const local: FieldErrors = {}
    if (!name.trim()) local.name = ['Nama level wajib diisi.']
    if (!Number.isInteger(value) || value < 0 || value > 100_000_000) {
      local.min_xp = ['XP minimal harus bilangan bulat antara 0 dan 100.000.000.']
    }
    setErrors(local)
    if (Object.keys(local).length > 0) return

    setSubmitting(true)
    try {
      const payload = { name: name.trim(), min_xp: value }
      const response = level
        ? await api.patch<ApiMessage<Level>>(`/gamification/levels/${level.id}`, payload)
        : await api.post<ApiMessage<Level>>('/gamification/levels', payload)

      onSaved(response.data.message ?? (level ? 'Level berhasil diperbarui.' : 'Level berhasil dibuat.'))
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
      title={level ? 'Ubah Level' : 'Tambah Level'}
      description="Nama level dan XP minimal harus unik."
      onClose={onClose}
      dismissible={!submitting}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Batal
          </Button>
          <Button type="submit" form="level-form" loading={submitting}>
            {level ? 'Simpan Perubahan' : 'Buat Level'}
          </Button>
        </>
      }
    >
      <form id="level-form" onSubmit={onSubmit} noValidate className="space-y-4">
        {general && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {general}
          </p>
        )}
        <Field id="level-name" label="Nama level" error={firstError('name')} hint="Maksimal 50 karakter.">
          <input
            id="level-name"
            data-autofocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={50}
            aria-invalid={!!firstError('name')}
            aria-describedby="level-name-help"
            className={inputClass(!!firstError('name'))}
          />
        </Field>
        <Field id="level-min-xp" label="XP minimal" error={firstError('min_xp')} hint="Nilai XP tertinggi yang sudah dicapai akan menentukan level Siswa.">
          <input
            id="level-min-xp"
            type="number"
            min={0}
            max={100_000_000}
            step={1}
            value={minXp}
            onChange={(event) => setMinXp(event.target.value)}
            aria-invalid={!!firstError('min_xp')}
            aria-describedby="level-min-xp-help"
            className={inputClass(!!firstError('min_xp'))}
          />
        </Field>
      </form>
    </Modal>
  )
}
