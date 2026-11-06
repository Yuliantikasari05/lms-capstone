import { ArrowLeft, CalendarDays, Clock, History, User } from 'lucide-react'
import { Link } from 'react-router-dom'
import { WEBINARS, canJoin, timeRange, type Webinar } from './webinarData'

const fullDate = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })
const shortMonth = new Intl.DateTimeFormat('id-ID', { month: 'short', timeZone: 'Asia/Jakarta' })
const dayOfMonth = new Intl.DateTimeFormat('id-ID', { day: 'numeric', timeZone: 'Asia/Jakarta' })
const shortDate = new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' })

/** Contoh: "Besok", "Hari ini", atau "Sen, 9 Nov". */
function dayLabel(iso: string): string {
  const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const date = new Date(iso)
  const days = Math.round((startOfDay(date) - startOfDay(new Date())) / 86_400_000)
  if (days === 0) return 'Hari ini'
  if (days === 1) return 'Besok'
  return shortDate.format(date)
}

export default function KaryawanWebinar() {
  const [nearest, ...others] = [...WEBINARS].sort((a, b) => a.start.localeCompare(b.start))

  return (
    <>
      <Link to="/karyawan" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Kembali ke Dashboard
      </Link>
      <h1 className="mt-5 text-4xl font-extrabold text-slate-800">Daftar Webinar</h1>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <h2 className="flex items-center gap-5 text-3xl font-bold text-slate-800">
          <CalendarDays className="h-10 w-10 text-[#0085FF]" aria-hidden />
          Upcoming Live Sessions
        </h2>
        {/* Halaman kalender webinar belum ada. */}
        <button type="button" className="text-xl text-[#0085FF] hover:underline">
          View Full Calendar
        </button>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        {nearest && <FeaturedCard webinar={nearest} />}
        {others.map((webinar) => (
          <WebinarCard key={webinar.id} webinar={webinar} />
        ))}
      </div>
    </>
  )
}

/** Judul dengan area klik seluas kartu; tombol di dalam kartu berada di atasnya. */
function CardTitle({ webinar }: { webinar: Webinar }) {
  return (
    <h3 className="text-3xl font-bold text-slate-800">
      <Link to={`/karyawan/webinars/${webinar.id}`} className="after:absolute after:inset-0 after:rounded-3xl">
        {webinar.title}
      </Link>
    </h3>
  )
}

function PayLink() {
  return (
    <Link
      to="/karyawan/payments"
      className="relative z-10 w-fit rounded-full border border-[#0085FF] px-9 py-0.5 text-[10px] text-[#0085FF] hover:bg-blue-50"
    >
      Bayar
    </Link>
  )
}

function Speaker({ webinar }: { webinar: Webinar }) {
  return (
    <div className="flex min-w-0 items-center gap-6">
      <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white">
        <User className="h-9 w-9 fill-current" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-xl text-slate-800">{webinar.speaker}</p>
        <p className="text-slate-500">{webinar.speakerTitle}</p>
      </div>
    </div>
  )
}

/**
 * Belum dibayar: membuka detail (ada panel pembayaran).
 * Sudah dibayar: aktif hanya mulai 15 menit sebelum sesi sampai sesi selesai.
 */
function JoinButton({ webinar, className }: { webinar: Webinar; className: string }) {
  if (!webinar.purchased) {
    return (
      <Link to={`/karyawan/webinars/${webinar.id}`} className={`relative z-10 text-center font-bold text-slate-900 ${className}`}>
        Bergabung
      </Link>
    )
  }

  const active = canJoin(webinar)
  return (
    // Saat ditekan nanti: mencatat kehadiran lalu membuka link meeting (butuh backend).
    <button
      type="button"
      disabled={!active}
      title={active ? undefined : 'Aktif mulai 15 menit sebelum sesi dimulai'}
      className={`relative z-10 font-bold text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      Bergabung
    </button>
  )
}

/** Kartu webinar terdekat: blok biru di kiri. */
function FeaturedCard({ webinar }: { webinar: Webinar }) {
  return (
    <article className="relative flex rounded-3xl bg-white shadow-md transition-shadow hover:shadow-lg">
      <div className="hidden w-36 shrink-0 rounded-3xl bg-[#0085FF] sm:block" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col p-5">
        <p className="flex items-center gap-4 text-sm font-medium text-[#0085FF]">
          <Clock className="h-5 w-5 shrink-0" aria-hidden />
          {dayLabel(webinar.start)}, {timeRange(webinar)}
        </p>
        <div className="mt-8">
          <CardTitle webinar={webinar} />
        </div>
        <p className="mt-8 max-w-sm text-xl text-slate-500">
          Join Live Webinar {webinar.title} tanggal {fullDate.format(new Date(webinar.start))}
        </p>
        <div className="mt-auto flex flex-col pt-5">
          {!webinar.purchased && (
            <div className="self-end">
              <PayLink />
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
            <Speaker webinar={webinar} />
            <JoinButton webinar={webinar} className="rounded-2xl bg-blue-200 px-7 py-4 hover:bg-blue-300" />
          </div>
        </div>
      </div>
    </article>
  )
}

function WebinarCard({ webinar }: { webinar: Webinar }) {
  const date = new Date(webinar.start)

  return (
    <article className="relative flex flex-col rounded-3xl bg-white p-8 shadow-md transition-shadow hover:shadow-lg sm:px-12">
      <div className="flex items-start justify-between gap-4">
        <span className="flex w-28 flex-col items-center rounded-2xl bg-blue-200 py-1 leading-none text-slate-900">
          <span className="text-sm">{shortMonth.format(date)}</span>
          <span className="text-3xl font-extrabold">{dayOfMonth.format(date)}</span>
        </span>
        <span className="rounded-full bg-blue-200 px-10 py-2 text-slate-900">{webinar.category}</span>
      </div>
      <div className="mt-7">
        <CardTitle webinar={webinar} />
      </div>
      <p className="mt-7 flex items-center gap-5 text-xl text-slate-500">
        <History className="h-8 w-8 shrink-0 text-slate-500" strokeWidth={1.5} aria-hidden />
        {timeRange(webinar)}
      </p>
      <div className="mt-auto pt-3">
        {!webinar.purchased && (
          <div className="flex justify-end">
            <PayLink />
          </div>
        )}
        <div className="mt-1">
          <Speaker webinar={webinar} />
        </div>
        <div className="mt-3 flex">
          <JoinButton webinar={webinar} className="w-full rounded-2xl border border-slate-900 bg-white py-4 hover:bg-slate-50" />
        </div>
      </div>
    </article>
  )
}
