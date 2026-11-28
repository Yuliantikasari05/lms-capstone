import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Download,
  GraduationCap,
  Mail,
  Medal,
  TrendingUp,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { ErrorState, Spinner } from '../../components/ui/States'
import { useApiData } from '../../lib/useApiData'
import { LembagaPageHeader } from './LembagaPageHeader'
import { fetchStudent } from './api'

const formatDate = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso))
    : 'Belum tersedia'

export default function DetailSiswa() {
  const { studentId = '' } = useParams()
  const navigate = useNavigate()
  const [notice, setNotice] = useState('')
  const student = useApiData(() => fetchStudent(studentId), [studentId])

  const data = student.data
  const programs = data?.programs ?? []

  function downloadTranscript() {
    if (!data) return

    const transcript = [
      'TRANSKRIP PEMBELAJARAN LEMBAGA',
      `Nama: ${data.name}`,
      `Email: ${data.email}`,
      `ID Siswa: ${data.id}`,
      '',
      ...programs.map((program) =>
        `${program.course.title ?? 'Program'} - ${program.progress_percent === null ? 'Progres belum tersedia' : `Progres ${program.progress_percent}%`}`,
      ),
    ].join('\n')
    const url = URL.createObjectURL(new Blob([transcript], { type: 'text/plain;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `transkrip-${data.id}.txt`
    anchor.click()
    URL.revokeObjectURL(url)
    setNotice('Transkrip berhasil diunduh.')
  }

  return (
    <div className="space-y-6">
      <LembagaPageHeader onReportClick={() => setNotice('Ringkasan laporan siswa tersedia di halaman Jelajahi.')} />

      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-blue-950 to-blue-900 px-5 py-6 text-white shadow-sm sm:px-8 sm:py-7">
        <div className="pointer-events-none absolute -right-10 -top-20 h-56 w-56 rounded-full border-[30px] border-white/[0.04]" aria-hidden />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-2 text-xs text-blue-200">
              <Link to="/lembaga/students" className="hover:text-white">Kelola Siswa</Link>
              <span aria-hidden>/</span>
              <span className="text-white/90">Detail Siswa</span>
            </nav>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Detail Pembelajaran Siswa</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">
              Pantau program yang diikuti dan aktivitas kelas untuk membantu kesuksesan akademik {data?.name ?? 'siswa'}.
            </p>
          </div>
          <Button
            variant="secondary"
            icon={<Download className="h-4 w-4" aria-hidden />}
            onClick={downloadTranscript}
            disabled={!data}
            className="shrink-0 border-white/40 bg-white/10 text-white hover:bg-white/20"
          >
            Unduh Transkrip
          </Button>
        </div>
      </section>

      {notice && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <span>{notice}</span>
          <button type="button" className="font-semibold hover:underline" onClick={() => setNotice('')}>Tutup</button>
        </div>
      )}

      {student.error && <ErrorState error={student.error} onRetry={student.reload} />}
      {student.loading && !data && <Spinner label="Memuat data siswa…" />}

      {data && (
        <div className="grid gap-5 lg:grid-cols-[minmax(245px,0.78fr)_minmax(0,2fr)]">
          <section aria-labelledby="student-profile-heading" className="h-fit rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 text-2xl font-bold text-blue-800 ring-4 ring-blue-50">
                {data.initials}
              </div>
              <h2 id="student-profile-heading" className="mt-4 text-lg font-bold text-slate-900">{data.name}</h2>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                <Mail className="h-3.5 w-3.5" aria-hidden /> {data.email}
              </p>
              <StatusBadge status={data.status_label} />
            </div>

            <div className="my-5 border-t border-slate-100" />
            <dl className="space-y-4">
              <ProfileDetail label="ID Siswa" value={`Siswa #${data.id}`} />
              <ProfileDetail label="Terdaftar Sejak" value={formatDate(data.enrolled_at)} icon={<CalendarDays className="h-4 w-4" aria-hidden />} />
              <ProfileDetail label="Jumlah Program" value={`${data.metrics.programs_count} program`} icon={<GraduationCap className="h-4 w-4" aria-hidden />} />
            </dl>
            <Button
              variant="secondary"
              onClick={() => navigate('/lembaga/students')}
              icon={<ArrowLeft className="h-4 w-4" aria-hidden />}
              className="mt-6 w-full"
            >
              Kembali ke Kelola Siswa
            </Button>
          </section>

          <div className="space-y-5">
            <section aria-label="Ringkasan progres siswa" className="grid gap-3 sm:grid-cols-3">
              <MetricCard
                label="Progres Kursus"
                value={data.metrics.progress_percent === null ? '—' : `${data.metrics.progress_percent}%`}
                icon={<TrendingUp className="h-5 w-5" aria-hidden />}
                iconStyle="bg-blue-50 text-blue-700"
                detail={<p className="mt-2 text-xs text-slate-500">Pencatatan progres materi belum tersedia</p>}
              />
              <MetricCard
                label="Rata-rata Nilai"
                value={data.metrics.average_score === null ? '—' : String(data.metrics.average_score)}
                icon={<GraduationCap className="h-5 w-5" aria-hidden />}
                iconStyle="bg-emerald-50 text-emerald-700"
                detail={<p className="mt-2 text-xs text-slate-500">Nilai belum dicatat pada program lembaga</p>}
              />
              <MetricCard
                label="Sertifikat"
                value={String(data.metrics.certificates)}
                icon={<Medal className="h-5 w-5" aria-hidden />}
                iconStyle="bg-amber-50 text-amber-700"
                detail={<p className="mt-2 text-xs text-slate-500">Sertifikat diperoleh</p>}
              />
            </section>

            <section aria-labelledby="active-courses-heading" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div>
                  <h2 id="active-courses-heading" className="font-bold text-slate-900">Kursus Aktif</h2>
                  <p className="mt-0.5 text-xs text-slate-500">Program lembaga yang diikuti siswa</p>
                </div>
                <span className="text-xs font-semibold text-blue-700">{programs.length} program</span>
              </header>
              <div className="hidden grid-cols-[minmax(190px,1.3fr)_minmax(130px,1fr)_100px_28px] gap-4 bg-slate-50 px-5 py-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 sm:grid">
                <span>Nama Kursus</span>
                <span>Progres</span>
                <span>Status</span>
                <span className="sr-only">Aksi</span>
              </div>
              <div className="divide-y divide-slate-100">
                {programs.map((program) => (
                  <div key={program.enrollment_id} className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(190px,1.3fr)_minmax(130px,1fr)_100px_28px] sm:items-center sm:gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                        <BookOpen className="h-5 w-5" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">{program.course.title ?? 'Program'}</p>
                        <p className="mt-0.5 text-xs text-slate-500">Terdaftar {formatDate(program.enrolled_at)}</p>
                      </div>
                    </div>
                    <div>
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className="text-slate-500 sm:hidden">Progres</span>
                        <span className="font-semibold text-slate-700">
                          {program.progress_percent === null ? 'Belum tersedia' : `${program.progress_percent}%`}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-blue-600" style={{ width: `${program.progress_percent ?? 0}%` }} />
                      </div>
                    </div>
                    <span className="w-fit rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                      {program.status === 'active' ? 'Berjalan' : 'Selesai'}
                    </span>
                    <button
                      type="button"
                      aria-label={`Lihat program ${program.course.title ?? ''}`}
                      onClick={() => navigate('/lembaga/explore')}
                      className="hidden h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 sm:flex"
                    >
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                ))}
                {programs.length === 0 && (
                  <p className="px-5 py-8 text-center text-sm text-slate-500">Siswa belum terdaftar pada program lembaga Anda.</p>
                )}
              </div>
              <footer className="flex items-center gap-2 border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
                <Award className="h-4 w-4 text-amber-500" aria-hidden />
                Progres materi dan nilai belum dicatat untuk program lembaga; angka tidak dikarang.
              </footer>
            </section>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${status === 'Aktif' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === 'Aktif' ? 'bg-emerald-500' : 'bg-slate-400'}`} aria-hidden />
      {status}
    </span>
  )
}

function ProfileDetail({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-slate-400">{icon ?? <CheckCircle2 className="h-4 w-4" aria-hidden />}</span>
      <div>
        <dt className="text-[11px] text-slate-500">{label}</dt>
        <dd className="mt-0.5 text-sm font-medium text-slate-800">{value}</dd>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  icon,
  iconStyle,
  detail,
}: {
  label: string
  value: string
  icon: React.ReactNode
  iconStyle: string
  detail: React.ReactNode
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconStyle}`}>{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      {detail}
    </article>
  )
}
