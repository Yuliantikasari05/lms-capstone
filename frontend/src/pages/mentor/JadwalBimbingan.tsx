import { Ban, CalendarDays, Clock3, ExternalLink, MapPin, Pencil, Plus, Search, Trash2, Users, Video } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { Field, inputClass } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { EmptyState, ErrorState, Spinner } from '../../components/ui/States'
import { toApiError } from '../../lib/api'
import { useApiData } from '../../lib/useApiData'
import { courseAudience } from './courseData'
import { SessionScheduleFields } from './SessionScheduleFields'
import {
  cancelMentorSession,
  createMentorSession,
  deleteMentorSession,
  fetchMentorSessions,
  fetchScheduleCourses,
  updateMentorSession,
} from './scheduleApi'
import {
  SESSION_TYPES,
  sessionTypeForCourseType,
  type MentorSession,
  type SessionScheduleDetails,
  type SessionStatus,
} from './sessionData'

const PAGE_SIZE = 5
type SessionFilter = 'Semua' | SessionScheduleDetails['type']

const STATUS_STYLES: Record<SessionStatus, string> = {
  'Sedang berlangsung': 'bg-blue-50 text-blue-700',
  Terjadwal: 'bg-emerald-50 text-emerald-700',
  Draft: 'bg-slate-100 text-slate-600',
  Dibatalkan: 'bg-rose-50 text-rose-700',
}

function emptyDetails(type: SessionScheduleDetails['type']): SessionScheduleDetails {
  return {
    date: '',
    startTime: '13:00',
    endTime: '14:00',
    type,
    mode: 'Online',
    location: '',
    meetingLink: '',
  }
}

function formatSessionDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
  })
}

function formatSessionDay(value: string) {
  const date = new Date(`${value}T00:00:00`)
  return {
    day: date.toLocaleDateString('id-ID', { day: '2-digit' }),
    month: date.toLocaleDateString('id-ID', { month: 'short' }).toUpperCase(),
  }
}

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value)
}

