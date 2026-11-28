import {
  CalendarDays,
  Check,
  Clock3,
  Edit3,
  Plus,
  Trash2,
  Video,
  X,
} from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Field, inputClass } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/States'
import { toApiError } from '../../lib/api'
import { useApiData } from '../../lib/useApiData'
import type { ClassSession } from '../../features/courses/types'
import { CourseDiscussions } from '../../features/discussions/CourseDiscussions'
import { LembagaPageHeader } from './LembagaPageHeader'
import { ResourcesTab } from './ResourcesTab'
import { ModuleDetailHeader, type ModuleDetailTab } from './ModuleDetailHeader'
import type { ManagedModule } from './moduleData'
import {
  createSession,
  deleteSession,
  fetchProgram,
  listModules,
  listSessions,
  updateProgram,
  updateSession,
} from './api'

/** Baris sesi yang ditampilkan; dipetakan dari respons API tanpa mengubah tampilan daftar. */
interface CourseSession {
  id: number
  title: string
  month: string
  day: string
  dateLabel: string
  time: string
  platform: string
  status: 'Mendatang' | 'Selesai'
  source: ClassSession
}

const JAKARTA = 'Asia/Jakarta'
const MONTH_LABELS = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES']
/** Durasi sesi bawaan saat dibuat dari formulir (jam selesai tidak punya kolom sendiri). */
const DEFAULT_DURATION_MINUTES = 120

