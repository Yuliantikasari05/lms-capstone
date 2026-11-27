import { BarChart3, BookOpen, CalendarDays, ChevronRight, Flame, Gift, Target, Trophy, Video, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { ErrorState, Spinner } from '../../components/ui/States'
import { useApiData } from '../../lib/useApiData'
import { timeFormat } from './shared'
import { fetchStudentSummary } from './studentApi'

/** Kartu menu di atas dashboard, pengganti menu navigasi. */
const SHORTCUTS: { label: string; to: string; Icon: LucideIcon; iconClass: string }[] = [
  { label: 'Materi', to: '/siswa/materials', Icon: BookOpen, iconClass: 'bg-blue-50 text-blue-600' },
  { label: 'Jadwal', to: '/siswa/schedule', Icon: CalendarDays, iconClass: 'bg-purple-50 text-purple-500' },
  { label: 'Papan Peringkat', to: '/siswa/leaderboard', Icon: BarChart3, iconClass: 'bg-orange-50 text-amber-500' },
  { label: 'Tugas', to: '/siswa/assignments', Icon: Target, iconClass: 'bg-indigo-100 text-indigo-600' },
  { label: 'Laporan', to: '/siswa/reports', Icon: Gift, iconClass: 'bg-pink-50 text-rose-600' },
]

/** Warna peringkat: emas, perak, perunggu, lalu abu-abu muda. */
const RANK_COLOR: Record<number, string> = { 1: 'text-yellow-500', 2: 'text-slate-400', 3: 'text-yellow-700' }

export default function SiswaDashboard() {
  const { user } = useAuth()
  const firstName = user?.name.split(' ')[0] ?? ''
  const summary = useApiData(fetchStudentSummary, [])

  const data = summary.data
  const progressPercent = data?.progress?.percent ?? 0
  const streakDays = data?.streak.days ?? 0
  const level = data?.level

  return (
    <>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-slate-900">Halo, {firstName}! 👋</h1>
        <p className="mt-2 text-base text-slate-700">Senang Melihatmu Kembali, mari lanjutkan progres belajarmu</p>
      </div>

      <nav aria-label="Menu Siswa" className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {SHORTCUTS.map(({ label, to, Icon, iconClass }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-4 rounded-2xl border-2 border-slate-200 bg-white px-6 py-3 text-slate-900 transition-colors hover:border-slate-300"
          >
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>
              <Icon className="h-6 w-6" aria-hidden />
            </span>
            {label}
          </Link>
        ))}
      </nav>

      {summary.loading && !data && <Spinner label="Memuat ringkasan belajar…" />}
      {summary.error && <ErrorState error={summary.error} onRetry={summary.reload} />}

      {data && (
        <>
          <div className="grid gap-6 md:grid-cols-3">
            <Link
              to="/siswa/materials"
              className="relative rounded-2xl border border-slate-200 bg-white p-7 transition-colors hover:border-slate-300"
            >
              <ChevronRight className="absolute right-6 top-6 h-5 w-5 text-slate-300" aria-hidden />
              <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <BookOpen className="h-6 w-6" aria-hidden />
              </span>
              <p className="mt-5 text-sm text-slate-500">Progres Materi</p>
              <p className="text-2xl font-bold text-slate-900">{data.progress?.course_title ?? 'Belum ada kursus'}</p>
              <p className="mt-4 text-xs text-slate-500">
                {data.progress ? `${data.progress.modules_done}/${data.progress.modules_total} Modul Selesai` : 'Belum terdaftar pada kursus'}
              </p>
              <div
                className="mt-2 h-3 overflow-hidden rounded-full bg-slate-200"
                role="progressbar"
                aria-label="Progres materi"
                aria-valuenow={progressPercent}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="h-full rounded-full bg-blue-700" style={{ width: `${progressPercent}%` }} />
              </div>
            </Link>

            <div className="rounded-2xl border border-slate-200 bg-white p-7">
              <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
                <Flame className="h-6 w-6" aria-hidden />
              </span>
              <p className="mt-5 text-sm text-slate-500">Daily Streak</p>
              <p className="text-2xl font-bold text-slate-900">{streakDays} hari Beruntun</p>
              <p className="mt-4 text-sm text-red-500">
                {streakDays > 0 ? 'Luar biasa! Jangan biarkan apinya padam.' : 'Belum ada aktivitas. Mulai belajar hari ini!'}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-7">
              <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                <Trophy className="h-6 w-6" aria-hidden />
              </span>
              <p className="mt-5 text-sm text-slate-500">Level Belajar</p>
              <p className="text-2xl font-bold text-slate-900">{level?.level ?? '—'}</p>
              <p className="mt-4 text-sm text-slate-500">
                {level?.xp_to_next !== null && level?.xp_to_next !== undefined && level.next_level
                  ? `${level.xp_to_next} xp ke ${level.next_level}`
                  : `${level?.total_xp ?? 0} XP terkumpul`}
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <section className="lg:col-span-2">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-xl text-slate-800">Sesi Bimbingan Mendatang</h2>
                <Link to="/siswa/schedule" className="text-xl font-medium text-blue-700 hover:underline">
                  Lihat Semua
                </Link>
              </div>

              {data.upcoming_sessions.length === 0 ? (
                <p className="rounded-2xl border border-slate-200 bg-white px-7 py-6 text-slate-500">Belum ada sesi bimbingan mendatang.</p>
              ) : (
                <ul className="space-y-4">
                  {data.upcoming_sessions.map((session) => (
                    <li key={session.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white px-7 py-6">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                        <Video className="h-6 w-6" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-2xl font-bold text-slate-900">{session.course_title ?? session.title}</p>
                        <p className="text-slate-500">{session.mentor_name ?? session.title}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm uppercase tracking-wide text-slate-500">Waktu</p>
                        <p className="font-mono text-sm font-semibold text-slate-900">
                          {timeFormat.format(new Date(session.starts_at))}
                          {session.ends_at && ` - ${timeFormat.format(new Date(session.ends_at))}`}
                        </p>
                      </div>
                      {session.can_join && (
                        <span className="rounded-md bg-emerald-50 px-4 py-1.5 text-xs font-bold tracking-wide text-emerald-600">LIVE</span>
                      )}
                      <Link
                        to="/siswa/schedule"
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
                        aria-label={`Detail sesi ${session.title}`}
                      >
                        <ChevronRight className="h-4 w-4" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="mb-4 text-xl font-semibold text-slate-900">Papan Peringkat</h2>
              <ol className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                {data.leaderboard.length === 0 && <li className="px-3 py-4 text-sm text-slate-500">Belum ada peringkat.</li>}
                {data.leaderboard.map((row) => (
                  <li key={row.user_id} className="flex items-center gap-4 px-3 py-4">
                    <span className={`w-8 text-xl font-bold ${RANK_COLOR[row.rank] ?? 'text-slate-300'}`}>#{row.rank}</span>
                    <span
                      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gray-100 text-3xl font-semibold text-gray-500"
                      aria-hidden
                    >
                      {row.name.charAt(0)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">
                        {row.name}
                        {row.is_me && <span className="ml-2 rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">Anda</span>}
                      </p>
                      <p className="text-xs text-slate-500">{row.xp} XP</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </>
      )}
    </>
  )
}
