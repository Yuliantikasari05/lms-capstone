import { ArrowLeft, BookOpen, ChevronRight, Clock, Filter as FilterIcon, Search, Star, User } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { TRAININGS, formatRating, type Training } from './pelatihanData'

type Filter = 'all' | 'running' | 'done' | 'newest'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'running', label: 'Sedang Berjalan' },
  { key: 'done', label: 'Selesai' },
  { key: 'newest', label: 'Terbaru' },
]

function applyFilter(trainings: Training[], filter: Filter): Training[] {
  switch (filter) {
    case 'running':
      return trainings.filter((training) => training.purchased && training.progress < 100)
    case 'done':
      return trainings.filter((training) => training.purchased && training.progress === 100)
    case 'newest':
      return [...trainings].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    default:
      return trainings
  }
}

export default function KaryawanPelatihan() {
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')

  const keyword = query.trim().toLowerCase()
  const trainings = applyFilter(TRAININGS, filter).filter((training) => training.title.toLowerCase().includes(keyword))

  return (
    <>
      <Link to="/karyawan" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Kembali ke Dashboard
      </Link>

      <div className="mt-5 flex flex-wrap items-start justify-between gap-6">
        <div>
          <h1 className="text-4xl font-extrabold text-slate-800">Daftar Pelatihan</h1>
          <p className="mt-2 text-2xl italic text-slate-500">Temukan Pelatihan yang cocok</p>
        </div>
        <label className="relative w-full max-w-sm">
          <span className="sr-only">Cari pelatihan</span>
          <Search className="pointer-events-none absolute left-8 top-1/2 h-6 w-6 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari Pelatihan...."
            className="w-full rounded-full border border-slate-200 bg-white py-4 pl-20 pr-6 font-semibold italic text-slate-800 shadow-md placeholder:text-slate-400 focus:border-[#0085FF] focus:outline-none"
          />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3" role="group" aria-label="Filter pelatihan">
        <FilterIcon className="h-8 w-8 fill-current text-slate-400" aria-hidden />
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
            className={`w-32 rounded-full py-2 text-xs font-bold transition-colors ${
              filter === key ? 'bg-[#0085FF] text-white' : 'border border-slate-300 bg-white text-slate-700 hover:border-slate-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {trainings.length === 0 ? (
        <p className="mt-8 rounded-3xl bg-white px-6 py-12 text-center text-slate-500 shadow-md">Tidak ada pelatihan yang cocok.</p>
      ) : (
        <div className="mt-8 grid gap-7 md:grid-cols-2 xl:grid-cols-3">
          {trainings.map((training) => (
            <TrainingCard key={training.id} training={training} />
          ))}
        </div>
      )}
    </>
  )
}

function TrainingCard({ training }: { training: Training }) {
  return (
    <article className="relative flex flex-col rounded-3xl bg-white p-8 shadow-md transition-shadow hover:shadow-lg">
      <div className="relative h-48 bg-[#0085FF] text-xs text-white">
        <span className="absolute left-5 top-4 rounded-full bg-white/40 px-4 py-1 font-bold">{training.modules.length} modul</span>
        {!training.purchased && (
          <span className="absolute bottom-4 left-5 rounded-full bg-white/40 px-4 py-1">Rp. {training.price.toLocaleString('id-ID')}</span>
        )}
        <span className="absolute bottom-4 right-5 flex h-6 w-6 items-center justify-center rounded-full bg-white/50">
          <ChevronRight className="h-4 w-4" aria-hidden />
        </span>
      </div>

      <div className="mt-5 flex items-start justify-between gap-3">
        <h2 className="min-w-0 text-xl font-extrabold text-slate-800">
          {/* Area klik link ini menutup seluruh kartu; tombol di dalam kartu berada di atasnya. */}
          <Link to={`/karyawan/trainings/${training.id}`} className="after:absolute after:inset-0 after:rounded-3xl">
            {training.title}
          </Link>
        </h2>
        {!training.purchased && (
          <Link
            to="/karyawan/payments"
            className="relative z-10 shrink-0 rounded-full border border-[#0085FF] px-6 py-1 text-[10px] text-[#0085FF] hover:bg-blue-50"
          >
            Bayar
          </Link>
        )}
      </div>
      <p className="mt-2 flex-1 border-b border-slate-200 pb-5 italic text-slate-500">{training.description}</p>

      <div className="mt-4 flex items-center gap-5 text-xs italic text-slate-500">
        <span className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-slate-400" aria-hidden />
          {training.modules.length} modul
        </span>
        <span className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-slate-500" aria-hidden />
          {training.hours} jam
        </span>
        <span className="ml-auto flex items-center gap-1 font-semibold not-italic text-amber-500">
          <Star className="h-4 w-4 fill-current" aria-hidden />
          {formatRating(training.rating)}
        </span>
      </div>

      {training.purchased && (
        <>
          <div className="mt-4 flex items-center justify-between text-xs font-bold text-[#0085FF]">
            <span>Kemajuan</span>
            <span>{training.progress}%</span>
          </div>
          <div
            className="mt-1.5 flex h-2 gap-1"
            role="progressbar"
            aria-label={`Kemajuan ${training.title}`}
            aria-valuenow={training.progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="rounded-full bg-[#0085FF]" style={{ width: `${training.progress}%` }} />
            {training.progress < 100 && (
              <div className="relative flex-1 rounded-full bg-violet-200">
                <span className="absolute right-0.5 top-1/2 h-1 w-1 -translate-y-1/2 rounded-full bg-[#0085FF]" />
              </div>
            )}
          </div>
        </>
      )}

      <div className="mt-6 flex min-h-12 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-400 text-white">
          <User className="h-5 w-5 fill-current" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 truncate italic uppercase text-slate-500">{training.mentor}</span>
        {!training.purchased && (
          <Link
            to={`/karyawan/trainings/${training.id}`}
            className="relative z-10 shrink-0 rounded-full bg-[#0085FF] px-5 py-3 font-bold text-white hover:bg-blue-600"
          >
            Enroll Now
          </Link>
        )}
      </div>
    </article>
  )
}