export default function DetailModulSessions() {
  const navigate = useNavigate()
  const { moduleId } = useParams()
  const courseId = Number(moduleId)
  const validId = Number.isInteger(courseId) && courseId > 0

  // Endpoint kursus, modul, dan sesi memakai aturan CoursePolicy yang sama seperti backend.
  const program = useApiData(() => fetchProgram(courseId), [courseId])
  const modules = useApiData(() => listModules(courseId), [courseId])
  const sessionList = useApiData(() => listSessions(courseId), [courseId])

  const sessions = (sessionList.data ?? []).map(toCourseSession)
  const module: ManagedModule | undefined = program.data
    ? {
        id: courseId,
        title: program.data.title,
        status: program.data.status === 'active' ? 'Aktif' : 'Draft',
        chapters: modules.data?.length ?? program.data.modules_count ?? 0,
        studyHours: Math.round(((program.data.duration_minutes ?? 0) / 60) * 10) / 10,
        sessions: sessions.length,
        students: program.data.participants_count ?? 0,
        expanded: false,
      }
    : undefined

  const [activeTab, setActiveTab] = useState<ModuleDetailTab>('Sessions')
  const [reportOpen, setReportOpen] = useState(false)
  const [sessionDialog, setSessionDialog] = useState<'create' | 'edit' | null>(null)
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CourseSession | null>(null)
  const [sessionTitle, setSessionTitle] = useState('')
  const [sessionDate, setSessionDate] = useState('')
  const [sessionTime, setSessionTime] = useState('')
  const [sessionPlatform, setSessionPlatform] = useState('Zoom Meeting')
  const [sessionLink, setSessionLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  const errorMessage =
    (program.error ?? modules.error ?? sessionList.error)?.message ?? ''

  function openCreateSession() {
    setEditingSessionId(null)
    setSessionTitle('')
    setSessionDate('')
    setSessionTime('19:00')
    setSessionPlatform('Zoom Meeting')
    setSessionLink('')
    setSessionDialog('create')
  }

  function openEditSession(session: ClassSession) {
    const start = jakartaParts(session.starts_at)
    setEditingSessionId(session.id)
    setSessionTitle(session.title)
    setSessionDate(start.date)
    setSessionTime(start.time)
    setSessionPlatform(session.meeting_url?.includes('meet.google') ? 'Google Meet' : 'Zoom Meeting')
    setSessionLink(session.meeting_url ?? '')
    setSessionDialog('edit')
  }

  async function saveSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = sessionTitle.trim()
    if (!title || !sessionDate || !sessionTime) return

    const input = {
      title,
      date: sessionDate,
      startTime: sessionTime,
      endTime: addMinutes(sessionTime, DEFAULT_DURATION_MINUTES),
      meetingUrl: sessionLink.trim() || null,
    }

    setBusy(true)
    try {
      if (sessionDialog === 'edit' && editingSessionId !== null) {
        await updateSession(editingSessionId, input)
        setNotice('Sesi berhasil diperbarui.')
      } else {
        await createSession(courseId, input)
        setNotice('Sesi berhasil ditambahkan dan sudah terlihat oleh siswa.')
      }
      setSessionDialog(null)
      // Jumlah sesi pada header dihitung dari daftar sesi, bukan dari ringkasan program.
      sessionList.reload()
    } catch (error) {
      setNotice(toApiError(error).message)
    } finally {
      setBusy(false)
    }
  }

  async function removeSession() {
    if (!deleteTarget) return

    setBusy(true)
    try {
      await deleteSession(deleteTarget.id)
      setNotice('Sesi berhasil dihapus.')
      setDeleteTarget(null)
      sessionList.reload()
    } catch (error) {
      setNotice(toApiError(error).message)
    } finally {
      setBusy(false)
    }
  }

  async function renameModule(title: string) {
    try {
      await updateProgram(courseId, { title })
      setNotice('Nama program berhasil diperbarui.')
      program.reload()
    } catch (error) {
      setNotice(toApiError(error).message)
    }
  }

  function changeTab(tab: ModuleDetailTab) {
    if (tab === 'Modules') {
      navigate('/lembaga/modules')
      return
    }
    setActiveTab(tab)
  }

  if (!validId || (program.loading && !program.data)) {
    return (
      <div className="space-y-6">
        <LembagaPageHeader onReportClick={() => setReportOpen(true)} />
        {validId ? (
          <Spinner label="Memuat modul…" />
        ) : (
          <p className="rounded-xl border border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500">
            Modul tidak ditemukan.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <LembagaPageHeader onReportClick={() => setReportOpen(true)} />
      <ModuleDetailHeader
        activeTab={activeTab}
        onTabChange={changeTab}
        onAddModule={() => navigate('/lembaga/modules/new')}
        module={module}
        onRename={renameModule}
      />

      {(notice || errorMessage) && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800"
        >
          <span>{notice || errorMessage}</span>
          <button type="button" className="font-semibold hover:underline" onClick={() => setNotice('')}>
            Tutup
          </button>
        </div>
      )}

      <section aria-labelledby="upcoming-sessions-title">
        {activeTab === 'Discussions' ? (
          <CourseDiscussions courseId={courseId} />
        ) : activeTab === 'Resources' ? (
          <ResourcesTab modules={modules.data ?? []} onChanged={modules.reload} />
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="upcoming-sessions-title" className="text-xl font-bold text-slate-900">
                  Jadwal Sesi Mendatang
                </h2>
                <p className="mt-1 text-sm text-slate-500">Atur jadwal belajar dan sesi mentoring modul Anda.</p>
              </div>
              <Button
                onClick={openCreateSession}
                icon={<Plus className="h-4 w-4" aria-hidden />}
                className="px-3 py-2"
              >
                Sesi
              </Button>
            </div>

            {sessionList.loading && !sessionList.data ? (
              <Spinner label="Memuat sesi…" />
            ) : sessions.length ? (
              <ul className="space-y-3">
                {sessions.map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    onEdit={() => openEditSession(session.source)}
                    onDelete={() => setDeleteTarget(session)}
                  />
                ))}
              </ul>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center">
                <CalendarDays className="mx-auto h-8 w-8 text-slate-400" aria-hidden />
                <h3 className="mt-3 font-semibold text-slate-800">Belum ada sesi</h3>
                <p className="mt-1 text-sm text-slate-500">Tambahkan sesi untuk menyusun jadwal pembelajaran.</p>
              </div>
            )}
          </>
        )}
      </section>

      <Modal
        open={sessionDialog !== null}
        title={sessionDialog === 'edit' ? 'Edit Sesi' : 'Tambah Sesi'}
        description="Kelola informasi jadwal sesi pada program ini."
        onClose={() => setSessionDialog(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSessionDialog(null)}>
              Batal
            </Button>
            <Button
              type="submit"
              form="session-form"
              disabled={busy}
              icon={<Check className="h-4 w-4" aria-hidden />}
            >
              Simpan Sesi
            </Button>
          </>
        }
      >
        <form id="session-form" className="space-y-4" onSubmit={saveSession}>
          <Field id="session-title" label="Judul sesi">
            <input
              id="session-title"
              className={inputClass()}
              value={sessionTitle}
              onChange={(event) => setSessionTitle(event.target.value)}
              required
              maxLength={120}
              data-autofocus
            />
          </Field>
          <Field id="session-date" label="Hari dan tanggal">
            <input
              id="session-date"
              type="date"
              className={inputClass()}
              value={sessionDate}
              onChange={(event) => setSessionDate(event.target.value)}
              required
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="session-time" label="Jam" hint="Sesi berdurasi 2 jam.">
              <input
                id="session-time"
                type="time"
                className={inputClass()}
                value={sessionTime}
                onChange={(event) => setSessionTime(event.target.value)}
                required
              />
            </Field>
            <Field id="session-platform" label="Platform meeting">
              <select
                id="session-platform"
                className={inputClass()}
                value={sessionPlatform}
                onChange={(event) => setSessionPlatform(event.target.value)}
              >
                <option>Zoom Meeting</option>
                <option>Google Meet</option>
              </select>
            </Field>
          </div>
          <Field id="session-link" label="Link meeting" hint="Tempel tautan Zoom atau Google Meet untuk sesi ini.">
            <input
              id="session-link"
              type="url"
              className={inputClass()}
              value={sessionLink}
              onChange={(event) => setSessionLink(event.target.value)}
              placeholder={sessionPlatform === 'Google Meet' ? 'https://meet.google.com/...' : 'https://zoom.us/j/...'}
              required
              maxLength={2048}
            />
          </Field>
          <p className="text-xs text-slate-500">Sesi langsung tersimpan pada program dan terlihat oleh siswa.</p>
        </form>
      </Modal>

      <Modal
        open={deleteTarget !== null}
        title="Hapus sesi?"
        description={`Sesi "${deleteTarget?.title ?? ''}" akan dihapus dari program.`}
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Batal
            </Button>
            <Button
              variant="danger"
              onClick={removeSession}
              disabled={busy}
              icon={<Trash2 className="h-4 w-4" aria-hidden />}
            >
              Hapus Sesi
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">Siswa tidak akan melihat sesi ini lagi.</p>
      </Modal>

      <Modal
        open={reportOpen}
        title="Laporan Lembaga"
        description="Ringkasan laporan program lembaga Anda."
        onClose={() => setReportOpen(false)}
        footer={
          <Button variant="secondary" onClick={() => setReportOpen(false)} icon={<X className="h-4 w-4" aria-hidden />}>
            Tutup
          </Button>
        }
      >
        <p className="text-sm leading-6 text-slate-600">
          Laporan pendapatan, enrollment, dan harga tiap program tersedia di halaman Jelajahi.
        </p>
        <button
          type="button"
          onClick={() => {
            setReportOpen(false)
            navigate('/lembaga/explore')
          }}
          className="mt-4 w-full rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-blue-50"
        >
          Buka laporan
        </button>
      </Modal>
    </div>
  )
}

