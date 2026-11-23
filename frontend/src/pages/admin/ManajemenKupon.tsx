import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { type FormEvent, type ReactNode, useEffect, useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, StatCard } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { inputClass } from '../../components/ui/Field'
import { Notice } from '../../components/ui/Notice'
import { PageHeader } from '../../components/ui/PageHeader'
import { EmptyState, ErrorState, Spinner } from '../../components/ui/States'
import type { Course } from '../../features/courses/types'
import { api, toApiError } from '../../lib/api'
import { formatDateTime } from '../../lib/format'
import { useApiData } from '../../lib/useApiData'
import type { Paginated } from '../../types'
import { CouponFormModal } from './coupons/CouponFormModal'
import type { Coupon, CouponListResponse } from './coupons/types'

const PER_PAGE = 15

type Dialog = { type: 'create' } | { type: 'edit'; coupon: Coupon } | { type: 'delete'; coupon: Coupon } | null

const STATUS_OPTIONS = [
  { value: 'active', label: 'Aktif' },
  { value: 'inactive', label: 'Nonaktif' },
  { value: 'expired', label: 'Kedaluwarsa' },
  { value: 'exhausted', label: 'Kuota habis' },
] as const

const STATUS_TONE = {
  active: 'success',
  inactive: 'neutral',
  expired: 'warning',
  exhausted: 'danger',
} as const

function IconButton({
  label,
  onClick,
  disabled = false,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  )
}

