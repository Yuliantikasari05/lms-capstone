import {
  ArrowLeft,
  BookOpen,
  Check,
  GraduationCap,
  ImagePlus,
  LockKeyhole,
  Save,
  Star,
  Users,
} from 'lucide-react'
import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { Button } from '../../components/ui/Button'
import { ROLE_CONFIG } from '../../config/navigation'
import { LembagaPageHeader } from './LembagaPageHeader'

type SettingsTab = 'profile' | 'details'

interface InstructorProfileData {
  name: string
  role: string
  totalStudents: number
  totalClasses: number
  rating: number
  completedClasses: number
  teachingHours: number
  certificatesReleased: number
}

export default function LembagaPengaturan() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')
  const [notice, setNotice] = useState('')
  const instructor: InstructorProfileData = {
    name: user?.name ?? 'Mitra Lembaga',
    role: user?.primary_role ? ROLE_CONFIG[user.primary_role].label : 'Instructor',
    totalStudents: 11,
    totalClasses: 4,
    rating: 4.9,
    completedClasses: 4,
    teachingHours: 1.5,
    certificatesReleased: 2,
  }

  return (
    <div className="space-y-6">
      <LembagaPageHeader onReportClick={() => setNotice('Laporan instruktur belum tersedia di pratinjau.')} />

      <nav aria-label="Pengaturan instruktur" className="border-b border-slate-200">
        <div className="flex gap-2">
          <SettingsTabButton active={activeTab === 'profile'} onClick={() => setActiveTab('profile')}>
            Profil Instruktur
          </SettingsTabButton>
          <SettingsTabButton active={activeTab === 'details'} onClick={() => setActiveTab('details')}>
            Pengaturan Detail
          </SettingsTabButton>
        </div>
      </nav>

      {notice && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <span>{notice}</span>
          <button type="button" className="font-semibold hover:underline" onClick={() => setNotice('')}>Tutup</button>
        </div>
      )}

      {activeTab === 'profile'
        ? <InstructorProfile user={instructor} />
        : <EditInstructorProfile
            onSaved={() => setNotice('Perubahan profil disimpan sementara di pratinjau.')}
            onBack={() => setActiveTab('profile')}
          />}

      <p className="text-xs text-slate-500">Statistik dan perubahan profil merupakan contoh pratinjau frontend, belum terhubung ke backend.</p>
    </div>
  )
}