export default function MentorJadwalBimbingan() {
  const sessionsState = useApiData(fetchMentorSessions, [])
  const coursesState = useApiData(fetchScheduleCourses, [])
  const sessions = useMemo(() => sessionsState.data ?? [], [sessionsState.data])
  const courses = useMemo(() => coursesState.data ?? [], [coursesState.data])
  const sessionCourses = useMemo(
    () => courses.filter((course) => sessionTypeForCourseType(course.type) !== null),
    [courses],
  )
  const courseById = useMemo(() => new Map(courses.map((course) => [course.id, course])), [courses])
  const [pageError, setPageError] = useState('')
  const [typeFilter, setTypeFilter] = useState<SessionFilter>('Semua')
  const [statusFilter, setStatusFilter] = useState<'Semua status' | SessionStatus>('Semua status')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editingSession, setEditingSession] = useState<MentorSession | null>(null)
  const [cancellingSession, setCancellingSession] = useState<MentorSession | null>(null)
  const [cancellationReason, setCancellationReason] = useState('')
  const [cancellationError, setCancellationError] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [courseId, setCourseId] = useState('')
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState<SessionScheduleDetails>(emptyDetails('Kelas reguler'))
  const [error, setError] = useState('')

  const filteredSessions = useMemo(() => sessions.filter((session) => {
    const course = courseById.get(session.courseId)
    if (!course || sessionTypeForCourseType(course.type) === null) return false
    const matchesType = typeFilter === 'Semua' || session.type === typeFilter
    const matchesStatus = statusFilter === 'Semua status' || session.status === statusFilter
    const matchesSearch = `${session.title} ${course?.title ?? ''}`.toLocaleLowerCase('id-ID').includes(search.trim().toLocaleLowerCase('id-ID'))
    return matchesType && matchesStatus && matchesSearch
  }), [courseById, sessions, typeFilter, statusFilter, search])

  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / PAGE_SIZE))
  const visibleSessions = filteredSessions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function openCreateDialog() {
    const firstCourse = sessionCourses.find((course) => String(course.id) === courseId) ?? sessionCourses[0]
    setEditingSession(null)
    setCourseId(String(firstCourse?.id ?? ''))
    setTitle('')
    setDetails(emptyDetails(firstCourse ? sessionTypeForCourseType(firstCourse.type) ?? 'Kelas reguler' : 'Kelas reguler'))
    setError('')
    setDialogOpen(true)
  }

  function openEditDialog(session: MentorSession) {
    setEditingSession(session)
    setCourseId(String(session.courseId))
    setTitle(session.title)
    setDetails({
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
      type: session.type,
      mode: session.mode,
      location: session.location,
      meetingLink: session.meetingLink,
    })
    setError('')
    setDialogOpen(true)
  }

  function changeCourse(nextCourseId: string) {
    setCourseId(nextCourseId)
    const course = courseById.get(Number(nextCourseId))
    const type = course ? sessionTypeForCourseType(course.type) : null
    if (type) setDetails((current) => ({ ...current, type }))
  }

  async function saveSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const selectedCourse = courseById.get(Number(courseId))
    if (!selectedCourse || sessionTypeForCourseType(selectedCourse.type) === null) {
      setError('Pilih kelas atau kurikulum terlebih dahulu.')
      return
    }
    if (details.endTime <= details.startTime) {
      setError('Waktu selesai harus setelah waktu mulai.')
      return
    }
    if (details.mode === 'Online' && details.meetingLink && !/^https?:\/\//i.test(details.meetingLink)) {
      setError('Meeting link harus diawali http:// atau https://.')
      return
    }

    const submitter = (event.nativeEvent as SubmitEvent).submitter
    const status: SessionStatus = submitter instanceof HTMLButtonElement && submitter.value === 'Draft' ? 'Draft' : 'Terjadwal'

    try {
      if (editingSession) {
        await updateMentorSession({ id: editingSession.id, courseId: selectedCourse.id, title: title.trim(), details, status })
      } else {
        await createMentorSession({ courseId: selectedCourse.id, title: title.trim(), details, status })
      }
      setDialogOpen(false)
      setPageError('')
      sessionsState.reload()
    } catch (saveError) {
      setError(toApiError(saveError).message)
    }
  }

  function openCancellationDialog(session: MentorSession) {
    setCancellingSession(session)
    setCancellationReason('')
    setCancellationError('')
  }

  async function cancelSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const reason = cancellationReason.trim()
    if (!cancellingSession || !reason) {
      setCancellationError('Tuliskan alasan pembatalan sesi.')
      return
    }

    try {
      await cancelMentorSession(cancellingSession.id, reason)
      setCancellingSession(null)
      setCancellationReason('')
      setCancellationError('')
      setPageError('')
      sessionsState.reload()
    } catch (cancelError) {
      setCancellationError(toApiError(cancelError).message)
    }
  }

  async function removeSession(session: MentorSession) {
    try {
      await deleteMentorSession(session.id)
      setPageError('')
      sessionsState.reload()
    } catch (deleteError) {
      setPageError(toApiError(deleteError).message)
    }
  }

  function handleTypeFilter(value: SessionFilter) {
    setTypeFilter(value)
    setPage(1)
  }

  function handleSearch(value: string) {
    setSearch(value)
    setPage(1)
  }

  return (
    <div className="space-y-5">
      {pageError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{pageError}</p>}
      {sessionsState.loading && !sessionsState.data && <Spinner label="Memuat jadwal bimbingan…" />}
      {sessionsState.error && <ErrorState error={sessionsState.error} onRetry={sessionsState.reload} />}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <header className="flex flex-wrap items-center justify-between gap-3 p-4 sm:px-5">
          <div>
            <h1 className="text-base font-semibold text-slate-900">Jadwal bimbingan</h1>
            <p className="mt-1 text-xs text-slate-500">Atur sesi untuk kelas reguler, pelatihan, dan webinar.</p>
          </div>
          <button type="button" onClick={openCreateDialog} className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-[10px] font-semibold text-brand-700 hover:bg-brand-100">
            <Plus className="h-3.5 w-3.5" aria-hidden />Tambah sesi
          </button>
        </header>

        <div className="flex flex-col gap-3 px-4 pb-4 sm:px-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid gap-2 sm:grid-cols-2">
            <label>
              <span className="sr-only">Filter tipe kelas</span>
              <select value={typeFilter} onChange={(event) => handleTypeFilter(event.target.value as SessionFilter)} className={`${inputClass()} min-w-40`}>
                <option value="Semua">Semua tipe kelas</option>
                {SESSION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <label>
              <span className="sr-only">Filter status sesi</span>
              <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as typeof statusFilter); setPage(1) }} className={`${inputClass()} min-w-40`}>
                <option>Semua status</option>
                {(['Sedang berlangsung', 'Terjadwal', 'Draft', 'Dibatalkan'] as const).map((status) => <option key={status}>{status}</option>)}
              </select>
            </label>
          </div>
          <label className="relative block xl:w-72">
            <span className="sr-only">Cari nama sesi</span>
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
            <input type="search" value={search} onChange={(event) => handleSearch(event.target.value)} placeholder="Cari nama sesi" className={`${inputClass()} pl-9`} />
          </label>
        </div>

        <nav aria-label="Filter jadwal" className="flex gap-5 overflow-x-auto border-b border-slate-100 px-4 sm:px-5">
          {(['Semua', ...SESSION_TYPES] as SessionFilter[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => handleTypeFilter(type)}
              aria-current={typeFilter === type ? 'page' : undefined}
              className={`whitespace-nowrap border-b-2 px-1 py-3 text-xs font-medium ${typeFilter === type ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              {type}
            </button>
          ))}
        </nav>

        {visibleSessions.length === 0 ? (
          <div className="p-5">
            <EmptyState title="Jadwal tidak ditemukan" description="Coba ubah filter, atau tambahkan sesi bimbingan baru." />
          </div>
        ) : (
          <div className="grid gap-5 p-4 sm:grid-cols-2 sm:px-5 xl:grid-cols-3">
            {visibleSessions.map((session) => {
              const course = courseById.get(session.courseId)
              const date = formatSessionDay(session.date)
              const joinUrlIsValid = session.mode === 'Online' && isHttpUrl(session.meetingLink)
              const canJoin = joinUrlIsValid && ['Sedang berlangsung', 'Terjadwal'].includes(session.status)
              return (
                <article key={session.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white transition-shadow hover:shadow-md">
                  <div className="relative mx-4 mt-4 flex min-h-32 items-start justify-between bg-gradient-to-br from-blue-600 to-blue-900 p-3">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-md bg-white/70 px-3 py-1 text-[10px] font-medium text-slate-800">{session.type}</span>
                      <span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold ${STATUS_STYLES[session.status]}`}>{session.status}</span>
                    </div>
                    <div className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/40 text-white">
                      {session.mode === 'Online' ? <Video className="h-5 w-5" aria-hidden /> : <MapPin className="h-5 w-5" aria-hidden />}
                    </div>
                    <div className="absolute bottom-3 left-3 text-white">
                      <span className="block text-[10px] font-medium uppercase">{date.month}</span>
                      <span className="block text-2xl font-bold leading-6">{date.day}</span>
                    </div>
                  </div>

                  <div className="p-4">
                    <h2 className="line-clamp-2 min-h-10 text-sm font-semibold text-blue-700">{session.title}</h2>
                    <p className="mt-1 min-h-8 line-clamp-2 text-xs text-slate-500">{course?.title ?? 'Kelas tidak tersedia'} · {session.mentorName}</p>

                    <div className="mt-3 space-y-2 border-y border-slate-100 py-3 text-[11px] text-slate-500">
                      <span className="flex items-center gap-2"><Clock3 className="h-4 w-4 shrink-0" aria-hidden />{formatSessionDate(session.date)} · {session.startTime}–{session.endTime}</span>
                      <span className="flex items-center gap-2"><Users className="h-4 w-4 shrink-0" aria-hidden />{session.participants} {course ? courseAudience(course.type) : 'peserta'}</span>
                      {session.mode === 'Offline' ? (
                        <span className="flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0" aria-hidden />{session.location || 'Lokasi belum ditambahkan'}</span>
                      ) : (
                        <span className="flex items-center gap-2"><Video className="h-4 w-4 shrink-0" aria-hidden />{joinUrlIsValid ? 'Online · tautan sesi tersedia' : 'Tautan sesi belum ditambahkan'}</span>
                      )}
                    </div>

                    {session.status === 'Dibatalkan' && session.cancellationReason && (
                      <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-[10px] text-rose-700">
                        <span className="font-semibold">Alasan pembatalan: </span>{session.cancellationReason}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      {canJoin ? (
                        <a href={session.meetingLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700">
                          Gabung sesi <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        </a>
                      ) : (
                        <span className="text-[10px] text-slate-400">
                          {session.mode === 'Offline' ? 'Sesi tatap muka' : session.status === 'Draft' || session.status === 'Dibatalkan' ? 'Sesi tidak aktif' : 'Tautan belum tersedia'}
                        </span>
                      )}
                      <div className="flex items-center gap-1">
                        {session.status !== 'Dibatalkan' && (
                          <button type="button" onClick={() => openCancellationDialog(session)} aria-label={`Batalkan sesi ${session.title}`} title="Batalkan sesi" className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                            <Ban className="h-4 w-4" aria-hidden />
                          </button>
                        )}
                        <button type="button" onClick={() => openEditDialog(session)} aria-label={`Edit sesi ${session.title}`} title="Edit sesi" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                          <Pencil className="h-4 w-4" aria-hidden />
                        </button>
                        <button type="button" onClick={() => void removeSession(session)} aria-label={`Hapus sesi ${session.title}`} title="Hapus sesi" className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-[10px] text-slate-500 sm:px-5">
          <span>Menampilkan {filteredSessions.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredSessions.length)} dari {filteredSessions.length} sesi bimbingan</span>
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Halaman sebelumnya" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40">‹</button>
            <span className="px-2">{page} / {totalPages}</span>
            <button type="button" aria-label="Halaman berikutnya" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages} className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40">›</button>
          </div>
        </footer>
      </section>

      <Modal
        open={dialogOpen}
        title={editingSession ? 'Edit sesi bimbingan' : 'Tambah sesi bimbingan'}
        description="Lengkapi detail sesi. Anda dapat menyimpannya sebagai draft terlebih dahulu."
        onClose={() => setDialogOpen(false)}
        size="lg"
        footer={(
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>Batal</Button>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="submit" form="mentor-session-form" name="saveStatus" value="Draft" variant="secondary">
                Simpan draft
              </Button>
              <Button type="submit" form="mentor-session-form" name="saveStatus" value="Terjadwal" icon={<CalendarDays className="h-4 w-4" aria-hidden />}>
                Simpan & publikasikan
              </Button>
            </div>
          </div>
        )}
      >
        <form id="mentor-session-form" onSubmit={saveSession} className="space-y-4">
          <Field id="mentor-session-course" label="Kelas / Kurikulum">
            <select id="mentor-session-course" value={courseId} onChange={(event) => changeCourse(event.target.value)} className={inputClass()} required data-autofocus>
              <option value="">Pilih kelas atau kurikulum</option>
              {sessionCourses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
            </select>
          </Field>
          <Field id="mentor-session-title" label="Judul sesi">
            <input id="mentor-session-title" value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass()} placeholder="Contoh: Weekly Q&A Laravel & React" maxLength={120} required />
          </Field>
          <SessionScheduleFields value={details} onChange={setDetails} />
          {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
        </form>
      </Modal>

      <Modal
        open={cancellingSession !== null}
        title="Batalkan sesi bimbingan"
        description="Berikan alasan pembatalan agar informasi ini bisa disampaikan kepada peserta."
        onClose={() => setCancellingSession(null)}
        size="md"
      >
        <form id="mentor-cancel-session-form" onSubmit={cancelSession} className="space-y-4">
          <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{cancellingSession?.title}</p>
          <Field id="mentor-cancellation-reason" label="Alasan pembatalan">
            <textarea
              id="mentor-cancellation-reason"
              value={cancellationReason}
              onChange={(event) => setCancellationReason(event.target.value)}
              className={`${inputClass()} min-h-28 resize-y`}
              placeholder="Contoh: Mentor berhalangan hadir karena..."
              maxLength={500}
              required
              data-autofocus
            />
          </Field>
          {cancellationError && <p role="alert" className="text-xs text-rose-700">{cancellationError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCancellingSession(null)}>Kembali</Button>
            <Button type="submit" form="mentor-cancel-session-form" variant="danger">Konfirmasi pembatalan</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