export default function AdminManajemenKupon() {
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [courseId, setCourseId] = useState('')
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [busy, setBusy] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  const list = useApiData(
    async () =>
      (
        await api.get<CouponListResponse>('/coupons', {
          params: {
            q: query || undefined,
            status: status || undefined,
            course_id: courseId ? Number(courseId) : undefined,
            page,
            per_page: PER_PAGE,
          },
        })
      ).data,
    [query, status, courseId, page],
  )
  const courses = useApiData(
    async () => (await api.get<Paginated<Course>>('/courses', { params: { per_page: 100 } })).data,
    [],
  )

  const filtering = !!query || !!status || !!courseId

  useEffect(() => {
    if (notice?.tone !== 'success') return
    const timer = window.setTimeout(() => setNotice(null), 6000)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    if (list.data && list.data.data.length === 0 && page > 1) setPage(Math.max(1, list.data.meta.last_page))
  }, [list.data, page])

  const onSearch = (event: FormEvent) => {
    event.preventDefault()
    setPage(1)
    setQuery(input.trim())
  }

  const resetFilters = () => {
    setInput('')
    setQuery('')
    setStatus('')
    setCourseId('')
    setPage(1)
  }

  const closeDialog = () => {
    setDialog(null)
    setDialogError(null)
  }

  const remove = async (coupon: Coupon) => {
    setBusy(true)
    setDialogError(null)
    try {
      const response = await api.delete<{ message?: string }>(`/coupons/${coupon.id}`)
      closeDialog()
      setNotice({ tone: 'success', text: response.data.message ?? 'Kupon berhasil dihapus.' })
      list.reload()
    } catch (error) {
      setDialogError(toApiError(error).message)
    } finally {
      setBusy(false)
    }
  }

  const coupons = list.data?.data ?? []

  return (
    <>
      <PageHeader
        title="Manajemen Kupon"
        description="Buat dan kelola kupon diskon untuk kursus."
        action={
          <Button onClick={() => setDialog({ type: 'create' })} icon={<Plus className="h-4 w-4" aria-hidden />}>
            Tambah Kupon
          </Button>
        }
      />

      {notice && (
        <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.text}
        </Notice>
      )}

      {list.data && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <StatCard label="Total kupon" value={list.data.summary.total} />
          <StatCard label="Kupon aktif" value={list.data.summary.active} />
          <StatCard label="Total penggunaan" value={list.data.summary.total_redemptions} />
        </div>
      )}

      <Card>
        <form onSubmit={onSearch} role="search" className="mb-4 flex flex-wrap gap-2">
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
            <input
              type="search"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Cari kode atau nama kupon"
              aria-label="Cari kupon"
              maxLength={100}
              className={`${inputClass()} pl-9`}
            />
          </div>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value)
              setPage(1)
            }}
            aria-label="Filter status"
            className={`${inputClass()} !w-auto`}
          >
            <option value="">Semua status</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={courseId}
            onChange={(event) => {
              setCourseId(event.target.value)
              setPage(1)
            }}
            aria-label="Filter kursus"
            className={`${inputClass()} !w-auto`}
            disabled={courses.loading && !courses.data}
          >
            <option value="">{courses.loading && !courses.data ? 'Memuat kursus…' : 'Semua kursus'}</option>
            {(courses.data?.data ?? []).map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
          <Button type="submit" variant="secondary">
            Cari
          </Button>
          {filtering && (
            <Button variant="ghost" onClick={resetFilters}>
              Reset
            </Button>
          )}
        </form>

        {courses.error && <ErrorState error={courses.error} onRetry={courses.reload} />}
        {list.loading && !list.data && <Spinner label="Memuat kupon…" />}
        {list.error && <ErrorState error={list.error} onRetry={list.reload} />}

        {list.data && coupons.length === 0 && (
          <EmptyState
            title={filtering ? 'Kupon tidak ditemukan' : 'Belum ada kupon'}
            description={filtering ? 'Coba ubah atau reset filter.' : 'Tambahkan kupon pertama untuk mulai mengelola promosi.'}
          >
            {!filtering && (
              <Button className="mt-4" onClick={() => setDialog({ type: 'create' })} icon={<Plus className="h-4 w-4" aria-hidden />}>
                Tambah Kupon
              </Button>
            )}
          </EmptyState>
        )}

        {list.data && coupons.length > 0 && (
          <>
            <div className={`overflow-x-auto transition-opacity ${list.loading ? 'opacity-60' : ''}`}>
              <table className="w-full min-w-[56rem] text-left text-sm">
                <thead className="text-xs text-slate-500">
                  <tr>
                    <th className="pb-2 font-medium">Kupon</th>
                    <th className="pb-2 font-medium">Diskon</th>
                    <th className="pb-2 font-medium">Penggunaan</th>
                    <th className="pb-2 font-medium">Kursus</th>
                    <th className="pb-2 font-medium">Kedaluwarsa</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 text-right font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {coupons.map((coupon) => (
                    <tr key={coupon.id}>
                      <td className="py-3">
                        <p className="font-semibold tracking-wide text-ink-900">{coupon.code}</p>
                        <p className="text-xs text-slate-500">{coupon.name || 'Tanpa nama'}</p>
                      </td>
                      <td className="py-3">
                        <p className="font-medium text-slate-800">{coupon.discount_label}</p>
                        <p className="text-xs text-slate-500">{coupon.discount_type_label}</p>
                      </td>
                      <td className="py-3 text-slate-700">{coupon.usage_label}</td>
                      <td className="py-3 text-slate-700">{coupon.course?.title ?? 'Semua kursus'}</td>
                      <td className="py-3 text-slate-600">{formatDateTime(coupon.expires_at)}</td>
                      <td className="py-3">
                        <Badge tone={STATUS_TONE[coupon.status]}>{coupon.status_label}</Badge>
                      </td>
                      <td className="py-3">
                        <div className="flex justify-end gap-0.5">
                          {coupon.abilities?.update && (
                            <IconButton label={`Ubah kupon ${coupon.code}`} onClick={() => setDialog({ type: 'edit', coupon })}>
                              <Pencil className="h-4 w-4" aria-hidden />
                            </IconButton>
                          )}
                          {coupon.abilities?.delete && (
                            <IconButton
                              label={coupon.used_count > 0 ? 'Kupon yang pernah digunakan tidak dapat dihapus' : `Hapus kupon ${coupon.code}`}
                              disabled={coupon.used_count > 0}
                              onClick={() => {
                                setDialogError(null)
                                setDialog({ type: 'delete', coupon })
                              }}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden />
                            </IconButton>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
              <span>
                Halaman {list.data.meta.current_page} dari {list.data.meta.last_page} · {list.data.meta.total} kupon
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                  Sebelumnya
                </Button>
                <Button variant="secondary" disabled={page >= list.data.meta.last_page} onClick={() => setPage((current) => current + 1)}>
                  Berikutnya
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {(dialog?.type === 'create' || dialog?.type === 'edit') && (
        <CouponFormModal
          mode={dialog.type}
          coupon={dialog.type === 'edit' ? dialog.coupon : undefined}
          courses={courses.data?.data ?? []}
          coursesLoading={courses.loading && !courses.data}
          coursesError={courses.error}
          onRetryCourses={courses.reload}
          onClose={closeDialog}
          onSaved={(message) => {
            closeDialog()
            setNotice({ tone: 'success', text: message })
            list.reload()
          }}
        />
      )}

      <ConfirmDialog
        open={dialog?.type === 'delete'}
        title="Hapus kupon?"
        tone="danger"
        confirmLabel="Hapus"
        loading={busy}
        error={dialogError}
        onCancel={closeDialog}
        onConfirm={() => {
          if (dialog?.type === 'delete') void remove(dialog.coupon)
        }}
        message={
          dialog?.type === 'delete' && (
            <>
              Kupon <strong>{dialog.coupon.code}</strong> akan dihapus. Kupon yang pernah digunakan tidak dapat dihapus; nonaktifkan kupon tersebut sebagai gantinya.
            </>
          )
        }
      />

    </>
  )
}
