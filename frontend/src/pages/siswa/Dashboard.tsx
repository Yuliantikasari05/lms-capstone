import { BookOpen, ChevronRight, Flame, Trophy, Video } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'

/*
 * DATA CONTOH (statis). Endpoint progres, streak, XP, sesi, dan papan peringkat belum ada.
 * Saat API tersedia, ganti konstanta di bawah ini dengan data dari backend.
 */
const MATERIAL_PROGRESS = { course: 'Bahasa Indonesia Lanjutan', modulesDone: 2, modulesTotal: 3 }
const STREAK = { days: 1, message: 'Luar biasa! Jangan biarkan apinya padam.' }
const LEVEL = { name: 'Silver Elite', xpToNext: 1250, nextLevel: 'Expert' }
const UPCOMING_SESSIONS = [
  { id: 1, subject: 'Bahasa Indonesia', mentor: 'Fauzan S. Pd', start: '02.00', end: '03.30', live: true },
]
const LEADERBOARD = [
  { rank: 1, name: 'Badrun Napis', xp: 9999 },
  { rank: 2, name: 'Badrun Napis', xp: 9999 },
  { rank: 3, name: 'Badrun Napis', xp: 9999 },
  { rank: 4, name: 'Badrun Napis', xp: 9999 },
]

/** Warna peringkat: emas, perak, perunggu, lalu abu-abu muda. */
const RANK_COLOR: Record<number, string> = { 1: 'text-yellow-500', 2: 'text-slate-400', 3: 'text-yellow-700' }

export default function SiswaDashboard() {
  const { user } = useAuth()
  const firstName = user?.name.split(' ')[0] ?? ''
  const progressPercent = Math.round((MATERIAL_PROGRESS.modulesDone / MATERIAL_PROGRESS.modulesTotal) * 100)

  return (
    <>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-slate-900">Halo, {firstName}! 👋</h1>
        <p className="mt-2 text-base text-slate-700">Senang Melihatmu Kembali, mari lanjutkan progres belajarmu</p>
      </div>

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
          <p className="text-2xl font-bold text-slate-900">{MATERIAL_PROGRESS.course}</p>
          <p className="mt-4 text-xs text-slate-500">
            {MATERIAL_PROGRESS.modulesDone}/{MATERIAL_PROGRESS.modulesTotal} Modul Selesai
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
          <p className="text-2xl font-bold text-slate-900">{STREAK.days} hari Beruntun</p>
          <p className="mt-4 text-sm text-red-500">{STREAK.message}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-7">
          <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
            <Trophy className="h-6 w-6" aria-hidden />
          </span>
          <p className="mt-5 text-sm text-slate-500">Level Belajar</p>
          <p className="text-2xl font-bold text-slate-900">{LEVEL.name}</p>
          <p className="mt-4 text-sm text-slate-500">
            {LEVEL.xpToNext} xp ke {LEVEL.nextLevel}
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

          <ul className="space-y-4">
            {UPCOMING_SESSIONS.map((session) => (
              <li key={session.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white px-7 py-6">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                  <Video className="h-6 w-6" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-2xl font-bold text-slate-900">{session.subject}</p>
                  <p className="text-slate-500">{session.mentor}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm uppercase tracking-wide text-slate-500">Waktu</p>
                  <p className="font-mono text-sm font-semibold text-slate-900">
                    {session.start} - {session.end}
                  </p>
                </div>
                {session.live && (
                  <span className="rounded-md bg-emerald-50 px-4 py-1.5 text-xs font-bold tracking-wide text-emerald-600">LIVE</span>
                )}
                <Link
                  to="/siswa/schedule"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
                  aria-label={`Detail sesi ${session.subject}`}
                >
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Papan Peringkat</h2>
          <ol className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-4 py-3">
            {LEADERBOARD.map((row) => (
              <li key={row.rank} className="flex items-center gap-4 px-3 py-4">
                <span className={`w-8 text-xl font-bold ${RANK_COLOR[row.rank] ?? 'text-slate-300'}`}>#{row.rank}</span>
                <span
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gray-100 text-3xl font-semibold text-gray-500"
                  aria-hidden
                >
                  {row.name.charAt(0)}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{row.name}</p>
                  <p className="text-xs text-slate-500">{row.xp} XP</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  )
}
