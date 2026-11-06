import {
  BookOpen,
  CalendarDays,
  Check,
  Clock3,
  Edit3,
  Plus,
  Trash2,
  Video,
} from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Field, inputClass } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { LembagaPageHeader } from './LembagaPageHeader'
import { ResourcesTab } from './ResourcesTab'
import { DiscussionsTab } from './DiscussionsTab'
import { ModuleDetailHeader, type ModuleDetailTab } from './ModuleDetailHeader'
import { getModuleById, isManagedModule, type ManagedModule } from './moduleData'

type SessionStatus = 'Mendatang' | 'Selesai'
interface CourseSession {
  id: number
  title: string
  month: string
  day: string
  dateLabel: string
  time: string
  platform: string
  status: SessionStatus
}

const INITIAL_SESSIONS: CourseSession[] = [
  {
    id: 1,
    title: 'Live Mentoring: Introduction to Backend',
    month: 'JUN',
    day: '25',
    dateLabel: 'Senin, 25 Juni 2025',
    time: '19:00 - 21:00 WIB',
    platform: 'Zoom Meeting',
    status: 'Mendatang',
  },
  {
    id: 2,
    title: 'Q&A Session: HTML & CSS Fundamentals',
    month: 'JUN',
    day: '18',
    dateLabel: 'Rabu, 18 Juni 2025',
    time: '19:00 - 20:30 WIB',
    platform: 'Google Meet',
    status: 'Selesai',
  },
  {
    id: 3,
    title: 'Final Project Workshop: Database Design',
    month: 'JUL',
    day: '02',
    dateLabel: 'Rabu, 02 Juli 2025',
    time: '19:00 - 21:00 WIB',
    platform: 'Zoom Meeting',
    status: 'Mendatang',
  },
]

