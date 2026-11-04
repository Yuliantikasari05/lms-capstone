import { type FormEvent, type ReactNode, useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { Field, inputClass } from '../../../components/ui/Field'
import { Modal } from '../../../components/ui/Modal'
import { api, toApiError } from '../../../lib/api'
import type { ApiMessage } from '../../../types'
import type { Course, CourseModule, Material, MaterialType } from '../types'
import { FILE_ACCEPT, MATERIAL_TYPE_OPTIONS, MAX_UPLOAD_MB, allowsXp, formatFileSize } from '../utils'

interface Props {
  course: Course
  module: CourseModule
  /** Ada = mode ubah (jenis terkunci). */
  material?: Material
  onClose: () => void
  onSaved: (message: string) => void
}

type FieldErrors = Record<string, string[]>

const STEP_TITLES = ['Info dasar', 'Keterangan', 'Tinjau'] as const
/** Kolom milik tahap 1; sisanya tahap 2. Dipakai untuk melompat ke tahap yang bermasalah saat server menolak. */
const STEP1_FIELDS = ['title', 'type', 'duration_minutes', 'xp_points']

/**
 * Wizard tambah/ubah materi, 3 tahap sesuai activity diagram:
 * 1) judul, jenis, XP  2) deskripsi, file atau tautan  3) tinjau dan simpan.
 */
export function MaterialWizard({ course, module, material, onClose, onSaved }: Props) {
  const isEdit = !!material
  const [step, setStep] = useState(0)

  const [title, setTitle] = useState(material?.title ?? '')
  const [type, setType] = useState<MaterialType | ''>(material?.type ?? '')
  const [duration, setDuration] = useState(material?.duration_minutes ? String(material.duration_minutes) : '')
  const [xp, setXp] = useState(String(material?.xp_points ?? 0))
  const [description, setDescription] = useState(material?.description ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState(material?.external_url ?? '')

  const [errors, setErrors] = useState<FieldErrors>({})
  const [general, setGeneral] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const xpAllowed = allowsXp(course.type)
  const typeOption = MATERIAL_TYPE_OPTIONS.find((o) => o.value === type)
  const firstError = (field: string) => errors[field]?.[0]
  const describedBy = (field: string) => (firstError(field) ? `${field}-help` : undefined)
  const hasExistingFile = !!material?.has_file

  const validateStep = (index: number): FieldErrors => {
    const e: FieldErrors = {}
    if (index === 0) {
      if (!title.trim()) e.title = ['Judul materi wajib diisi.']
      if (!type) e.type = ['Jenis konten wajib dipilih.']
      if (xpAllowed && xp !== '' && (Number(xp) < 0 || Number(xp) > 100 || !Number.isInteger(Number(xp)))) e.xp_points = ['XP harus bilangan bulat 0 sampai 100.']
    }
    if (index === 1) {
      if (file && file.size > MAX_UPLOAD_MB * 1024 * 1024) e.file = [`Ukuran file maksimal ${MAX_UPLOAD_MB} MB.`]
      if (type === 'pdf' || type === 'document') {
        if (!file && !hasExistingFile) e.file = [`File ${type === 'pdf' ? 'PDF' : 'dokumen'} wajib diunggah.`]
      }
      if (type === 'link' && !url.trim()) e.external_url = ['Tautan wajib diisi.']
      if (type === 'video' && !file && !url.trim() && !hasExistingFile) e.file = ['Unggah file video atau isi tautan video.']
    }
    return e
  }

  const next = () => {
    const e = validateStep(step)
    setErrors(e)
    if (Object.keys(e).length === 0) setStep((s) => s + 1)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (step < 2) {
      next()
      return
    }
    setGeneral(null)

    const all = { ...validateStep(0), ...validateStep(1) }
    if (Object.keys(all).length > 0) {
      setErrors(all)
      setStep(Object.keys(all).some((k) => STEP1_FIELDS.includes(k)) ? 0 : 1)
      return
    }

    const body = new FormData()
    body.append('title', title.trim())
    if (!isEdit) body.append('type', type)
    body.append('description', description.trim())
    if (type === 'video' && duration) body.append('duration_minutes', duration)
    if (xpAllowed) body.append('xp_points', xp === '' ? '0' : xp)
    if (file) body.append('file', file)
    if ((type === 'link' || type === 'video') && url.trim()) body.append('external_url', url.trim())

    setSubmitting(true)
    try {
      // Mengubah materi DENGAN file memakai POST + _method=PATCH (PHP tidak membaca multipart pada PATCH).
      const res = isEdit
        ? await api.post<ApiMessage<Material>>(`/materials/${material!.id}`, (body.append('_method', 'PATCH'), body))
        : await api.post<ApiMessage<Material>>(`/modules/${module.id}/materials`, body)
      onSaved(res.data.message ?? 'Materi berhasil disimpan.')
    } catch (error) {
      const apiError = toApiError(error)
      if (apiError.kind === 'validation' && Object.keys(apiError.fieldErrors).length > 0) {
        setErrors(apiError.fieldErrors)
        setStep(Object.keys(apiError.fieldErrors).some((k) => STEP1_FIELDS.includes(k)) ? 0 : 1)
      } else {
        setGeneral(apiError.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const sourceSummary = file
    ? `${file.name} (${formatFileSize(file.size)})`
    : url.trim()
      ? url.trim()
      : hasExistingFile
        ? `${material?.file?.name ?? 'File saat ini'} (tidak diganti)`
        : '—'

  return (
    <Modal
      open
      title={isEdit ? 'Ubah Materi' : 'Tambah Materi'}
      description={`Modul: ${module.title}`}
      size="lg"
      onClose={onClose}
      dismissible={!submitting}
      footer={
        <>
          <Button variant="secondary" onClick={step === 0 ? onClose : () => setStep((s) => s - 1)} disabled={submitting}>
            {step === 0 ? 'Batal' : 'Kembali'}
          </Button>
          {step < 2 ? (
            <Button onClick={next}>Lanjut</Button>
          ) : (
            <Button type="submit" form="material-form" loading={submitting}>
              Simpan
            </Button>
          )}
        </>
      }
    >
      <ol className="mb-4 flex gap-2 text-xs" aria-label="Tahapan">
        {STEP_TITLES.map((label, i) => (
          <li
            key={label}
            aria-current={i === step ? 'step' : undefined}
            className={`rounded-full px-3 py-1 font-medium ${i === step ? 'bg-ink-900 text-white' : i < step ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      <form id="material-form" onSubmit={submit} noValidate className="space-y-4">
        {general && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {general}
          </p>
        )}

        {step === 0 && (
          <>
            <Field id="material-title" label="Judul materi" error={firstError('title')}>
              <input
                id="material-title"
                data-autofocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={150}
                autoComplete="off"
                aria-invalid={!!firstError('title')}
                aria-describedby={describedBy('title')}
                className={inputClass(!!firstError('title'))}
              />
            </Field>

            <Field id="material-type" label="Jenis konten" error={firstError('type')} hint={isEdit ? 'Jenis konten tidak dapat diubah.' : typeOption?.hint}>
              <select
                id="material-type"
                value={type}
                onChange={(e) => {
                  setType(e.target.value as MaterialType)
                  setFile(null)
                }}
                disabled={isEdit}
                aria-invalid={!!firstError('type')}
                aria-describedby="material-type-help"
                className={inputClass(!!firstError('type'))}
              >
                <option value="">Pilih jenis…</option>
                {MATERIAL_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              {type === 'video' && (
                <Field id="material-duration" label="Durasi (menit, opsional)" error={firstError('duration_minutes')}>
                  <input
                    id="material-duration"
                    type="number"
                    min={1}
                    max={1440}
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    aria-describedby={describedBy('duration_minutes')}
                    className={inputClass(!!firstError('duration_minutes'))}
                  />
                </Field>
              )}
              {xpAllowed ? (
                <Field id="material-xp" label="XP saat selesai (0–100)" error={firstError('xp_points')} hint="XP diberikan kepada Siswa saat materi diselesaikan.">
                  <input
                    id="material-xp"
                    type="number"
                    min={0}
                    max={100}
                    value={xp}
                    onChange={(e) => setXp(e.target.value)}
                    aria-describedby="material-xp-help"
                    className={inputClass(!!firstError('xp_points'))}
                  />
                </Field>
              ) : (
                <p className="self-end rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">Kursus {course.type_label} tidak memakai XP.</p>
              )}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <Field id="material-description" label="Deskripsi (opsional)" error={firstError('description')}>
              <textarea
                id="material-description"
                data-autofocus
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={5000}
                className={inputClass(!!firstError('description'))}
              />
            </Field>

            {type !== 'link' && (
              <Field
                id="material-file"
                label={type === 'video' ? 'File video (atau isi tautan di bawah)' : 'File'}
                error={firstError('file')}
                hint={`Maksimal ${MAX_UPLOAD_MB} MB.${hasExistingFile ? ' Kosongkan untuk mempertahankan file saat ini.' : ''}`}
              >
                <input
                  id="material-file"
                  type="file"
                  accept={type ? FILE_ACCEPT[type] : undefined}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  aria-invalid={!!firstError('file')}
                  aria-describedby="material-file-help"
                  className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-slate-200"
                />
                {hasExistingFile && !file && material?.file?.name && <p className="mt-1 text-xs text-slate-500">File saat ini: {material.file.name}</p>}
              </Field>
            )}

            {(type === 'link' || type === 'video') && (
              <Field id="material-url" label={type === 'video' ? 'Tautan video (opsional)' : 'Tautan'} error={firstError('external_url')} hint="Harus diawali http:// atau https://">
                <input
                  id="material-url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://"
                  aria-invalid={!!firstError('external_url')}
                  aria-describedby="material-url-help"
                  className={inputClass(!!firstError('external_url'))}
                />
              </Field>
            )}
          </>
        )}

        {step === 2 && (
          <dl className="divide-y divide-slate-100 rounded-lg border border-slate-100 text-sm" data-testid="material-review">
            <ReviewRow label="Judul">{title.trim()}</ReviewRow>
            <ReviewRow label="Jenis">{typeOption?.label}</ReviewRow>
            {type === 'video' && duration && <ReviewRow label="Durasi">{duration} menit</ReviewRow>}
            {xpAllowed && <ReviewRow label="XP">{xp === '' ? 0 : xp}</ReviewRow>}
            <ReviewRow label="Deskripsi">{description.trim() || '—'}</ReviewRow>
            <ReviewRow label={type === 'link' ? 'Tautan' : 'Sumber'}>{sourceSummary}</ReviewRow>
          </dl>
        )}
      </form>
    </Modal>
  )
}

function ReviewRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 px-3 py-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="col-span-2 break-words text-slate-800">{children}</dd>
    </div>
  )
}
