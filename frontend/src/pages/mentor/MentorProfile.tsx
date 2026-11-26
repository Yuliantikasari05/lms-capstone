import { BookOpen, CalendarDays, Camera, Check, LockKeyhole, Mail, MapPin, Pencil, ShieldCheck, Star, Users } from 'lucide-react'
import { useState, useSyncExternalStore, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { ProfileAvatar } from '../../components/ProfileAvatar'
import { Button } from '../../components/ui/Button'
import { Field, inputClass } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { MENTOR_COURSES } from './courseData'
import {
  getMentorProfile,
  saveMentorProfile,
  subscribeMentorProfile,
  SYSTEM_AVATARS,
  type MentorProfilePreferences,
} from './profileData'

function joinedDate(value: string | null) {
  if (!value) return 'Belum tersedia'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Belum tersedia'
    : date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function MentorProfile() {
  const { user } = useAuth()
  const profile = useSyncExternalStore(
    subscribeMentorProfile,
    () => getMentorProfile(user?.id ?? -1, user?.name ?? ''),
  )
  const [editOpen, setEditOpen] = useState(false)
  const [draft, setDraft] = useState<MentorProfilePreferences>(profile)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isReadingFile, setIsReadingFile] = useState(false)

  if (!user) return null

  const userId = user.id
  const totalParticipants = MENTOR_COURSES.reduce((total, course) => total + course.students, 0)
  const averageRating = MENTOR_COURSES.reduce((total, course) => total + (course.rating ?? 0), 0) / MENTOR_COURSES.length
  const reviews = MENTOR_COURSES.flatMap((course) =>
    (course.reviews ?? []).map((review) => ({ ...review, courseTitle: course.title })),
  ).slice(0, 3)
  const courseTypes = [
    { label: 'Kelas reguler', count: MENTOR_COURSES.filter((course) => course.type === 'academic').length, color: '#3b82f6' },
    { label: 'Pelatihan', count: MENTOR_COURSES.filter((course) => course.type === 'training').length, color: '#fbbf24' },
    { label: 'Webinar', count: MENTOR_COURSES.filter((course) => course.type === 'webinar').length, color: '#cbd5e1' },
  ]

  function openEditor() {
    setDraft({ ...profile })
    setError('')
    setEditOpen(true)
  }

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Pilih foto berformat PNG, JPG, atau WEBP.')
      return
    }
    if (file.size > 3 * 1024 * 1024) {
      setError('Ukuran foto maksimal 3 MB.')
      return
    }

    const reader = new FileReader()
    setIsReadingFile(true)
    reader.onload = () => {
      const avatarData = reader.result
      if (typeof avatarData === 'string') {
        setDraft((current) => ({ ...current, avatar: avatarData }))
        setError('')
      } else {
        setError('Foto tidak dapat dibaca. Coba pilih file lain.')
      }
      setIsReadingFile(false)
    }
    reader.onerror = () => {
      setError('Foto gagal dibaca. Coba pilih file lain.')
      setIsReadingFile(false)
    }
    reader.readAsDataURL(file)
  }

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = draft.name.trim()
    const jobTitle = draft.jobTitle.trim()
    if (!name || !jobTitle) {
      setError('Nama dan pekerjaan harus diisi.')
      return
    }
    saveMentorProfile(userId, { ...draft, name, jobTitle, location: draft.location.trim() })
    setEditOpen(false)
    setError('')
    setNotice('Perubahan profil tersimpan pada pratinjau ini.')
  }

  return (
    <div className="space-y-5">
      {notice && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} className="font-semibold hover:underline">Tutup</button>
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-sky-100 via-blue-50 to-indigo-100 p-5 sm:p-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-center">
            <ProfileAvatar name={profile.name} avatar={profile.avatar} className="h-28 w-28 border-4 border-white text-4xl shadow-sm" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-800">{profile.name}</h1>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white" title="Mentor aktif">
                  <Check className="h-3.5 w-3.5" aria-hidden />
                </span>
              </div>
              <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700">
                <ShieldCheck className="h-4 w-4" aria-hidden />Mentor · {user.status === 'active' ? 'Aktif' : user.status}
              </p>
              <p className="mt-2 text-sm font-medium text-slate-600">{profile.jobTitle}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={openEditor} icon={<Pencil className="h-4 w-4" aria-hidden />}>Edit profil</Button>
                <Link to="/mentor/security" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  <LockKeyhole className="h-4 w-4" aria-hidden />Keamanan
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 border-t border-white/70 pt-4 sm:grid-cols-2 xl:grid-cols-4">
            <ProfileFact icon={<Mail className="h-4 w-4" aria-hidden />} value={user.email} label="Email" />
            <ProfileFact icon={<BookOpen className="h-4 w-4" aria-hidden />} value={profile.jobTitle} label="Pekerjaan" />
            <ProfileFact icon={<CalendarDays className="h-4 w-4" aria-hidden />} value={joinedDate(user.created_at)} label="Bergabung sejak" />
            <ProfileFact icon={<MapPin className="h-4 w-4" aria-hidden />} value={profile.location || 'Belum diatur'} label="Lokasi" />
          </div>
        </div>
      </section>

      <section aria-label="Ringkasan profil" className="grid gap-4 sm:grid-cols-3">
        <ProfileMetric icon={<Users className="h-6 w-6" aria-hidden />} value={String(totalParticipants)} label="Peserta kursus" hint="Total peserta pada kursus yang Anda ampu" color="blue" />
        <ProfileMetric icon={<BookOpen className="h-6 w-6" aria-hidden />} value={String(MENTOR_COURSES.length)} label="Kursus diampu" hint="Kursus yang tersedia untuk dikelola" color="green" />
        <ProfileMetric icon={<Star className="h-6 w-6 fill-current" aria-hidden />} value={averageRating.toFixed(1).replace('.', ',')} label="Rating rata-rata" hint="Berdasarkan ulasan peserta" color="amber" />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-slate-900">Distribusi kursus</h2>
          <CourseDistributionChart courseTypes={courseTypes} />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-slate-900">Ulasan terbaru</h2>
          <div className="mt-3 space-y-3">
            {reviews.map((review) => (
              <article key={`${review.courseTitle}-${review.id}`} className="flex gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                <ProfileAvatar name={review.name} className="h-9 w-9 bg-amber-100 text-xs font-semibold text-amber-800" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-800">{review.name}</p>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600">{review.rating.toFixed(1)} <Star className="h-3 w-3 fill-current" aria-hidden /></span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">{review.message}</p>
                  <p className="mt-1 text-[10px] text-slate-400">{review.courseTitle} · {review.date}</p>
                </div>
              </article>
            ))}
          </div>
          {reviews.length === 0 && <p className="mt-3 text-xs text-slate-500">Belum ada ulasan.</p>}
        </section>
      </div>

      <p className="text-center text-[10px] text-slate-400">Statistik kursus dan perubahan profil merupakan pratinjau frontend.</p>

      <Modal
        open={editOpen}
        title="Edit profil"
        onClose={() => setEditOpen(false)}
        size="lg"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setEditOpen(false)}>Batal</Button>
            <Button type="submit" form="mentor-profile-edit-form" disabled={isReadingFile} icon={<Check className="h-4 w-4" aria-hidden />}>
              Simpan perubahan
            </Button>
          </>
        )}
      >
        <form id="mentor-profile-edit-form" onSubmit={saveProfile} className="space-y-5">
          <div>
            <p className="mb-3 text-sm font-medium text-slate-700">Foto profil</p>
            <div className="flex flex-col items-center">
              <div className="relative">
                <ProfileAvatar name={draft.name} avatar={draft.avatar} className="h-24 w-24 border-2 border-slate-100 text-4xl" />
                <button type="button" onClick={() => document.getElementById('mentor-profile-photo')?.click()} aria-label="Pilih foto profil" className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-200 text-slate-700 hover:bg-slate-300">
                  <Camera className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <label htmlFor="mentor-profile-photo" className="mt-2 cursor-pointer text-xs font-medium text-brand-700 hover:underline">
                {isReadingFile ? 'Memuat foto…' : 'Unggah foto dari perangkat'}
              </label>
              <input id="mentor-profile-photo" type="file" accept="image/png,image/jpeg,image/webp" onChange={choosePhoto} className="sr-only" />
              <p className="mt-1 text-[10px] text-slate-500">PNG, JPG, atau WEBP · maksimal 3 MB</p>
            </div>

            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-slate-700">Atau pilih avatar dari sistem</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {SYSTEM_AVATARS.map((avatar) => (
                  <button
                    key={avatar.id}
                    type="button"
                    onClick={() => { setDraft((current) => ({ ...current, avatar: avatar.id })); setError('') }}
                    aria-pressed={draft.avatar === avatar.id}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border p-2 text-[9px] text-slate-600 ${draft.avatar === avatar.id ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-200' : 'border-slate-200 hover:bg-slate-50'}`}
                  >
                    <ProfileAvatar name={avatar.label} avatar={avatar.id} className="h-11 w-11 text-2xl" />
                    {avatar.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Field id="mentor-profile-name" label="Nama lengkap">
            <input id="mentor-profile-name" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} className={inputClass()} placeholder="Tulis nama lengkap Anda" maxLength={100} required data-autofocus />
          </Field>
          <Field id="mentor-profile-job" label="Title / pekerjaan">
            <input id="mentor-profile-job" value={draft.jobTitle} onChange={(event) => setDraft((current) => ({ ...current, jobTitle: event.target.value }))} className={inputClass()} placeholder="Contoh: Mentor Fullstack Developer" maxLength={100} required />
          </Field>
          <Field id="mentor-profile-location" label="Lokasi (opsional)">
            <input id="mentor-profile-location" value={draft.location} onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value }))} className={inputClass()} placeholder="Contoh: Jakarta, Indonesia" maxLength={100} />
          </Field>
          {user.email && (
            <Field id="mentor-profile-email" label="Email">
              <input id="mentor-profile-email" value={user.email} className={`${inputClass()} bg-slate-100 text-slate-500`} readOnly />
            </Field>
          )}
          {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
        </form>
      </Modal>
    </div>
  )
}