function InstructorProfile({ user }: { user: InstructorProfileData }) {
  const instructorStats = [
    { value: user.completedClasses, label: 'Kelas Selesai', color: 'text-blue-700' },
    { value: user.rating, label: 'Rating', color: 'text-emerald-700' },
    { value: user.teachingHours, label: 'Jam Mengajar', color: 'text-amber-700' },
    { value: user.certificatesReleased, label: 'Sertifikat Dirilis', color: 'text-blue-700' },
  ]

  return (
    <section aria-labelledby="instructor-name" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-2 border-slate-100 bg-gradient-to-br from-blue-50 to-indigo-100 text-2xl font-bold text-blue-800 shadow-sm">
            {getInitials(user.name)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 id="instructor-name" className="text-2xl font-bold tracking-tight text-slate-900">{user.name}</h1>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">
                  <GraduationCap className="h-4 w-4" aria-hidden />
                  INSTRUCTOR
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-800">
                  <Check className="h-4 w-4" aria-hidden />
                  Terverifikasi
                </span>
              </div>
            </div>
            <p className="mt-1 text-sm text-slate-600">{user.role}</p>
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700">
              <LockKeyhole className="h-3.5 w-3.5" aria-hidden />
              Keamanan
            </span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <PrimaryMetric icon={<Users className="h-5 w-5" aria-hidden />} label="Total Siswa" value={String(user.totalStudents)} tone="blue" />
          <PrimaryMetric icon={<BookOpen className="h-5 w-5" aria-hidden />} label="Total Kelas" value={String(user.totalClasses)} tone="green" />
          <PrimaryMetric icon={<Star className="h-5 w-5" aria-hidden />} label="Rating Rata-rata" value={`${user.rating}/5`} tone="amber" />
        </div>

        <div className="border-t border-slate-100 pt-5">
          <h2 className="text-[11px] font-bold tracking-[0.14em] text-slate-500">STATISTIK MENGAJAR</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {instructorStats.map((stat) => (
              <article key={stat.label} className="rounded-xl bg-slate-50 px-4 py-3.5">
                <p className={`text-xl font-bold tracking-tight ${stat.color}`}>{stat.value}</p>
                <p className="mt-0.5 text-xs text-slate-500">{stat.label}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function EditInstructorProfile({ onSaved, onBack }: { onSaved: () => void; onBack: () => void }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    fullName: user?.name ?? '',
    email: user?.email ?? '',
    bio: 'Mahasiswa Teknik Informatika angkatan 2021. Fokus pada pengembangan web dan kecerdasan buatan.',
  })
  const [photo, setPhoto] = useState<string | null>(null)

  useEffect(() => {
    if (!photo) return
    return () => URL.revokeObjectURL(photo)
  }, [photo])

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      event.target.value = ''
      return
    }
    setPhoto(URL.createObjectURL(file))
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSaved()
  }

  function updateField(field: keyof typeof formData, value: string) {
    setFormData((current) => ({ ...current, [field]: value }))
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <button
        type="button"
        onClick={() => {
          navigate('/lembaga/settings')
          onBack()
        }}
        className="mb-5 inline-flex items-center gap-2 text-xs font-medium text-slate-600 transition hover:text-slate-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Kembali ke Profile
      </button>
      <h1 className="border-b border-slate-200 pb-3 text-lg font-bold text-blue-800">Profil Pengguna</h1>

      <form className="mt-5 grid gap-6 md:grid-cols-[120px_minmax(0,1fr)]" onSubmit={submit}>
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-slate-200 bg-slate-50">
            {photo ? (
              <img src={photo} alt="Pratinjau foto profil" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xl font-bold text-blue-800">{getInitials(formData.fullName)}</span>
            )}
          </div>
          <label className="cursor-pointer text-xs font-bold text-blue-700 hover:text-blue-900">
            <span className="inline-flex items-center gap-1.5"><ImagePlus className="h-3.5 w-3.5" aria-hidden /> Ubah Foto</span>
            <input type="file" accept="image/*" className="sr-only" onChange={choosePhoto} />
          </label>
        </div>

        <div className="min-w-0 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-700">
              Nama Lengkap
              <input
                type="text"
                value={formData.fullName}
                onChange={(event) => updateField('fullName', event.target.value)}
                maxLength={100}
                required
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Email Institusi
              <input
                type="email"
                value={formData.email}
                disabled
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-gray-100 px-3 py-2.5 text-sm font-normal text-gray-500 disabled:cursor-not-allowed"
              />
            </label>
          </div>

          <label className="block text-xs font-semibold text-slate-700">
            Bio Singkat
            <textarea
              value={formData.bio}
              onChange={(event) => updateField('bio', event.target.value)}
              rows={4}
              maxLength={500}
              className="mt-1.5 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <div className="flex justify-end">
            <Button type="submit" icon={<Save className="h-4 w-4" aria-hidden />}>Simpan Perubahan</Button>
          </div>
        </div>
      </form>
    </section>
  )
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase()
}

function PrimaryMetric({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode
  label: string
  value: string
  tone: 'blue' | 'green' | 'amber'
}) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-800',
  }
  return (
    <article className="flex items-center gap-3 rounded-xl border border-slate-200 p-4">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}>{icon}</span>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="mt-0.5 text-xl font-bold leading-6 text-slate-900">{value}</p>
      </div>
    </article>
  )
}

function SettingsTabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-3 text-xs font-semibold transition-colors sm:text-sm ${
        active ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'
      }`}
    >
      {children}
    </button>
  )
}