function SessionRow({
  session,
  onEdit,
  onDelete,
}: {
  session: CourseSession
  onEdit: () => void
  onDelete: () => void
}) {
  const upcoming = session.status === 'Mendatang'

  return (
    <li className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:p-5">
      <div className="flex h-[68px] w-[68px] shrink-0 flex-col items-center justify-center overflow-hidden rounded-xl border border-blue-100 bg-blue-50">
        <span className="text-[11px] font-bold tracking-wider text-brand-700">{session.month}</span>
        <span className="mt-0.5 text-2xl font-bold leading-7 text-brand-800">{session.day}</span>
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="font-semibold leading-5 text-slate-900">{session.title}</h3>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500 sm:text-sm">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-slate-400" aria-hidden />
            {session.dateLabel}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="h-3.5 w-3.5 text-slate-400" aria-hidden />
            {session.time}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Video className="h-3.5 w-3.5 text-slate-400" aria-hidden />
            {session.platform}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
            upcoming ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {session.status}
        </span>
        <div className="flex items-center gap-1">
          <SessionAction label={`Edit ${session.title}`} onClick={onEdit} icon={<Edit3 />} />
          <SessionAction label={`Hapus ${session.title}`} onClick={onDelete} danger icon={<Trash2 />} />
        </div>
      </div>
    </li>
  )
}

function SessionAction({
  label,
  onClick,
  icon,
  danger = false,
}: {
  label: string
  onClick: () => void
  icon: ReactNode
  danger?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white transition ${
        danger
          ? 'text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600'
          : 'text-slate-500 hover:border-brand-200 hover:bg-blue-50 hover:text-brand-700'
      }`}
    >
      {icon}
    </button>
  )
}

/** Waktu ISO dari backend (offset +07:00) dipecah menurut zona waktu aplikasi. */
function jakartaParts(iso: string): { date: string; time: string; month: number; day: string; hour: string; minute: string } {
  const date = new Date(iso)
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: JAKARTA,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  )
  const hour = parts.hour === '24' ? '00' : parts.hour

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${hour}:${parts.minute}`,
    month: Number(parts.month) - 1,
    day: parts.day,
    hour,
    minute: parts.minute,
  }
}

function toCourseSession(session: ClassSession): CourseSession {
  const start = jakartaParts(session.starts_at)
  const end = jakartaParts(session.ends_at)
  const host = session.meeting_url?.toLowerCase() ?? ''

  return {
    id: session.id,
    title: session.title,
    month: MONTH_LABELS[start.month] ?? 'JUN',
    day: start.day.padStart(2, '0'),
    dateLabel: new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: JAKARTA,
    }).format(new Date(session.starts_at)),
    time: `${start.hour}:${start.minute} - ${end.hour}:${end.minute} WIB`,
    platform: host.includes('zoom')
      ? 'Zoom Meeting'
      : host.includes('meet.google')
        ? 'Google Meet'
        : host
          ? 'Online'
          : 'Tatap Muka',
    status: session.status === 'finished' ? 'Selesai' : 'Mendatang',
    source: session,
  }
}

function addMinutes(value: string, minutes: number): string {
  const [hours, mins] = value.split(':').map(Number)
  const total = Math.min(hours * 60 + mins + minutes, 23 * 60 + 59)

  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
