import { ArrowLeft, ChevronLeft, ChevronRight, Crown, Search, Trophy, Zap } from 'lucide-react'
import { type FormEvent, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorState, Spinner } from '../../components/ui/States'
import { useApiData } from '../../lib/useApiData'
import { fetchStudentLeaderboard } from './studentApi'

type Period = 'week' | 'month' | 'all'

const PERIODS: { key: Period; label: string }[] = [
  { key: 'week', label: 'Minggu Ini' },
  { key: 'month', label: 'Bulan Ini' },
  { key: 'all', label: 'Sepanjang Masa' },
]

/** Jumlah baris per halaman di tabel (peringkat #4 dan seterusnya). */
const PAGE_SIZE = 4

/** Gaya podium per peringkat: emas, perak, perunggu. */
const PODIUM_STYLE: Record<1 | 2 | 3, { avatar: string; circle: string; badge: string; xp: string }> = {
  1: {
    avatar: 'h-32 w-32 text-6xl sm:h-44 sm:w-44 sm:text-7xl',
    circle: 'border-yellow-400 bg-yellow-50 text-yellow-500',
    badge: 'bg-yellow-500 text-white',
    xp: 'text-2xl font-bold text-yellow-500 sm:text-3xl',
  },
  2: {
    avatar: 'h-24 w-24 text-4xl sm:h-32 sm:w-32 sm:text-5xl',
    circle: 'border-slate-300 bg-slate-100 text-slate-400',
    badge: 'bg-slate-200 text-slate-800',
    xp: 'text-xl text-slate-700 sm:text-2xl',
  },
  3: {
    avatar: 'h-24 w-24 text-4xl sm:h-32 sm:w-32 sm:text-5xl',
    circle: 'border-orange-300 bg-orange-50 text-yellow-500',
    badge: 'bg-orange-500 text-white',
    xp: 'text-xl text-slate-700 sm:text-2xl',
  },
}

const formatXp = (xp: number) => `${xp.toLocaleString('id-ID')} XP`

