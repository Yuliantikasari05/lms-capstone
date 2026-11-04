import { Plus, Search } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../../components/ui/Button'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { inputClass } from '../../../components/ui/Field'
import { Notice } from '../../../components/ui/Notice'
import { PageHeader } from '../../../components/ui/PageHeader'
import { EmptyState, ErrorState, Spinner } from '../../../components/ui/States'
import { CourseCard } from '../../../features/courses/components/CourseCard'
import { CourseFormModal } from '../../../features/courses/components/CourseFormModal'
import type { Course } from '../../../features/courses/types'
import { STATUS_OPTIONS, TYPE_FILTER_OPTIONS } from '../../../features/courses/utils'
import { api, toApiError } from '../../../lib/api'
import { useApiData } from '../../../lib/useApiData'
import type { Paginated } from '../../../types'

export const COURSES_PATH = '/admin/courses'
const PER_PAGE = 12

type Dialog = { type: 'create' } | { type: 'edit'; course: Course } | { type: 'delete'; course: Course } | null

/** Manajemen Kursus: daftar kartu (hi-fi 3.14), cari, filter jenis/status, tambah, ubah, hapus. */
export default function CoursesListPage() {
  const navigate = useNavigate()
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)

  const [dialog, setDialog] = useState<Dialog>(null)
  const [busy, setBusy] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  const list = useApiData<Paginated<Course>>(
    async () =>
      (await api.get<Paginated<Course>>('/courses', { params: { q: query || undefined, type: type || undefined, status: status || undefined, page, per_page: PER_PAGE } })).data,
    [query, type, status, page],
  )
  const courses = list.data?.data ?? []
  const filtering = !!query || !!type || !!status

  useEffect(() => {
    if (notice?.tone !== 'success') return
    const timer = window.setTimeout(() => setNotice(null), 6000)
    return () => window.clearTimeout(timer)
  }, [notice])

  // Setelah menghapus kartu terakhir di halaman terakhir, mundur ke halaman yang masih ada.
  useEffect(() => {
    if (list.data && list.data.data.length === 0 && page > 1) setPage(Math.max(1, list.data.meta.last_page))
  }, [list.data, page])

  const onSearch = (event: FormEvent) => {
    event.preventDefault()
    setPage(1)
    setQuery(input.trim())
  }

  const reset = () => {
    setInput('')
    setQuery('')
    setType('')
    setStatus('')
    setPage(1)
  }

  const closeDialog = () => {
    setDialog(null)
    setDialogError(null)
  }

  const remove = async (course: Course) => {
    setBusy(true)
    setDialogError(null)
    try {
      const res = await api.delete<{ message?: string }>(`/courses/${course.id}`)
      closeDialog()
      setNotice({ tone: 'success', text: res.data.message ?? 'Kursus berhasil dihapus.' })
      list.reload()
    } catch (error) {
      setDialogError(toApiError(error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Manajemen Kursus"
        description={list.data ? `${list.data.meta.total} kursus terdaftar di sistem` : 'Kelola kursus, modul, sesi, dan peserta.'}
        action={
          <Button onClick={() => setDialog({ type: 'create' })} icon={<Plus className="h-4 w-4" aria-hidden />}>
            Tambah Kursus
          </Button>
        }
      />

      {notice && (
        <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.text}
        </Notice>
      )}

      <form onSubmit={onSearch} role="search" className="mb-5 flex flex-wrap gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
          <input type="search" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Cari judul kursus atau nama Mentor" aria-label="Cari kursus" maxLength={100} className={`${inputClass()} pl-9`} />
        </div>
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value)
            setPage(1)
          }}
          aria-label="Filter jenis"
          className={`${inputClass()} !w-auto`}
        >
          <option value="">Semua jenis</option>
          {TYPE_FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
          aria-label="Filter status"
          className={`${inputClass()} !w-auto`}
        >
          <option value="">Status: Semua</option>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary">
          Cari
        </Button>
        {filtering && (
          <Button variant="ghost" onClick={reset}>
            Reset
          </Button>
        )}
      </form>

      {list.loading && !list.data && <Spinner label="Memuat kursus…" />}
      {list.error && <ErrorState error={list.error} onRetry={list.reload} />}
      {list.data && courses.length === 0 && (
        <EmptyState title={filtering ? 'Kursus tidak ditemukan' : 'Belum ada kursus'} description={filtering ? 'Coba ubah atau reset filter pencarian.' : 'Mulai dengan menambahkan kursus pertama.'} />
      )}

      {courses.length > 0 && (
        <>
          <div className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-3 ${list.loading ? 'opacity-60' : ''}`}>
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} basePath={COURSES_PATH} onEdit={(c) => setDialog({ type: 'edit', course: c })} onDelete={(c) => setDialog({ type: 'delete', course: c })} />
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
            <span>
              Halaman {list.data?.meta.current_page} dari {list.data?.meta.last_page} · {list.data?.meta.total} kursus
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Sebelumnya
              </Button>
              <Button variant="secondary" disabled={page >= (list.data?.meta.last_page ?? 1)} onClick={() => setPage((p) => p + 1)}>
                Berikutnya
              </Button>
            </div>
          </div>
        </>
      )}

      {dialog?.type === 'create' && (
        <CourseFormModal
          mode="create"
          onClose={closeDialog}
          onSaved={(_message, course) => {
            closeDialog()
            navigate(`${COURSES_PATH}/${course.id}?tab=modules`) // lanjut mengisi kurikulum
          }}
        />
      )}
      {dialog?.type === 'edit' && (
        <CourseFormModal
          mode="edit"
          course={dialog.course}
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
        title="Hapus kursus?"
        tone="danger"
        confirmLabel="Hapus"
        loading={busy}
        error={dialogError}
        onCancel={closeDialog}
        onConfirm={() => dialog?.type === 'delete' && remove(dialog.course)}
        message={
          dialog?.type === 'delete' && (
            <>
              Kursus <strong>{dialog.course.title}</strong> beserta modul dan sesinya akan dihapus dari daftar. Data tidak dihapus permanen.
            </>
          )
        }
      />
    </>
  )
}
