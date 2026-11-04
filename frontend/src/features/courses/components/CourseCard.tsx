import { Award, Eye, Pencil, Plus, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import type { Course } from '../types'
import { COURSE_STATUS_TONE, TYPE_BAND, participantLabel } from '../utils'

interface Props {
  course: Course
  /** Dasar URL detail, mis. "/admin/courses". */
  basePath: string
  onEdit: (course: Course) => void
  onDelete: (course: Course) => void
}

/** Kartu kursus sesuai hi-fi: pita warna per jenis, status, Mentor, ringkasan jumlah, dan aksi cepat. */
export function CourseCard({ course, basePath, onEdit, onDelete }: Props) {
  const canUpdate = !!course.abilities?.update
  const canDelete = !!course.abilities?.delete
  const hasParticipants = (course.participants_count ?? 0) > 0
  const readOnly = !canUpdate && !canDelete

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" data-testid="course-card">
      <div className={`h-20 bg-gradient-to-br ${TYPE_BAND[course.type]} p-3`}>
        <Badge tone={COURSE_STATUS_TONE[course.status]}>{course.status_label}</Badge>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div>
          <Link to={`${basePath}/${course.id}`} className="line-clamp-2 font-semibold text-ink-900 hover:underline">
            {course.title}
          </Link>
          <p className="mt-0.5 text-xs text-slate-500">
            {course.type_label}
            {readOnly && ' · hanya-baca'}
          </p>
        </div>

        <p className="text-sm text-slate-700">
          <span className="text-slate-500">Mentor:</span> {course.mentor ? course.mentor.name : <span className="text-slate-400">Belum ada Mentor</span>}
        </p>

        <p className="text-xs text-slate-600">
          <strong>{course.participants_count ?? 0}</strong> {participantLabel(course.type)} · <strong>{course.modules_count ?? 0}</strong> Modul · <strong>{course.sessions_count ?? 0}</strong> Sesi
        </p>

        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2">
          <Link to={`${basePath}/${course.id}?preview=1`} className="inline-flex items-center gap-1 rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100">
            <Eye className="h-3.5 w-3.5" aria-hidden /> Preview
          </Link>
          <button type="button" disabled title="Tersedia di tahap sertifikat" className="inline-flex cursor-not-allowed items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 opacity-50">
            <Award className="h-3.5 w-3.5" aria-hidden /> Atur Sertifikat
          </button>
          {course.abilities?.manage_content && (
            <Link to={`${basePath}/${course.id}?tab=modules`} className="inline-flex items-center gap-1 rounded-lg bg-ink-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-ink-800">
              <Plus className="h-3.5 w-3.5" aria-hidden /> Modul
            </Link>
          )}
          <span className="ml-auto flex items-center">
            {canDelete && (
              <button
                type="button"
                onClick={() => onDelete(course)}
                disabled={hasParticipants}
                aria-label={hasParticipants ? `Kursus ${course.title} masih punya peserta aktif` : `Hapus kursus ${course.title}`}
                title={hasParticipants ? 'Masih punya peserta aktif. Nonaktifkan kursus sebagai gantinya.' : `Hapus kursus ${course.title}`}
                className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            )}
            {canUpdate && (
              <button type="button" onClick={() => onEdit(course)} aria-label={`Ubah kursus ${course.title}`} title={`Ubah kursus ${course.title}`} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100">
                <Pencil className="h-4 w-4" aria-hidden />
              </button>
            )}
          </span>
        </div>
      </div>
    </article>
  )
}