export default function SiswaPapanPeringkat() {
  const [period, setPeriod] = useState<Period>('week')
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [highlightId, setHighlightId] = useState<number | null>(null)
  const [notFound, setNotFound] = useState(false)
  const board = useApiData(() => fetchStudentLeaderboard(period), [period])

  const ranking = useMemo(() => board.data?.rows ?? [], [board.data])
  const podium = ranking.slice(0, 3)
  const rest = ranking.slice(3)
  const pageCount = Math.max(1, Math.ceil(rest.length / PAGE_SIZE))
  const rows = rest.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const changePeriod = (next: Period) => {
    setPeriod(next)
    setPage(1)
    setHighlightId(null)
    setNotFound(false)
  }

  /** Enter / tombol Cari: pindah ke halaman tempat user berada lalu sorot barisnya. */
  const onSearch = (event: FormEvent) => {
    event.preventDefault()
    const keyword = query.trim().toLowerCase()
    if (!keyword) return
    const index = ranking.findIndex((learner) => learner.name.toLowerCase().includes(keyword))
    setNotFound(index === -1)
    if (index === -1) {
      setHighlightId(null)
      return
    }
    setHighlightId(ranking[index].user_id)
    if (index >= 3) setPage(Math.floor((index - 3) / PAGE_SIZE) + 1)
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <Link to="/siswa" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Kembali ke Dashboard
          </Link>
          <h1 className="mt-3 flex items-center gap-3 text-4xl font-bold text-slate-900">
            <Trophy className="h-10 w-10 text-yellow-500" strokeWidth={1.75} aria-hidden />
            Papan Peringkat
          </h1>
          <p className="mt-2 text-sm text-slate-600">Lihat peringkatmu dibandingkan learner lainnya!</p>
        </div>

        <div className="flex gap-2 rounded-xl border border-slate-200 bg-white p-3" role="group" aria-label="Periode peringkat">
          {PERIODS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => changePeriod(key)}
              aria-pressed={period === key}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                period === key ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {board.loading && !board.data && <Spinner label="Memuat papan peringkat…" />}
      {board.error && <ErrorState error={board.error} onRetry={board.reload} />}

      {board.data && (
        <>
          <ol className="mt-2 flex items-end justify-center gap-6 sm:gap-36">
            {[podium[1], podium[0], podium[2]].map((learner) => {
              if (!learner) return null
              const rank = (podium.indexOf(learner) + 1) as 1 | 2 | 3
              const style = PODIUM_STYLE[rank]
              return (
                <li key={learner.user_id} className="flex flex-col items-center text-center">
                  {rank === 1 && <Crown className="mb-4 h-12 w-12 text-yellow-400" strokeWidth={1.5} aria-hidden />}
                  <div className="relative">
                    <span
                      className={`flex items-center justify-center rounded-full border-4 font-semibold shadow-md ring-4 ring-white ${style.avatar} ${style.circle} ${
                        highlightId === learner.user_id ? 'outline outline-4 outline-offset-4 outline-blue-400' : ''
                      }`}
                      aria-hidden
                    >
                      {learner.name.charAt(0)}
                    </span>
                    <span className={`absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-lg font-bold shadow-sm ${style.badge}`}>
                      #{learner.rank}
                    </span>
                  </div>
                  <p className="mt-8 text-2xl font-semibold text-slate-900 sm:text-3xl">{learner.name}</p>
                  <p className={`mt-2 ${style.xp}`}>{formatXp(learner.xp)}</p>
                </li>
              )
            })}
          </ol>

          {podium.length === 0 && (
            <p className="mt-8 rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center text-slate-500">
              Belum ada XP pada periode ini.
            </p>
          )}

          <section className="mt-14 overflow-hidden rounded-2xl border border-slate-300 bg-white">
            <form onSubmit={onSearch} className="flex flex-wrap gap-4 border-b border-slate-300 bg-slate-50 px-5 py-5">
              <label className="relative min-w-0 flex-1 sm:max-w-2xl">
                <span className="sr-only">Cari user</span>
                <Search className="pointer-events-none absolute left-7 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Cari user (Enter untuk navigasi)..."
                  className="w-full rounded-2xl border border-slate-300 bg-white py-5 pl-16 pr-4 text-lg text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
                />
              </label>
              <button type="submit" className="rounded-xl bg-blue-600 px-7 text-xl text-white hover:bg-blue-700">
                Cari
              </button>
              {notFound && <p className="w-full text-sm text-red-600">User tidak ditemukan.</p>}
            </form>

            <ol className="divide-y divide-slate-300">
              {rows.map((learner) => (
                <li key={learner.user_id} className={`flex items-center gap-4 px-5 py-6 sm:gap-7 sm:px-9 ${highlightId === learner.user_id ? 'bg-blue-50' : ''}`}>
                  <span className="w-12 text-2xl font-semibold text-slate-500 sm:text-3xl">#{learner.rank}</span>
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xl font-semibold text-slate-500" aria-hidden>
                    {learner.name.charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xl font-semibold text-slate-900 sm:text-2xl">
                      {learner.name}
                      {learner.is_me && <span className="ml-2 rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">Anda</span>}
                    </p>
                    <p className="text-xs text-slate-900">Siswa</p>
                  </div>
                  <span className="whitespace-nowrap text-xl font-semibold text-slate-900 sm:text-2xl">{formatXp(learner.xp)}</span>
                  <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-500 sm:flex">
                    <Zap className="h-6 w-6" aria-hidden />
                  </span>
                </li>
              ))}
              {rows.length === 0 && rest.length === 0 && (
                <li className="px-9 py-6 text-sm text-slate-500">Belum ada peserta lain pada periode ini.</li>
              )}
            </ol>

            <footer className="flex items-center justify-between border-t border-slate-300 bg-slate-50 px-5 py-6 sm:px-9">
              <span className="text-slate-600">
                Halaman {page} dari {pageCount}
              </span>
              <nav className="flex items-center gap-2" aria-label="Halaman peringkat">
                <button
                  type="button"
                  onClick={() => setPage((current) => current - 1)}
                  disabled={page <= 1}
                  className="rounded p-1 text-slate-600 hover:bg-slate-200 disabled:opacity-40"
                  aria-label="Halaman sebelumnya"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                </button>
                {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => (
                  <button
                    key={number}
                    type="button"
                    onClick={() => setPage(number)}
                    aria-current={number === page ? 'page' : undefined}
                    className={`rounded px-2 text-lg ${number === page ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-200'}`}
                  >
                    {number}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPage((current) => current + 1)}
                  disabled={page >= pageCount}
                  className="rounded p-1 text-slate-600 hover:bg-slate-200 disabled:opacity-40"
                  aria-label="Halaman berikutnya"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              </nav>
            </footer>
          </section>
        </>
      )}
    </>
  )
}