function ProfileFact({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-slate-600">
      <span className="text-slate-500">{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium">{value}</span>
        <span className="block text-[10px] text-slate-500">{label}</span>
      </span>
    </div>
  )
}

function ProfileMetric({
  icon,
  value,
  label,
  hint,
  color,
}: {
  icon: ReactNode
  value: string
  label: string
  hint: string
  color: 'blue' | 'green' | 'amber'
}) {
  const colors = {
    blue: { icon: 'bg-blue-50 text-blue-500', bar: 'bg-blue-500' },
    green: { icon: 'bg-lime-50 text-lime-500', bar: 'bg-lime-500' },
    amber: { icon: 'bg-amber-50 text-amber-400', bar: 'bg-amber-400' },
  }

  return (
    <article className="relative overflow-hidden rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${colors[color].icon}`}>{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-700">{label}</p>
          <p className="mt-1 text-[10px] leading-4 text-slate-500">{hint}</p>
        </div>
        <strong className="text-2xl font-bold text-slate-900">{value}</strong>
      </div>
      <div className={`absolute inset-x-0 bottom-0 h-1.5 ${colors[color].bar}`} />
    </article>
  )
}

function CourseDistributionChart({ courseTypes }: { courseTypes: { label: string; count: number; color: string }[] }) {
  const width = 520
  const height = 220
  const plot = { left: 40, right: 12, top: 16, bottom: 42 }
  const plotHeight = height - plot.top - plot.bottom
  const max = Math.max(4, ...courseTypes.map((item) => item.count))
  const y = (value: number) => plot.top + plotHeight * (1 - value / max)
  const groupWidth = (width - plot.left - plot.right) / courseTypes.length
  const barWidth = Math.min(64, groupWidth * 0.48)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 w-full" role="img" aria-label="Grafik jumlah kursus berdasarkan kategori">
      {[0, 1, 2, 3, 4].map((tick) => (
        <g key={tick}>
          <line x1={plot.left} x2={width - plot.right} y1={y(tick)} y2={y(tick)} stroke="#e8edf4" strokeDasharray={tick === 0 ? undefined : '3 3'} />
          <text x={plot.left - 10} y={y(tick) + 3} textAnchor="end" fill="#64748b" fontSize="10">{tick}</text>
        </g>
      ))}
      {courseTypes.map((item, index) => {
        const center = plot.left + groupWidth * (index + 0.5)
        const barHeight = plotHeight * (item.count / max)
        return (
          <g key={item.label}>
            <rect x={center - barWidth / 2} y={y(item.count)} width={barWidth} height={barHeight} rx="4" fill={item.color} />
            <text x={center} y={y(item.count) - 6} textAnchor="middle" fill="#334155" fontSize="11" fontWeight="600">{item.count}</text>
            <text x={center} y={height - 13} textAnchor="middle" fill="#64748b" fontSize="10">{item.label}</text>
          </g>
        )
      })}
    </svg>
  )
}
