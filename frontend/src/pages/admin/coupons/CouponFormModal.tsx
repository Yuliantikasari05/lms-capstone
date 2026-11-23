import { type FormEvent, useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { Field, inputClass } from '../../../components/ui/Field'
import { Modal } from '../../../components/ui/Modal'
import type { Course } from '../../../features/courses/types'
import { fromDatetimeLocal, toDatetimeLocal } from '../../../features/courses/utils'
import { api, type ApiError, toApiError } from '../../../lib/api'
import type { ApiMessage } from '../../../types'
import type { Coupon } from './types'

interface Props {
  mode: 'create' | 'edit'
  coupon?: Coupon
  courses: Course[]
  coursesLoading: boolean
  coursesError: ApiError | null
  onRetryCourses: () => void
  onClose: () => void
  onSaved: (message: string) => void
}

type FieldErrors = Record<string, string[]>

export function CouponFormModal({
  mode,
  coupon,
  courses,
  coursesLoading,
  coursesError,
  onRetryCourses,
  onClose,
  onSaved,
}: Props) {
  const isEdit = mode === 'edit'
  const [code, setCode] = useState(coupon?.code ?? '')
  const [name, setName] = useState(coupon?.name ?? '')
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>(coupon?.discount_type ?? 'percentage')
  const [discountValue, setDiscountValue] = useState(String(coupon?.discount_value ?? ''))
  const [usageLimit, setUsageLimit] = useState(coupon?.usage_limit === null || coupon?.usage_limit === undefined ? '' : String(coupon.usage_limit))
  const [courseId, setCourseId] = useState(coupon?.course ? String(coupon.course.id) : '')
  const [expiresAt, setExpiresAt] = useState(toDatetimeLocal(coupon?.expires_at))
  const [isActive, setIsActive] = useState(coupon?.is_active ?? true)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [general, setGeneral] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const firstError = (field: string) => errors[field]?.[0]
  const describedBy = (field: string) => (firstError(field) ? `${field}-help` : undefined)
  const maxDiscount = discountType === 'percentage' ? 100 : 100_000_000
  const currentCourseId = coupon?.course ? String(coupon.course.id) : ''
  const currentCourseUnavailable = !!coupon?.course && !courses.some((course) => course.id === coupon.course?.id)

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setGeneral(null)

    const local: FieldErrors = {}
    const normalizedCode = code.trim().toUpperCase()
    const value = Number(discountValue)
    const limit = usageLimit === '' ? null : Number(usageLimit)

    if (!/^[A-Z0-9_-]{3,30}$/.test(normalizedCode)) {
      local.code = ['Kode harus 3–30 karakter dan hanya berisi huruf, angka, "_" atau "-".']
    }
    if (!Number.isInteger(value) || value < 1 || value > maxDiscount) {
      local.discount_value = [`Nilai diskon harus berupa bilangan bulat antara 1 dan ${maxDiscount.toLocaleString('id-ID')}.`]
    }
    if (limit !== null && (!Number.isInteger(limit) || limit < Math.max(1, coupon?.used_count ?? 0))) {
      local.usage_limit = [`Batas penggunaan minimal ${Math.max(1, coupon?.used_count ?? 0)} atau kosongkan bila tanpa batas.`]
    }
    setErrors(local)
    if (Object.keys(local).length > 0) return

    const payload: Record<string, unknown> = {
      code: normalizedCode,
      name: name.trim() || null,
      discount_type: discountType,
      discount_value: value,
      usage_limit: limit,
      expires_at: expiresAt ? fromDatetimeLocal(expiresAt) : null,
      is_active: isActive,
    }

    if (!isEdit || courseId !== currentCourseId) {
      payload.course_id = courseId ? Number(courseId) : null
    }

    setSubmitting(true)
    try {
      const response = isEdit
        ? await api.patch<ApiMessage<Coupon>>(`/coupons/${coupon!.id}`, payload)
        : await api.post<ApiMessage<Coupon>>('/coupons', payload)

      onSaved(response.data.message ?? (isEdit ? 'Kupon berhasil diperbarui.' : 'Kupon berhasil dibuat.'))
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
      title={isEdit ? 'Ubah Kupon' : 'Tambah Kupon'}
      description="Atur kode, potongan, batas penggunaan, dan masa berlaku."
      onClose={onClose}
      dismissible={!submitting}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Batal
          </Button>
          <Button type="submit" form="coupon-form" loading={submitting}>
            {isEdit ? 'Simpan Perubahan' : 'Buat Kupon'}
          </Button>
        </>
      }
    >
      <form id="coupon-form" onSubmit={onSubmit} noValidate className="space-y-4">
        {general && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {general}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="coupon-code" label="Kode kupon" error={firstError('code')} hint='3–30 karakter: huruf, angka, "_" atau "-".'>
            <input
              id="coupon-code"
              data-autofocus
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              maxLength={30}
              autoComplete="off"
              disabled={!!coupon && coupon.used_count > 0}
              aria-invalid={!!firstError('code')}
              aria-describedby={describedBy('code') ?? 'coupon-code-help'}
              className={inputClass(!!firstError('code'))}
            />
          </Field>
          <Field id="coupon-name" label="Nama kupon (opsional)" error={firstError('name')}>
            <input
              id="coupon-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              aria-invalid={!!firstError('name')}
              aria-describedby={describedBy('name')}
              className={inputClass(!!firstError('name'))}
            />
          </Field>
          {coupon?.used_count ? <p className="sm:col-span-2 -mt-2 text-xs text-slate-500">Kode tidak dapat diubah karena kupon sudah pernah digunakan.</p> : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="coupon-discount-type" label="Jenis diskon" error={firstError('discount_type')}>
            <select
              id="coupon-discount-type"
              value={discountType}
              onChange={(event) => {
                setDiscountType(event.target.value as 'percentage' | 'fixed')
                setErrors((current) => ({ ...current, discount_value: [] }))
              }}
              aria-invalid={!!firstError('discount_type')}
              className={inputClass(!!firstError('discount_type'))}
            >
              <option value="percentage">Persentase (%)</option>
              <option value="fixed">Nominal tetap (Rp)</option>
            </select>
          </Field>
          <Field
            id="coupon-discount-value"
            label={discountType === 'percentage' ? 'Nilai diskon (%)' : 'Nilai diskon (Rp)'}
            error={firstError('discount_value')}
            hint={discountType === 'percentage' ? 'Maksimal 100%.' : 'Maksimal Rp 100.000.000.'}
          >
            <input
              id="coupon-discount-value"
              type="number"
              min={1}
              max={maxDiscount}
              step={1}
              value={discountValue}
              onChange={(event) => setDiscountValue(event.target.value)}
              aria-invalid={!!firstError('discount_value')}
              aria-describedby={describedBy('discount_value') ?? 'coupon-discount-value-help'}
              className={inputClass(!!firstError('discount_value'))}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="coupon-usage-limit" label="Batas penggunaan" error={firstError('usage_limit')} hint="Kosongkan bila tidak dibatasi.">
            <input
              id="coupon-usage-limit"
              type="number"
              min={Math.max(1, coupon?.used_count ?? 0)}
              step={1}
              value={usageLimit}
              onChange={(event) => setUsageLimit(event.target.value)}
              aria-invalid={!!firstError('usage_limit')}
              aria-describedby={describedBy('usage_limit') ?? 'coupon-usage-limit-help'}
              className={inputClass(!!firstError('usage_limit'))}
            />
          </Field>
          <Field id="coupon-course" label="Kursus (opsional)" error={firstError('course_id')} hint="Kosongkan agar berlaku untuk semua kursus.">
            <select
              id="coupon-course"
              value={courseId}
              onChange={(event) => setCourseId(event.target.value)}
              disabled={coursesLoading}
              aria-invalid={!!firstError('course_id')}
              aria-describedby={describedBy('course_id') ?? 'coupon-course-help'}
              className={inputClass(!!firstError('course_id'))}
            >
              <option value="">{coursesLoading ? 'Memuat kursus…' : 'Semua kursus'}</option>
              {currentCourseUnavailable && coupon?.course && <option value={coupon.course.id}>{coupon.course.title} (tidak tersedia)</option>}
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
            {coursesError && (
              <div className="mt-2 flex items-center justify-between gap-2 text-xs text-red-600">
                <span>Daftar kursus gagal dimuat. Kupon tetap dapat dibuat tanpa batasan kursus.</span>
                <button type="button" onClick={onRetryCourses} className="font-semibold underline">
                  Coba lagi
                </button>
              </div>
            )}
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
          <Field id="coupon-expires-at" label="Tanggal kedaluwarsa (opsional)" error={firstError('expires_at')} hint="Zona waktu mengikuti perangkat Anda.">
            <input
              id="coupon-expires-at"
              type="datetime-local"
              min={!isEdit ? toDatetimeLocal(new Date().toISOString()) : undefined}
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
              aria-invalid={!!firstError('expires_at')}
              aria-describedby={describedBy('expires_at')}
              className={inputClass(!!firstError('expires_at'))}
            />
          </Field>
          <label className="flex items-center gap-2 pb-2 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
            Kupon diaktifkan
          </label>
        </div>
      </form>
    </Modal>
  )
}