export default function DetailModulSessions() {
  const navigate = useNavigate()
  const location = useLocation()
  const { moduleId } = useParams()
  const routeState = location.state as { moduleData?: unknown } | null
  const routeModule = isManagedModule(routeState?.moduleData) && String(routeState.moduleData.id) === moduleId
    ? routeState.moduleData
    : undefined
  const [moduleOverride, setModuleOverride] = useState<ManagedModule | null>(null)
  const module = moduleOverride && String(moduleOverride.id) === moduleId
    ? moduleOverride
    : routeModule ?? getModuleById(moduleId)
  const [sessions, setSessions] = useState(INITIAL_SESSIONS)
  const [activeTab, setActiveTab] = useState<ModuleDetailTab>('Sessions')
  const [reportOpen, setReportOpen] = useState(false)
  const [sessionDialog, setSessionDialog] = useState<'create' | 'edit' | null>(null)
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null)
  const [deleteSession, setDeleteSession] = useState<CourseSession | null>(null)
  const [sessionTitle, setSessionTitle] = useState('')
  const [sessionDate, setSessionDate] = useState('')
  const [sessionTime, setSessionTime] = useState('')
  const [sessionPlatform, setSessionPlatform] = useState('Zoom Meeting')
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('Mendatang')
  const [notice, setNotice] = useState('')

  function openCreateSession() {
    setEditingSessionId(null)
    setSessionTitle('')
    setSessionDate('')
    setSessionTime('')
    setSessionPlatform('Zoom Meeting')
    setSessionStatus('Mendatang')
    setSessionDialog('create')
  }

  function openEditSession(session: CourseSession) {
    setEditingSessionId(session.id)
    setSessionTitle(session.title)
    setSessionDate(session.dateLabel)
    setSessionTime(session.time)
    setSessionPlatform(session.platform)
    setSessionStatus(session.status)
    setSessionDialog('edit')
  }

  function saveSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = sessionTitle.trim()
    if (!title) return

    const calendarDate = getCalendarDate(sessionDate)
    const nextSession: CourseSession = {
      id: editingSessionId ?? Date.now(),
      title,
      month: calendarDate.month,
      day: calendarDate.day,
      dateLabel: sessionDate.trim(),
      time: sessionTime.trim() || '19:00 - 20:00 WIB',
      platform: sessionPlatform,
      status: sessionStatus,
    }

    if (sessionDialog === 'edit' && editingSessionId !== null) {
      setSessions((current) => current.map((item) => (item.id === editingSessionId ? nextSession : item)))
      setNotice('Sesi berhasil diperbarui pada pratinjau.')
    } else {
      setSessions((current) => [...current, nextSession])
      setNotice('Sesi berhasil ditambahkan pada pratinjau.')
    }
    setSessionDialog(null)
  }

  function changeTab(tab: ModuleDetailTab) {
    if (tab === 'Modules') {
      navigate('/lembaga/modules')
      return
    }
    setActiveTab(tab)
  }

  return (
    <div className="space-y-6">
      <LembagaPageHeader onReportClick={() => setReportOpen(true)} />
      <ModuleDetailHeader
        activeTab={activeTab}
        onTabChange={changeTab}
        onAddModule={() => navigate('/lembaga/modules/new')}
        module={module}
        onRename={(title) => {
          if (module) setModuleOverride({ ...module, title })
        }}
      />

      {notice && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800"
        >
          <span>{notice}</span>
          <button type="button" className="font-semibold hover:underline" onClick={() => setNotice('')}>
            Tutup
          </button>
        </div>
      )}

      <section aria-labelledby="upcoming-sessions-title">
        {activeTab === 'Discussions' ? (
          <DiscussionsTab />
        ) : activeTab === 'Resources' ? (
          <ResourcesTab />
        ) : activeTab === 'Sessions' ? (
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

            {sessions.length ? (
              <ul className="space-y-3">
                {sessions.map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    onEdit={() => openEditSession(session)}
                    onDelete={() => setDeleteSession(session)}
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
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <BookOpen className="mx-auto h-8 w-8 text-brand-600" aria-hidden />
            <h2 className="mt-3 font-semibold text-slate-900">{activeTab}</h2>
            <p className="mt-1 text-sm text-slate-500">Konten tab ini akan tersedia pada tahap pengembangan berikutnya.</p>
          </div>
        )}
      </section>

      <Modal
        open={sessionDialog !== null}
        title={sessionDialog === 'edit' ? 'Edit Sesi' : 'Tambah Sesi'}
        description="Kelola informasi jadwal sesi pada pratinjau."
        onClose={() => setSessionDialog(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSessionDialog(null)}>
              Batal
            </Button>
            <Button type="submit" form="session-form" icon={<Check className="h-4 w-4" aria-hidden />}>
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
              className={inputClass()}
              value={sessionDate}
              onChange={(event) => setSessionDate(event.target.value)}
              placeholder="Contoh: Senin, 25 Juni 2025"
              required
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="session-time" label="Jam">
              <input
                id="session-time"
                className={inputClass()}
                value={sessionTime}
                onChange={(event) => setSessionTime(event.target.value)}
                placeholder="19:00 - 21:00 WIB"
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
          <Field id="session-status" label="Status">
            <select
              id="session-status"
              className={inputClass()}
              value={sessionStatus}
              onChange={(event) => setSessionStatus(event.target.value as SessionStatus)}
            >
              <option>Mendatang</option>
              <option>Selesai</option>
            </select>
          </Field>
          <p className="text-xs text-slate-500">Perubahan hanya disimpan sementara di pratinjau ini.</p>
        </form>
      </Modal>

      <Modal
        open={deleteSession !== null}
        title="Hapus sesi?"
        description={`Sesi "${deleteSession?.title ?? ''}" akan dihapus dari daftar pratinjau.`}
        onClose={() => setDeleteSession(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteSession(null)}>
              Batal
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (deleteSession) {
                  setSessions((current) => current.filter((session) => session.id !== deleteSession.id))
                }
                setDeleteSession(null)
              }}
              icon={<Trash2 className="h-4 w-4" aria-hidden />}
            >
              Hapus Sesi
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">Tindakan ini hanya mengubah data sementara pada halaman.</p>
      </Modal>

      <Modal
        open={reportOpen}
        title="Laporan Lembaga"
        description="Ringkasan laporan belum tersedia di pratinjau statis."
        onClose={() => setReportOpen(false)}
      >
        <p className="text-sm leading-6 text-slate-600">Data laporan akan tersedia setelah terhubung ke backend.</p>
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

function getCalendarDate(value: string): { month: string; day: string } {
  const months: Record<string, string> = {
    januari: 'JAN',
    februari: 'FEB',
    maret: 'MAR',
    april: 'APR',
    mei: 'MEI',
    juni: 'JUN',
    juli: 'JUL',
    agustus: 'AGU',
    september: 'SEP',
    oktober: 'OKT',
    november: 'NOV',
    desember: 'DES',
  }
  const parts = value.toLocaleLowerCase('id-ID').replace(',', '').split(/\s+/)
  const monthIndex = parts.findIndex((part) => months[part] !== undefined)
  const day = monthIndex > 0 ? parts[monthIndex - 1] : '01'

  return {
    month: monthIndex >= 0 ? months[parts[monthIndex]] : 'JUN',
    day: /^\d{1,2}$/.test(day) ? day.padStart(2, '0') : '01',
  }
}
