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
import { LembagaPageHeader } from './LembagaPageHeader'
import { createInitialStudents, StudentStatus } from './KelolaSiswa'

const COURSE_PROGRESS = [
  { name: 'Fullstack Web Developer', term: 'Semester Genap', progress: 80, color: 'bg-blue-600', iconColor: 'bg-blue-50 text-blue-700' },
  { name: 'UI/UX Design Fundamental', term: 'Semester Genap', progress: 45, color: 'bg-emerald-500', iconColor: 'bg-amber-50 text-amber-700' },
]

export default function DetailSiswa() {
  const { studentId = '' } = useParams()
  const navigate = useNavigate()
  const [notice, setNotice] = useState('')
  const student = createInitialStudents().find((item) => item.id === studentId) ?? {
    id: studentId || 'UNI-2023-089',
    name: 'Siswa Lembaga',
    email: 'siswa@example.com',
    program: 'Fullstack Web Developer',
    status: 'Aktif' as StudentStatus,
    initials: 'SL',
  }

  function downloadTranscript() {
    const transcript = [
      'TRANSKRIP PEMBELAJARAN',
      `Nama: ${student.name}`,
      `Email: ${student.email}`,
      `ID Siswa: ${student.id}`,
      '',
      ...COURSE_PROGRESS.map((course) => `${course.name} - Progres ${course.progress}%`),
    ].join('\n')
    const url = URL.createObjectURL(new Blob([transcript], { type: 'text/plain;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `transkrip-${student.id}.txt`
    anchor.click()
    URL.revokeObjectURL(url)
    setNotice('Transkrip contoh berhasil diunduh.')
  }

  return (
    <div className="space-y-6">
      <LembagaPageHeader onReportClick={() => setNotice('Ringkasan laporan siswa belum tersedia di pratinjau.')} />

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
              Pantau progres, nilai, dan aktivitas kelas untuk membantu kesuksesan akademik {student.name}.
            </p>
          </div>
          <Button
            variant="secondary"
            icon={<Download className="h-4 w-4" aria-hidden />}
            onClick={downloadTranscript}
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

      <div className="grid gap-5 lg:grid-cols-[minmax(245px,0.78fr)_minmax(0,2fr)]">
        <section aria-labelledby="student-profile-heading" className="h-fit rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 text-2xl font-bold text-blue-800 ring-4 ring-blue-50">
              {student.initials}
            </div>
            <h2 id="student-profile-heading" className="mt-4 text-lg font-bold text-slate-900">{student.name}</h2>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              <Mail className="h-3.5 w-3.5" aria-hidden /> {student.email}
            </p>
            <StatusBadge status={student.status} />
          </div>

          <div className="my-5 border-t border-slate-100" />
          <dl className="space-y-4">
            <ProfileDetail label="ID Siswa" value={student.id} />
            <ProfileDetail label="Terdaftar Sejak" value="12 Agustus 2023" icon={<CalendarDays className="h-4 w-4" aria-hidden />} />
            <ProfileDetail label="Program Studi" value="Teknik Informatika" icon={<GraduationCap className="h-4 w-4" aria-hidden />} />
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
              value="75%"
              icon={<TrendingUp className="h-5 w-5" aria-hidden />}
              iconStyle="bg-blue-50 text-blue-700"
              detail={<div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-3/4 rounded-full bg-blue-600" /></div>}
            />
            <MetricCard
              label="Rata-rata Nilai"
              value="A-"
              icon={<GraduationCap className="h-5 w-5" aria-hidden />}
              iconStyle="bg-emerald-50 text-emerald-700"
              detail={<p className="mt-2 text-xs text-slate-500">Performa akademik sangat baik</p>}
            />
            <MetricCard
              label="Sertifikat"
              value="2"
              icon={<Medal className="h-5 w-5" aria-hidden />}
              iconStyle="bg-amber-50 text-amber-700"
              detail={<p className="mt-2 text-xs text-slate-500">Sertifikat diperoleh</p>}
            />
          </section>

          <section aria-labelledby="active-courses-heading" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 id="active-courses-heading" className="font-bold text-slate-900">Kursus Aktif</h2>
                <p className="mt-0.5 text-xs text-slate-500">Progres pembelajaran siswa</p>
              </div>
              <button type="button" onClick={() => setNotice('Daftar kursus lengkap belum tersedia di pratinjau.')} className="text-xs font-semibold text-blue-700 hover:text-blue-900">
                Lihat Semua
              </button>
            </header>
            <div className="hidden grid-cols-[minmax(190px,1.3fr)_minmax(130px,1fr)_100px_28px] gap-4 bg-slate-50 px-5 py-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 sm:grid">
              <span>Nama Kursus</span>
              <span>Progres</span>
              <span>Status</span>
              <span className="sr-only">Aksi</span>
            </div>
            <div className="divide-y divide-slate-100">
              {COURSE_PROGRESS.map((course) => (
                <div key={course.name} className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(190px,1.3fr)_minmax(130px,1fr)_100px_28px] sm:items-center sm:gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${course.iconColor}`}>
                      <BookOpen className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{course.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{course.term}</p>
                    </div>
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="text-slate-500 sm:hidden">Progres</span>
                      <span className="font-semibold text-slate-700">{course.progress}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${course.color}`} style={{ width: `${course.progress}%` }} />
                    </div>
                  </div>
                  <span className="w-fit rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">Berjalan</span>
                  <button
                    type="button"
                    aria-label={`Lihat kursus ${course.name}`}
                    onClick={() => setNotice(`Detail kursus ${course.name} belum tersedia di pratinjau.`)}
                    className="hidden h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 sm:flex"
                  >
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              ))}
            </div>
            <footer className="flex items-center gap-2 border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
              <Award className="h-4 w-4 text-amber-500" aria-hidden />
              Data progres dan nilai merupakan contoh untuk pratinjau frontend.
            </footer>
          </section>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: StudentStatus }) {
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
